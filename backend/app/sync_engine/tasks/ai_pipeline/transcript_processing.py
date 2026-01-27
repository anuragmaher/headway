"""
Transcript Processing Task

Processes raw transcripts from the raw_transcripts table:
1. Fetches unprocessed transcripts (ai_processed = false)
2. Loads themes, company name, and company domains for prompt
3. Calls Claude API via Langfuse prompt
4. Stores results in transcript_classifications table
5. Marks raw transcript as ai_processed = true
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from celery import shared_task
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.raw_transcript import RawTranscript
from app.models.transcript_classification import TranscriptClassification
from app.models.theme import Theme
from app.models.user import User
from app.services.langfuse_prompt_service import get_langfuse_client

logger = logging.getLogger(__name__)


def _truncate_transcript(transcript_data: Any, max_chars: int = 80000) -> tuple[Any, bool]:
    """
    Truncate transcript data to fit within token limits.

    Args:
        transcript_data: Raw transcript data (dict or string)
        max_chars: Maximum characters allowed

    Returns:
        Tuple of (truncated_data, was_truncated)
    """
    # Convert to string for size check
    if isinstance(transcript_data, dict):
        transcript_str = json.dumps(transcript_data)
    else:
        transcript_str = str(transcript_data)

    if len(transcript_str) <= max_chars:
        return transcript_data, False

    logger.warning(f"Transcript too large ({len(transcript_str)} chars), truncating to {max_chars} chars")

    # If it's a dict, try to truncate intelligently
    if isinstance(transcript_data, dict):
        # Look for common transcript content fields
        content_fields = ['transcript', 'content', 'text', 'segments', 'utterances', 'monologues']
        truncated_data = transcript_data.copy()

        for field in content_fields:
            if field in truncated_data:
                content = truncated_data[field]

                # If it's a list (like segments/utterances), truncate the list
                if isinstance(content, list) and len(content) > 0:
                    # Keep first and last portions
                    total_items = len(content)
                    if total_items > 20:
                        # Keep first 10 and last 10 items
                        truncated_data[field] = content[:10] + [
                            {"note": f"... {total_items - 20} items truncated ..."}
                        ] + content[-10:]
                        logger.info(f"Truncated {field} list from {total_items} to 21 items")

                # If it's a string, truncate with ellipsis
                elif isinstance(content, str) and len(content) > max_chars // 2:
                    half = max_chars // 4
                    truncated_data[field] = (
                        content[:half] +
                        f"\n\n... [TRUNCATED - {len(content) - max_chars // 2} chars removed] ...\n\n" +
                        content[-half:]
                    )
                    logger.info(f"Truncated {field} string from {len(content)} to ~{max_chars // 2} chars")

        # Final check - if still too large, do a hard truncate on the JSON
        result_str = json.dumps(truncated_data)
        if len(result_str) > max_chars:
            # Hard truncate: keep first and last portions
            half = max_chars // 2 - 50
            result_str = result_str[:half] + '..."truncated_middle": true,...' + result_str[-half:]
            try:
                truncated_data = json.loads(result_str)
            except json.JSONDecodeError:
                # If JSON is broken, just return a simple truncated version
                truncated_data = {
                    "truncated": True,
                    "original_size": len(transcript_str),
                    "content_preview": transcript_str[:max_chars - 100]
                }

        return truncated_data, True

    # For string data, simple truncation with middle cut
    half = max_chars // 2 - 50
    truncated_str = (
        transcript_str[:half] +
        f"\n\n... [TRUNCATED - {len(transcript_str) - max_chars} chars removed] ...\n\n" +
        transcript_str[-half:]
    )
    return truncated_str, True


# Configuration
BATCH_SIZE = 10
MAX_RETRIES = 3
# Max characters for transcript (gpt-4o-mini has 128K token limit, ~4 chars per token)
# Leave room for system prompt, themes, and response - use ~80K chars for transcript
MAX_TRANSCRIPT_CHARS = 80000


def _format_transcript_as_text(raw_data: Dict[str, Any]) -> str:
    """
    Format raw transcript data as readable text with speaker names, emails, and dialogue.
    Similar to format_transcript_as_text in fetch_gong_transcripts.py
    """
    if not raw_data:
        return "No transcript available."

    # Build speaker mapping from parties
    parties = raw_data.get('parties', [])
    speaker_map = {}
    for party in parties:
        speaker_id = party.get('speakerId')
        if speaker_id:
            name = party.get('name', 'Unknown')
            email = party.get('emailAddress', '')
            speaker_map[str(speaker_id)] = {
                'name': name,
                'email': email
            }

    # Get transcript data - could be in different locations
    transcript_data = raw_data.get('transcript', {})
    if isinstance(transcript_data, dict):
        transcript_segments = transcript_data.get('transcript', [])
    elif isinstance(transcript_data, list):
        transcript_segments = transcript_data
    else:
        transcript_segments = []

    if not isinstance(transcript_segments, list):
        # If still not a list, try to extract text from raw_data
        if 'content' in raw_data:
            return str(raw_data['content'])
        return "Transcript format not recognized."

    lines = []

    # Add header
    call_metadata = raw_data.get('call_metadata', raw_data.get('metaData', {}))
    title = call_metadata.get('title', 'Untitled Call')
    started = call_metadata.get('started', '')

    lines.append("=" * 80)
    lines.append(f"Call: {title}")
    if started:
        lines.append(f"Date: {started}")
    lines.append("=" * 80)
    lines.append("")

    for segment in transcript_segments:
        if not isinstance(segment, dict):
            continue

        speaker_id = str(segment.get('speakerId', ''))
        speaker_info = speaker_map.get(speaker_id, {'name': 'Unknown Speaker', 'email': ''})

        name = speaker_info['name']
        email = speaker_info['email']

        # Extract sentences
        sentences = segment.get('sentences', [])
        if not sentences:
            # Try 'text' field directly
            text = segment.get('text', '')
            if text:
                sentences = [{'text': text}]
            else:
                continue

        # Combine all sentences for this speaker segment
        text_parts = []
        for sentence in sentences:
            if isinstance(sentence, dict):
                text = sentence.get('text', '').strip()
                if text:
                    text_parts.append(text)
            elif isinstance(sentence, str):
                text_parts.append(sentence.strip())

        if not text_parts:
            continue

        full_text = ' '.join(text_parts)

        # Format: Name (email): what they said
        if email:
            lines.append(f"{name} ({email}):")
        else:
            lines.append(f"{name}:")
        lines.append(f"  {full_text}")
        lines.append("")

    return "\n".join(lines) if lines else "No transcript content found."


def _load_prompt_variables(db: Session, raw_transcript: RawTranscript) -> Dict[str, Any]:
    """Load all variables needed for Langfuse prompt."""

    workspace = raw_transcript.workspace
    company = workspace.company

    # 1. THEMES_JSON - Load themes + sub-themes as JSON
    themes = db.query(Theme).filter(Theme.workspace_id == workspace.id).all()
    themes_json = [
        {
            "id": str(theme.id),
            "name": theme.name,
            "description": theme.description,
            "sub_themes": [
                {"id": str(st.id), "name": st.name, "description": st.description}
                for st in theme.sub_themes
            ]
        }
        for theme in themes
    ]

    # 2. TRANSCRIPT - Format as readable text (like fetch_gong_transcripts.py does)
    # This ensures Langfuse prompt doesn't split into 64K+ messages
    transcript_text = _format_transcript_as_text(raw_transcript.raw_data)
    logger.info(f"Formatted transcript text: {len(transcript_text)} chars")

    # Truncate if too large to fit in context window
    if len(transcript_text) > MAX_TRANSCRIPT_CHARS:
        half = MAX_TRANSCRIPT_CHARS // 2
        transcript_text = (
            transcript_text[:half] +
            "\n\n... [TRANSCRIPT TRUNCATED] ...\n\n" +
            transcript_text[-half:]
        )
        logger.info(f"Transcript {raw_transcript.id} was truncated to {len(transcript_text)} chars")

    # 3. COMPANY_NAME - From Company table via workspace
    company_name = company.name if company else "Unknown Company"

    # 4. COMPANY_DOMAINS - From Company.domains or fallback to user email domain
    company_domains = company.domains if company and company.domains else []
    if not company_domains:
        # Fallback: extract domain from workspace owner's email
        owner = db.query(User).filter(
            User.workspace_id == workspace.id,
            User.role == "owner"
        ).first()
        if owner and owner.email:
            domain = owner.email.split("@")[1] if "@" in owner.email else None
            company_domains = [domain] if domain else []

    return {
        "THEMES_JSON": json.dumps(themes_json, indent=2),
        "TRANSCRIPT": transcript_text,  # Pass as text, not JSON (like fetch_gong_transcripts.py)
        "Company_Name": company_name,
        "Company_Domains": ", ".join(company_domains) if company_domains else "Not specified",
    }


def _call_ai_for_classification(variables: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetch Langfuse prompt and call OpenAI API for transcript classification.

    Uses Langfuse prompt directly without any modification - exactly like
    fetch_gong_transcripts.py does.

    Returns the AI response as a dictionary.
    """
    try:
        client = get_langfuse_client()
        if not client:
            logger.warning("Langfuse client not available, skipping AI processing")
            return {"error": "Langfuse client not available"}

        # Get prompt from Langfuse (with production label)
        prompt = client.get_prompt("classification prompt", label="production", type="chat")

        # Compile prompt with variables
        compiled = prompt.compile(**variables)

        # Handle different return types from Langfuse (same as fetch_gong_transcripts.py)
        # Chat prompts should return a list of message dicts, but might return string
        if isinstance(compiled, str):
            # If it's a string, the prompt might be a text prompt, not chat
            logger.warning("Prompt returned string instead of messages array. Wrapping as user message.")
            messages = [{"role": "user", "content": compiled}]
        elif isinstance(compiled, list):
            messages = compiled
        else:
            # Try to convert to list if it's some other iterable
            try:
                messages = list(compiled)
            except Exception:
                logger.error(f"Unexpected prompt compile result type: {type(compiled)}")
                return {"error": f"Unexpected prompt result type: {type(compiled)}"}

        # Log message info
        logger.info(f"Langfuse returned {len(messages)} messages")

        # Sanity check: if we have way too many messages, something went wrong
        # (e.g., Langfuse split a string into characters)
        if len(messages) > 100:
            logger.warning(f"Too many messages ({len(messages)}), likely a Langfuse issue. Consolidating...")
            # Check if messages are individual characters (common Langfuse bug)
            if messages and isinstance(messages[0], str) and len(messages[0]) == 1:
                # Messages are individual characters - join them back
                full_content = "".join(str(m) for m in messages)
                messages = [{"role": "user", "content": full_content}]
                logger.info(f"Consolidated {len(messages)} character messages into 1 message")
            else:
                # Messages are proper dicts but too many - consolidate by role
                system_parts = []
                user_parts = []
                for msg in messages:
                    if isinstance(msg, dict):
                        role = msg.get("role", "user")
                        content = msg.get("content", "")
                    elif hasattr(msg, "role"):
                        role = getattr(msg, "role", "user")
                        content = getattr(msg, "content", "")
                    else:
                        role = "user"
                        content = str(msg)

                    if role == "system":
                        system_parts.append(content)
                    else:
                        user_parts.append(content)

                messages = []
                if system_parts:
                    messages.append({"role": "system", "content": "\n".join(system_parts)})
                if user_parts:
                    messages.append({"role": "user", "content": "\n".join(user_parts)})

                logger.info(f"Consolidated to {len(messages)} messages")

        # Call OpenAI API
        from openai import OpenAI

        from app.core.config import Settings
        settings = Settings()

        if not settings.OPENAI_API_KEY:
            logger.warning("OpenAI API key not configured")
            return {"error": "OpenAI API key not configured"}

        openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # Convert messages to OpenAI format if needed
        # Langfuse chat prompts return list of dicts with 'role' and 'content'
        openai_messages = []
        for msg in messages:
            if isinstance(msg, dict) and "role" in msg and "content" in msg:
                openai_messages.append(msg)
            elif hasattr(msg, "role") and hasattr(msg, "content"):
                openai_messages.append({
                    "role": getattr(msg, "role"),
                    "content": getattr(msg, "content")
                })
            else:
                # Fallback: treat as user message
                openai_messages.append({
                    "role": "user",
                    "content": str(msg)
                })

        # Call OpenAI - use Langfuse prompt directly, no modifications
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=openai_messages,
            temperature=0,
            response_format={"type": "json_object"},
            max_tokens=4000
        )

        # Parse response
        response_text = response.choices[0].message.content

        # Try to extract JSON from response
        try:
            # Look for JSON in the response
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                json_str = response_text[json_start:json_end].strip()
            elif "{" in response_text:
                # Find the first { and last }
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                json_str = response_text[json_start:json_end]
            else:
                json_str = response_text

            result = json.loads(json_str)
            return result

        except json.JSONDecodeError:
            logger.warning(f"Failed to parse AI response as JSON: {response_text[:200]}")
            return {
                "raw_response": response_text,
                "error": "Failed to parse response as JSON"
            }

    except Exception as e:
        logger.error(f"Error calling AI for classification: {e}")
        return {"error": str(e)}


def _extract_theme_ids_from_response(ai_result: Dict[str, Any]) -> tuple[list, list]:
    """
    Extract theme_ids and sub_theme_ids from AI response.
    Handles various response formats from the AI.
    """
    theme_ids = []
    sub_theme_ids = []

    # Log the AI response structure for debugging
    logger.info(f"AI response keys: {list(ai_result.keys())}")

    # Try multiple possible locations for theme data
    # 1. Check "mappings" array
    mappings = ai_result.get("mappings", [])
    if mappings:
        logger.info(f"Found {len(mappings)} mappings in AI response")
        for mapping in mappings:
            # Try various key names for theme_id
            theme_id_str = (
                mapping.get("theme_id") or
                mapping.get("themeId") or
                mapping.get("theme") or
                None
            )
            if theme_id_str:
                try:
                    theme_ids.append(UUID(str(theme_id_str)))
                except (ValueError, TypeError) as e:
                    logger.debug(f"Could not parse theme_id '{theme_id_str}': {e}")

            # Try various key names for sub_theme_id
            sub_theme_id_str = (
                mapping.get("sub_theme_id") or
                mapping.get("subThemeId") or
                mapping.get("sub_theme") or
                mapping.get("subtheme_id") or
                None
            )
            if sub_theme_id_str:
                try:
                    sub_theme_ids.append(UUID(str(sub_theme_id_str)))
                except (ValueError, TypeError) as e:
                    logger.debug(f"Could not parse sub_theme_id '{sub_theme_id_str}': {e}")

    # 2. Check "themes" array (alternative format)
    themes = ai_result.get("themes", [])
    if themes:
        logger.info(f"Found {len(themes)} themes in AI response")
        for theme in themes:
            if isinstance(theme, dict):
                theme_id_str = theme.get("id") or theme.get("theme_id")
                if theme_id_str:
                    try:
                        theme_ids.append(UUID(str(theme_id_str)))
                    except (ValueError, TypeError):
                        pass

                # Check for sub_themes within theme
                sub_themes = theme.get("sub_themes", []) or theme.get("subThemes", [])
                for st in sub_themes:
                    if isinstance(st, dict):
                        st_id = st.get("id") or st.get("sub_theme_id")
                        if st_id:
                            try:
                                sub_theme_ids.append(UUID(str(st_id)))
                            except (ValueError, TypeError):
                                pass
            elif isinstance(theme, str):
                # Theme might be a UUID string directly
                try:
                    theme_ids.append(UUID(theme))
                except (ValueError, TypeError):
                    pass

    # 3. Check "classifications" array
    classifications = ai_result.get("classifications", [])
    if classifications:
        logger.info(f"Found {len(classifications)} classifications in AI response")
        for cls in classifications:
            if isinstance(cls, dict):
                theme_id_str = cls.get("theme_id") or cls.get("themeId")
                if theme_id_str:
                    try:
                        theme_ids.append(UUID(str(theme_id_str)))
                    except (ValueError, TypeError):
                        pass
                sub_theme_id_str = cls.get("sub_theme_id") or cls.get("subThemeId")
                if sub_theme_id_str:
                    try:
                        sub_theme_ids.append(UUID(str(sub_theme_id_str)))
                    except (ValueError, TypeError):
                        pass

    # Remove duplicates while preserving order
    theme_ids = list(dict.fromkeys(theme_ids))
    sub_theme_ids = list(dict.fromkeys(sub_theme_ids))

    logger.info(f"Extracted {len(theme_ids)} theme_ids and {len(sub_theme_ids)} sub_theme_ids")

    return theme_ids, sub_theme_ids


def _save_classification(
    db: Session,
    raw_transcript: RawTranscript,
    ai_result: Dict[str, Any]
) -> TranscriptClassification:
    """Save AI classification result to transcript_classifications table."""
    from app.models.sub_theme import SubTheme

    workspace_id = raw_transcript.workspace_id

    # Extract theme/sub-theme IDs from AI response
    theme_ids, sub_theme_ids = _extract_theme_ids_from_response(ai_result)

    # Validate theme IDs exist in database to avoid foreign key violations
    if theme_ids:
        valid_theme_ids = db.query(Theme.id).filter(
            Theme.workspace_id == workspace_id,
            Theme.id.in_(theme_ids)
        ).all()
        valid_theme_ids = [t[0] for t in valid_theme_ids]
        invalid_theme_ids = [t for t in theme_ids if t not in valid_theme_ids]
        if invalid_theme_ids:
            logger.warning(f"Filtered out {len(invalid_theme_ids)} invalid theme_ids: {invalid_theme_ids}")
        theme_ids = valid_theme_ids

    # Validate sub_theme IDs exist in database
    if sub_theme_ids:
        valid_sub_theme_ids = db.query(SubTheme.id).filter(
            SubTheme.workspace_id == workspace_id,
            SubTheme.id.in_(sub_theme_ids)
        ).all()
        valid_sub_theme_ids = [s[0] for s in valid_sub_theme_ids]
        invalid_sub_theme_ids = [s for s in sub_theme_ids if s not in valid_sub_theme_ids]
        if invalid_sub_theme_ids:
            logger.warning(f"Filtered out {len(invalid_sub_theme_ids)} invalid sub_theme_ids: {invalid_sub_theme_ids}")
        sub_theme_ids = valid_sub_theme_ids

    # Set primary theme_id and sub_theme_id (first from lists)
    theme_id = theme_ids[0] if theme_ids else None
    sub_theme_id = sub_theme_ids[0] if sub_theme_ids else None

    # Check if classification already exists
    existing = db.query(TranscriptClassification).filter(
        TranscriptClassification.workspace_id == workspace_id,
        TranscriptClassification.source_type == raw_transcript.source_type,
        TranscriptClassification.source_id == raw_transcript.source_id,
    ).first()

    if existing:
        # Update existing
        existing.theme_id = theme_id
        existing.sub_theme_id = sub_theme_id
        existing.theme_ids = theme_ids if theme_ids else None
        existing.sub_theme_ids = sub_theme_ids if sub_theme_ids else None
        existing.extracted_data = ai_result
        existing.raw_ai_response = ai_result
        existing.processing_status = "completed"
        existing.confidence_score = str(ai_result.get("confidence", ""))
        existing.updated_at = datetime.now(timezone.utc)
        classification = existing
    else:
        # Create new
        classification = TranscriptClassification(
            workspace_id=workspace_id,
            source_type=raw_transcript.source_type,
            source_id=raw_transcript.source_id,
            source_title=raw_transcript.title,
            theme_id=theme_id,
            sub_theme_id=sub_theme_id,
            theme_ids=theme_ids if theme_ids else None,
            sub_theme_ids=sub_theme_ids if sub_theme_ids else None,
            extracted_data=ai_result,
            raw_ai_response=ai_result,
            processing_status="completed",
            confidence_score=str(ai_result.get("confidence", "")),
            transcript_date=raw_transcript.transcript_date,
        )
        db.add(classification)

    logger.info(
        f"Saving classification: theme_id={theme_id}, sub_theme_id={sub_theme_id}, "
        f"theme_ids={theme_ids}, sub_theme_ids={sub_theme_ids}"
    )

    return classification


@shared_task(
    name="app.sync_engine.tasks.ai_pipeline.transcript_processing.process_raw_transcripts",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    time_limit=600,
    soft_time_limit=540,
)
def process_raw_transcripts(
    self,
    workspace_id: Optional[str] = None,
    batch_size: int = BATCH_SIZE,
) -> Dict[str, Any]:
    """
    Process unprocessed raw transcripts through AI classification.

    Args:
        workspace_id: Optional workspace filter (process all if not specified)
        batch_size: Number of transcripts to process per run

    Returns:
        Dict with processing stats
    """
    logger.info(f"Starting transcript processing (workspace_id={workspace_id}, batch_size={batch_size})")

    db = SessionLocal()
    try:
        # Query unprocessed transcripts
        query = db.query(RawTranscript).filter(
            RawTranscript.ai_processed == False,
            RawTranscript.retry_count < MAX_RETRIES,
        )

        if workspace_id:
            query = query.filter(RawTranscript.workspace_id == UUID(workspace_id))

        # Order by created_at to process oldest first
        transcripts = query.order_by(RawTranscript.created_at).limit(batch_size).all()

        if not transcripts:
            logger.info("No unprocessed transcripts found")
            return {"processed": 0, "failed": 0, "skipped": 0}

        processed = 0
        failed = 0
        skipped = 0

        for transcript in transcripts:
            try:
                logger.info(f"Processing transcript {transcript.id} ({transcript.source_type}/{transcript.source_id})")

                # Mark processing started
                transcript.processing_started_at = datetime.now(timezone.utc)
                db.commit()

                # Load prompt variables
                variables = _load_prompt_variables(db, transcript)

                # Call AI
                ai_result = _call_ai_for_classification(variables)

                if "error" in ai_result and not ai_result.get("mappings"):
                    # AI call failed
                    transcript.processing_error = ai_result.get("error", "Unknown error")
                    transcript.retry_count += 1
                    failed += 1
                    logger.warning(f"AI processing failed for transcript {transcript.id}: {ai_result.get('error')}")
                else:
                    # Save classification
                    _save_classification(db, transcript, ai_result)

                    # Mark as processed
                    transcript.ai_processed = True
                    transcript.processing_completed_at = datetime.now(timezone.utc)
                    transcript.processing_error = None
                    processed += 1
                    logger.info(f"Successfully processed transcript {transcript.id}")

                db.commit()

            except Exception as e:
                logger.error(f"Error processing transcript {transcript.id}: {e}", exc_info=True)
                # Rollback the failed transaction before updating error info
                db.rollback()
                try:
                    # Re-fetch the transcript after rollback to update error info
                    transcript = db.query(RawTranscript).filter(RawTranscript.id == transcript.id).first()
                    if transcript:
                        transcript.processing_error = str(e)[:1000]  # Truncate error message
                        transcript.retry_count += 1
                        db.commit()
                except Exception as update_err:
                    logger.error(f"Failed to update transcript error info: {update_err}")
                    db.rollback()
                failed += 1

        result = {
            "processed": processed,
            "failed": failed,
            "skipped": skipped,
            "total": len(transcripts),
        }
        logger.info(f"Transcript processing completed: {result}")
        return result

    except Exception as e:
        logger.error(f"Error in process_raw_transcripts: {e}", exc_info=True)
        raise

    finally:
        db.close()
