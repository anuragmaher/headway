#!/usr/bin/env python
"""
Fetch Gong Transcripts

This script fetches Gong call transcripts from the Gong API and saves them to JSON files.
Optionally processes transcripts with Langfuse prompts and stores results in a Langfuse dataset.

Usage:
    # From backend directory (with venv activated):
    python scripts/fetch_gong_transcripts.py --email anurag@grexit.com --limit 5
    python scripts/fetch_gong_transcripts.py --workspace-id <uuid> --limit 5
    python scripts/fetch_gong_transcripts.py --email anurag@grexit.com --limit 5 --output-dir ./transcripts
    
    # With Langfuse processing and dataset storage:
    python scripts/fetch_gong_transcripts.py --email anurag@grexit.com --limit 5 --use-langfuse
    python scripts/fetch_gong_transcripts.py --email anurag@grexit.com --limit 5 --use-langfuse --prompt-name "classification prompt" --prompt-label production
"""

import argparse
import json
import sys
import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID
import requests

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.database import engine
from app.core.config import settings
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_connector import WorkspaceConnector
from app.models.transcript_classification import TranscriptClassification
from app.models.theme import Theme
from app.models.sub_theme import SubTheme


def find_workspace_by_email(db: Session, email: str) -> Optional[UUID]:
    """Find workspace_id for a user by email."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"❌ User not found: {email}")
        return None
    
    if not user.workspace_id:
        print(f"❌ User {email} has no workspace_id")
        return None
    
    print(f"✅ Found user: {email}")
    print(f"   Workspace ID: {user.workspace_id}")
    return user.workspace_id


def get_gong_credentials(db: Session, workspace_id: UUID) -> Optional[Dict[str, str]]:
    """Get Gong API credentials from workspace connector."""
    connector = db.query(WorkspaceConnector).filter(
        and_(
            WorkspaceConnector.workspace_id == workspace_id,
            WorkspaceConnector.connector_type == "gong",
            WorkspaceConnector.is_active == True
        )
    ).first()
    
    if not connector:
        print(f"❌ No active Gong connector found for workspace {workspace_id}")
        return None
    
    creds = connector.credentials or {}
    access_key = creds.get('access_key')
    secret_key = creds.get('secret_key')
    
    if not access_key or not secret_key:
        print(f"❌ Gong credentials not found or incomplete in connector {connector.id}")
        return None
    
    print(f"✅ Found Gong connector: {connector.name or connector.external_name}")
    return {
        "access_key": access_key,
        "secret_key": secret_key
    }


def fetch_gong_calls(
    credentials: Dict[str, str],
    limit: int = 5,
    days_back: int = 30,
    base_url: str = "https://api.gong.io"
) -> List[Dict[str, Any]]:
    """Fetch calls from Gong API."""
    try:
        to_date = datetime.now(timezone.utc)
        from_date = to_date - timedelta(days=days_back)
        
        from_datetime = from_date.strftime('%Y-%m-%dT%H:%M:%S-00:00')
        to_datetime = to_date.strftime('%Y-%m-%dT%H:%M:%S-00:00')
        
        url = f"{base_url}/v2/calls/extensive"
        auth = (credentials["access_key"], credentials["secret_key"])
        
        payload = {
            "filter": {
                "fromDateTime": from_datetime,
                "toDateTime": to_datetime
            },
            "contentSelector": {
                "context": "Extended",
                "exposedFields": {
                    "parties": True,
                    "content": {"structure": True},
                    "interaction": {"speakers": True}
                }
            }
        }
        
        print(f"\n📞 Fetching up to {limit} Gong calls from last {days_back} days...")
        print(f"   Date range: {from_datetime} to {to_datetime}")
        
        response = requests.post(
            url,
            auth=auth,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=60
        )
        response.raise_for_status()
        
        calls = response.json().get('calls', [])
        print(f"✅ Found {len(calls)} calls, returning first {limit}")
        return calls[:limit]
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching Gong calls: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Response: {e.response.text[:200]}")
        return []


def fetch_gong_transcript(
    credentials: Dict[str, str],
    call_id: str,
    base_url: str = "https://api.gong.io"
) -> Optional[Dict[str, Any]]:
    """Fetch transcript for a single Gong call."""
    try:
        url = f"{base_url}/v2/calls/transcript"
        auth = (credentials["access_key"], credentials["secret_key"])
        
        payload = {"filter": {"callIds": [call_id]}}
        
        response = requests.post(
            url,
            auth=auth,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        
        transcripts = response.json().get('callTranscripts', [])
        return transcripts[0] if transcripts else None
        
    except Exception as e:
        print(f"⚠️  Could not fetch transcript for call {call_id}: {e}")
        return None


def format_transcript_as_text(
    call_data: Dict[str, Any],
    transcript_data: Optional[Dict[str, Any]]
) -> str:
    """Format transcript as readable text with names, emails, and what each person said."""
    if not transcript_data:
        return "No transcript available."
    
    # Build speaker mapping from parties
    parties = call_data.get('parties', [])
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
    
    # Parse transcript segments
    transcript_segments = transcript_data.get('transcript', [])
    if not isinstance(transcript_segments, list):
        return "Transcript format not recognized."
    
    lines = []
    lines.append("=" * 80)
    lines.append(f"Call: {call_data.get('call_metadata', {}).get('title', 'Untitled Call')}")
    lines.append(f"Date: {call_data.get('call_metadata', {}).get('started', 'Unknown')}")
    lines.append("=" * 80)
    lines.append("")
    
    for segment in transcript_segments:
        speaker_id = str(segment.get('speakerId', ''))
        speaker_info = speaker_map.get(speaker_id, {'name': 'Unknown Speaker', 'email': ''})
        
        name = speaker_info['name']
        email = speaker_info['email']
        
        # Extract sentences
        sentences = segment.get('sentences', [])
        if not sentences:
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
    
    return "\n".join(lines)


def save_transcript_to_file(
    call_data: Dict[str, Any],
    transcript_data: Optional[Dict[str, Any]],
    output_dir: str,
    index: int
) -> tuple[str, Optional[str]]:
    """Save call and transcript data to JSON file and create .txt version.
    
    Returns:
        tuple: (json_filepath, txt_filepath or None)
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract call metadata
    metadata = call_data.get('metaData', {})
    call_id = metadata.get('id', 'unknown')
    title = metadata.get('title', 'Untitled Call')
    started = metadata.get('started', '')
    
    # Sanitize filename
    safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()[:50]
    safe_title = safe_title.replace(' ', '_')
    
    # Save JSON file
    json_filename = f"{index:02d}_{call_id}_{safe_title}.json"
    json_filepath = os.path.join(output_dir, json_filename)
    
    # Prepare output data
    output_data = {
        "call_id": call_id,
        "title": title,
        "started": started,
        "duration_seconds": metadata.get('duration'),
        "call_metadata": metadata,
        "parties": call_data.get('parties', []),
        "transcript": transcript_data,
        "has_transcript": transcript_data is not None
    }
    
    # Add transcript text if available
    if transcript_data:
        transcript_text = transcript_data.get('transcript', '')
        if isinstance(transcript_text, list):
            # Join transcript parts if it's a list
            transcript_text = "\n".join(
                part.get('text', '') if isinstance(part, dict) else str(part)
                for part in transcript_text
            )
        output_data["transcript_text"] = transcript_text
        output_data["transcript_length"] = len(transcript_text) if transcript_text else 0
    
    with open(json_filepath, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False, default=str)
    
    # Save .txt file if transcript is available
    txt_filepath = None
    if transcript_data:
        txt_filename = f"{index:02d}_{call_id}_{safe_title}.txt"
        txt_filepath = os.path.join(output_dir, txt_filename)
        
        # Create a copy of call_data with call_metadata for formatting
        formatted_call_data = {
            'call_metadata': metadata,
            'parties': call_data.get('parties', [])
        }
        
        text_content = format_transcript_as_text(formatted_call_data, transcript_data)
        
        with open(txt_filepath, 'w', encoding='utf-8') as f:
            f.write(text_content)
    
    return json_filepath, txt_filepath


def load_themes_json(file_path: str = "themes.json") -> Optional[Dict[str, Any]]:
    """Load themes from JSON file."""
    # Try multiple possible locations
    possible_paths = [
        file_path,
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), file_path),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), file_path),
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    themes = json.load(f)
                    print(f"✅ Loaded themes from: {path}")
                    return themes
            except Exception as e:
                print(f"⚠️  Error loading themes from {path}: {e}")
    
    print(f"⚠️  Themes file not found. Tried: {possible_paths}")
    return None


def get_langfuse_client():
    """Get Langfuse client."""
    try:
        from langfuse import Langfuse
        
        if not settings.LANGFUSE_SECRET_KEY or not settings.LANGFUSE_PUBLIC_KEY:
            print("❌ Langfuse credentials not configured")
            return None
        
        client = Langfuse(
            secret_key=settings.LANGFUSE_SECRET_KEY,
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            host=settings.LANGFUSE_HOST,
        )
        return client
    except Exception as e:
        print(f"❌ Failed to initialize Langfuse client: {e}")
        return None


def get_or_create_dataset(client, dataset_name: str = "transcripts"):
    """Get or create a Langfuse dataset."""
    try:
        # Try to get existing dataset
        try:
            datasets = client.get_datasets()
            # Handle different response formats
            dataset_list = datasets.data if hasattr(datasets, 'data') else datasets
            for dataset in dataset_list:
                if hasattr(dataset, 'name') and dataset.name == dataset_name:
                    print(f"✅ Using existing dataset: {dataset_name}")
                    return dataset
        except Exception as e:
            print(f"   ⚠️  Could not list datasets: {e}, will try to create")
        
        # Create new dataset if not found
        dataset = client.create_dataset(name=dataset_name)
        print(f"✅ Created new dataset: {dataset_name}")
        return dataset
    except Exception as e:
        print(f"❌ Failed to get/create dataset: {e}")
        return None


def process_transcript_with_prompt(
    transcript_text: str,
    themes_json: Optional[Dict[str, Any]],
    prompt_name: str = "classification prompt",
    prompt_label: Optional[str] = "production"
) -> Optional[Dict[str, Any]]:
    """Process transcript using Langfuse prompt and OpenAI."""
    try:
        from openai import OpenAI
        
        # Get Langfuse client and prompt
        langfuse_client = get_langfuse_client()
        if not langfuse_client:
            print("   ⚠️  Langfuse client not available, skipping AI processing")
            return None
        
        # Fetch prompt from Langfuse with label
        try:
            if prompt_label:
                prompt = langfuse_client.get_prompt(prompt_name, label=prompt_label, type="chat")
            else:
                prompt = langfuse_client.get_prompt(prompt_name, type="chat")
            
            # Debug: Check prompt type
            prompt_type = getattr(prompt, 'type', None) or getattr(prompt, 'prompt_type', None)
            print(f"   📋 Prompt type: {prompt_type}, Version: {getattr(prompt, 'version', 'unknown')}")
            
        except Exception as e:
            print(f"   ⚠️  Could not fetch prompt '{prompt_name}' (label: {prompt_label}) from Langfuse: {e}")
            return None
        
        # Prepare variables for prompt
        variables = {
            "TRANSCRIPT": transcript_text
        }
        
        if themes_json:
            variables["THEMES_JSON"] = json.dumps(themes_json, indent=2)
        
        # Compile prompt with variables
        try:
            compiled = prompt.compile(**variables)
        except Exception as e:
            print(f"   ⚠️  Error compiling prompt: {e}")
            return None
        
        # Debug: Check what we got
        print(f"   🔍 Compiled result type: {type(compiled)}")
        if isinstance(compiled, str):
            print(f"   🔍 Compiled result length: {len(compiled)} chars")
        elif isinstance(compiled, list):
            print(f"   🔍 Compiled result: {len(compiled)} messages")
        
        # Handle different return types from Langfuse
        # Chat prompts should return a list of message dicts
        if isinstance(compiled, str):
            # If it's a string, the prompt might be a text prompt, not chat
            # Try to fetch as text prompt and convert to chat format
            print(f"   ⚠️  Prompt returned string instead of messages array. Treating as text prompt.")
            # Wrap in a user message
            messages = [{"role": "user", "content": compiled}]
        elif isinstance(compiled, list):
            # If it's already a list, use it directly
            messages = compiled
            # Ensure all items are dicts with role and content
            messages = [
                msg if isinstance(msg, dict) and "role" in msg and "content" in msg
                else {"role": "user", "content": str(msg)}
                for msg in messages
            ]
        else:
            # Try to convert to list if it's some other iterable
            try:
                messages = list(compiled)
            except Exception:
                print(f"   ⚠️  Unexpected prompt compile result type: {type(compiled)}")
                print(f"   ⚠️  Value: {str(compiled)[:200]}")
                return None
        
        # Final validation
        if not isinstance(messages, list):
            print(f"   ⚠️  Messages is not a list: {type(messages)}")
            return None
        
        if not messages:
            print(f"   ⚠️  Messages list is empty")
            return None
        
        # Validate each message has required fields
        for i, msg in enumerate(messages):
            if not isinstance(msg, dict):
                print(f"   ⚠️  Message {i} is not a dict: {type(msg)}")
                return None
            if "role" not in msg or "content" not in msg:
                print(f"   ⚠️  Message {i} missing 'role' or 'content': {msg.keys()}")
                return None
        
        # Call OpenAI
        if not settings.OPENAI_API_KEY:
            print("   ⚠️  OPENAI_API_KEY not configured, skipping AI processing")
            return None
        
        openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0,
            response_format={"type": "json_object"},
            max_tokens=4000
        )
        
        result = json.loads(response.choices[0].message.content)
        return result
        
    except Exception as e:
        print(f"   ⚠️  Error processing transcript with AI: {e}")
        return None


def save_classification_to_db(
    db: Session,
    workspace_id: UUID,
    call_data: Dict[str, Any],
    ai_result: Optional[Dict[str, Any]],
    processing_status: str = "completed"
) -> bool:
    """Save transcript classification to database."""
    try:
        metadata = call_data.get('metaData', {})
        call_id = metadata.get('id', 'unknown')
        title = metadata.get('title', 'Untitled Call')
        started = metadata.get('started', '')
        
        # Parse transcript date
        transcript_date = None
        if started:
            try:
                from dateutil import parser as date_parser
                transcript_date = date_parser.parse(started)
            except Exception:
                pass
        
        # Extract theme/sub_theme IDs from AI result if present
        # Check mappings array first (most common structure)
        theme_id = None
        sub_theme_id = None
        
        if ai_result:
            # Check for mappings array (primary structure)
            mappings = ai_result.get('mappings', [])
            if isinstance(mappings, list) and len(mappings) > 0:
                # Use the first mapping's theme/sub_theme IDs (most common case)
                first_mapping = mappings[0]
                if isinstance(first_mapping, dict):
                    # Try to get theme_id and sub_theme_id directly from mapping
                    theme_id_str = first_mapping.get('theme_id')
                    sub_theme_id_str = first_mapping.get('sub_theme_id')
                    
                    if theme_id_str:
                        try:
                            theme_id = UUID(theme_id_str)
                            # Verify theme exists and belongs to workspace
                            theme = db.query(Theme).filter(
                                Theme.id == theme_id,
                                Theme.workspace_id == workspace_id
                            ).first()
                            if not theme:
                                theme_id = None
                        except (ValueError, TypeError):
                            theme_id = None
                    
                    if sub_theme_id_str:
                        try:
                            sub_theme_id = UUID(sub_theme_id_str)
                            # Verify sub_theme exists and belongs to workspace
                            sub_theme = db.query(SubTheme).filter(
                                SubTheme.id == sub_theme_id,
                                SubTheme.workspace_id == workspace_id
                            ).first()
                            if not sub_theme:
                                sub_theme_id = None
                        except (ValueError, TypeError):
                            sub_theme_id = None
            
            # Fallback: Try to find theme/sub_theme by name from classification
            if not theme_id or not sub_theme_id:
                classification = ai_result.get('classification', {}) or ai_result.get('themes', {})
                
                if isinstance(classification, dict):
                    theme_name = classification.get('theme_name') or classification.get('theme')
                    sub_theme_name = classification.get('sub_theme_name') or classification.get('sub_theme')
                    
                    # Look up theme by name
                    if theme_name and not theme_id:
                        theme = db.query(Theme).filter(
                            Theme.workspace_id == workspace_id,
                            Theme.name.ilike(f"%{theme_name}%")
                        ).first()
                        if theme:
                            theme_id = theme.id
                    
                    # Look up sub_theme by name
                    if sub_theme_name and theme_id and not sub_theme_id:
                        sub_theme = db.query(SubTheme).filter(
                            SubTheme.workspace_id == workspace_id,
                            SubTheme.theme_id == theme_id,
                            SubTheme.name.ilike(f"%{sub_theme_name}%")
                        ).first()
                        if sub_theme:
                            sub_theme_id = sub_theme.id
        
        # Prepare extracted_data - store the full AI result
        extracted_data = ai_result if ai_result else {}
        
        # Extract theme_ids and sub_theme_ids arrays from all mappings
        theme_ids_list = []
        sub_theme_ids_list = []
        
        if ai_result:
            mappings = ai_result.get('mappings', [])
            if isinstance(mappings, list):
                for mapping in mappings:
                    if isinstance(mapping, dict):
                        # Extract theme_id from mapping
                        theme_id_str = mapping.get('theme_id')
                        if theme_id_str:
                            try:
                                theme_uuid = UUID(theme_id_str)
                                # Verify theme exists and belongs to workspace
                                theme = db.query(Theme).filter(
                                    Theme.id == theme_uuid,
                                    Theme.workspace_id == workspace_id
                                ).first()
                                if theme and theme_uuid not in theme_ids_list:
                                    theme_ids_list.append(theme_uuid)
                            except (ValueError, TypeError):
                                pass
                        
                        # Extract sub_theme_id from mapping
                        sub_theme_id_str = mapping.get('sub_theme_id')
                        if sub_theme_id_str:
                            try:
                                sub_theme_uuid = UUID(sub_theme_id_str)
                                # Verify sub_theme exists and belongs to workspace
                                sub_theme = db.query(SubTheme).filter(
                                    SubTheme.id == sub_theme_uuid,
                                    SubTheme.workspace_id == workspace_id
                                ).first()
                                if sub_theme and sub_theme_uuid not in sub_theme_ids_list:
                                    sub_theme_ids_list.append(sub_theme_uuid)
                            except (ValueError, TypeError):
                                pass
        
        # Check if classification already exists
        existing = db.query(TranscriptClassification).filter(
            TranscriptClassification.workspace_id == workspace_id,
            TranscriptClassification.source_type == "gong",
            TranscriptClassification.source_id == str(call_id)
        ).first()
        
        if existing:
            # Update existing classification
            existing.extracted_data = extracted_data
            existing.source_title = title
            existing.theme_id = theme_id
            existing.sub_theme_id = sub_theme_id
            existing.theme_ids = theme_ids_list if theme_ids_list else None
            existing.sub_theme_ids = sub_theme_ids_list if sub_theme_ids_list else None
            existing.processing_status = processing_status
            existing.transcript_date = transcript_date
            existing.updated_at = datetime.now(timezone.utc)
            if ai_result:
                existing.raw_ai_response = ai_result
        else:
            # Create new classification
            classification = TranscriptClassification(
                workspace_id=workspace_id,
                source_type="gong",
                source_id=str(call_id),
                source_title=title,
                theme_id=theme_id,
                sub_theme_id=sub_theme_id,
                theme_ids=theme_ids_list if theme_ids_list else None,
                sub_theme_ids=sub_theme_ids_list if sub_theme_ids_list else None,
                extracted_data=extracted_data,
                raw_ai_response=ai_result,
                processing_status=processing_status,
                transcript_date=transcript_date
            )
            db.add(classification)
        
        db.commit()
        return True
        
    except Exception as e:
        print(f"   ⚠️  Error saving classification to database: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False


def store_in_langfuse_dataset(
    client,
    dataset,
    call_data: Dict[str, Any],
    transcript_text: str,
    ai_result: Optional[Dict[str, Any]]
):
    """Store transcript in Langfuse dataset."""
    try:
        metadata = call_data.get('metaData', {})
        call_id = metadata.get('id', 'unknown')
        
        # Prepare input (what we send to the model)
        input_data = {
            "call_id": call_id,
            "title": metadata.get('title', 'Untitled Call'),
            "started": metadata.get('started', ''),
            "transcript": transcript_text[:10000],  # Limit size for dataset
        }
        
        # Prepare expected output (what the model should return)
        expected_output = ai_result if ai_result else {"status": "not_processed"}
        
        # Create dataset item - try different method signatures
        try:
            # Method 1: Direct create_item call
            if hasattr(dataset, 'create_item'):
                dataset.create_item(
                    input=input_data,
                    expected_output=expected_output
                )
            # Method 2: Use client method
            elif hasattr(client, 'create_dataset_item'):
                client.create_dataset_item(
                    dataset_name=dataset.name if hasattr(dataset, 'name') else "transcripts",
                    input=input_data,
                    expected_output=expected_output
                )
            # Method 3: Use dataset ID
            else:
                dataset_id = dataset.id if hasattr(dataset, 'id') else None
                if dataset_id:
                    client.create_dataset_item(
                        dataset_id=dataset_id,
                        input=input_data,
                        expected_output=expected_output
                    )
                else:
                    raise ValueError("Could not determine dataset ID or name")
            
            return True
        except AttributeError as e:
            print(f"   ⚠️  Dataset API method not found: {e}")
            return False
        
    except Exception as e:
        print(f"   ⚠️  Error storing in dataset: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Fetch Gong Call Transcripts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Fetch 5 transcripts for user by email
  python scripts/fetch_gong_transcripts.py --email anurag@grexit.com --limit 5

  # Fetch with custom output directory
  python scripts/fetch_gong_transcripts.py --email anurag@grexit.com --limit 5 --output-dir ./gong_transcripts

  # Fetch more transcripts (last 60 days)
  python scripts/fetch_gong_transcripts.py --email anurag@grexit.com --limit 10 --days-back 60

  # Process with Langfuse prompt and store in dataset (uses "classification prompt" with "production" label)
  python scripts/fetch_gong_transcripts.py --email anurag@grexit.com --limit 5 --use-langfuse

  # Use custom prompt name and label
  python scripts/fetch_gong_transcripts.py --email anurag@grexit.com --limit 5 --use-langfuse --prompt-name my_prompt --prompt-label latest
        """
    )
    
    parser.add_argument(
        "--email",
        type=str,
        help="User email to find workspace"
    )
    parser.add_argument(
        "--workspace-id",
        type=str,
        help="Workspace ID directly (skips email lookup)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Number of transcripts to fetch (default: 5)"
    )
    parser.add_argument(
        "--days-back",
        type=int,
        default=30,
        help="How many days back to fetch calls (default: 30)"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./gong_transcripts",
        help="Output directory for JSON files (default: ./gong_transcripts)"
    )
    parser.add_argument(
        "--use-langfuse",
        action="store_true",
        help="Process transcripts with Langfuse prompt and store in dataset"
    )
    parser.add_argument(
        "--prompt-name",
        type=str,
        default="classification prompt",
        help="Name of the Langfuse prompt to use (default: classification prompt)"
    )
    parser.add_argument(
        "--prompt-label",
        type=str,
        default="production",
        help="Label of the Langfuse prompt to use (default: production)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-processing of already processed calls (skip duplicate check)"
    )
    
    args = parser.parse_args()
    
    if not args.email and not args.workspace_id:
        print("❌ Either --email or --workspace-id is required")
        sys.exit(1)
    
    with Session(engine) as db:
        # Find workspace
        if args.workspace_id:
            workspace_id = UUID(args.workspace_id)
            workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if not workspace:
                print(f"❌ Workspace not found: {args.workspace_id}")
                sys.exit(1)
            print(f"✅ Using workspace: {workspace.name} ({workspace_id})")
        else:
            workspace_id = find_workspace_by_email(db, args.email)
            if not workspace_id:
                sys.exit(1)
        
        # Get Gong credentials
        print(f"\n🔑 Getting Gong credentials...")
        credentials = get_gong_credentials(db, workspace_id)
        if not credentials:
            sys.exit(1)
        
        # Fetch calls
        calls = fetch_gong_calls(
            credentials=credentials,
            limit=args.limit,
            days_back=args.days_back
        )
        
        if not calls:
            print(f"❌ No calls found")
            sys.exit(1)
        
        # Load themes for prompt
        print(f"\n📚 Loading themes...")
        themes_json = load_themes_json()
        
        # Initialize Langfuse for dataset storage
        langfuse_client = None
        dataset = None
        if args.use_langfuse:
            print(f"\n🔗 Initializing Langfuse...")
            langfuse_client = get_langfuse_client()
            if langfuse_client:
                dataset = get_or_create_dataset(langfuse_client, dataset_name="transcripts")
                if not dataset:
                    print("   ⚠️  Could not create/get dataset, continuing without Langfuse storage")
                    langfuse_client = None
        
        print(f"\n📝 Fetching transcripts for {len(calls)} calls...")
        
        saved_json_files = []
        saved_txt_files = []
        processed_count = 0
        stored_count = 0
        db_saved_count = 0
        skipped_count = 0
        
        for i, call in enumerate(calls, 1):
            metadata = call.get('metaData', {})
            call_id = metadata.get('id', 'unknown')
            title = metadata.get('title', 'Untitled Call')
            
            print(f"\n[{i}/{len(calls)}] Fetching transcript for: {title}")
            print(f"   Call ID: {call_id}")
            
            # Check if this call has already been processed (unless --force is used)
            if not args.force:
                existing = db.query(TranscriptClassification).filter(
                    TranscriptClassification.workspace_id == workspace_id,
                    TranscriptClassification.source_type == "gong",
                    TranscriptClassification.source_id == str(call_id)
                ).first()
                
                # Skip if already processed AND arrays are populated (fully processed)
                # If arrays are NULL, we should still process to populate them
                if existing and existing.processing_status == "completed":
                    # Check if arrays need to be populated (backfill for old records)
                    needs_backfill = (
                        existing.theme_ids is None or 
                        existing.sub_theme_ids is None or
                        len(existing.theme_ids or []) == 0 or
                        len(existing.sub_theme_ids or []) == 0
                    )
                    
                    if not needs_backfill:
                        skipped_count += 1
                        print(f"   ⏭️  Already processed (status: {existing.processing_status}), skipping AI processing...")
                        print(f"      Use --force to re-process this call")
                        # Still save files if they don't exist, but skip AI processing
                        transcript = fetch_gong_transcript(credentials, call_id)
                        if transcript:
                            json_filepath, txt_filepath = save_transcript_to_file(call, transcript, args.output_dir, i)
                            saved_json_files.append(json_filepath)
                            if txt_filepath:
                                saved_txt_files.append(txt_filepath)
                                print(f"   💾 Saved JSON: {os.path.basename(json_filepath)}")
                                print(f"   💾 Saved TXT:  {os.path.basename(txt_filepath)}")
                            else:
                                print(f"   💾 Saved JSON: {os.path.basename(json_filepath)}")
                        continue
                    else:
                        print(f"   🔄 Already processed but arrays missing, will backfill arrays...")
            
            transcript = fetch_gong_transcript(credentials, call_id)
            
            if transcript:
                transcript_text = transcript.get('transcript', '')
                if isinstance(transcript_text, list):
                    text_length = sum(len(str(p)) for p in transcript_text)
                else:
                    text_length = len(str(transcript_text)) if transcript_text else 0
                print(f"   ✅ Transcript fetched ({text_length} chars)")
            else:
                print(f"   ⚠️  No transcript available")
                transcript_text = ""
            
            # Process with Langfuse prompt if enabled
            ai_result = None
            formatted_transcript = ""
            if args.use_langfuse and transcript:
                print(f"   🤖 Processing with Langfuse prompt...")
                # Format transcript text for processing
                formatted_transcript = format_transcript_as_text(
                    {'call_metadata': metadata, 'parties': call.get('parties', [])},
                    transcript
                )
                if formatted_transcript and formatted_transcript != "No transcript available.":
                    ai_result = process_transcript_with_prompt(
                        formatted_transcript,
                        themes_json,
                        prompt_name=args.prompt_name,
                        prompt_label=args.prompt_label
                    )
                    if ai_result:
                        processed_count += 1
                        print(f"   ✅ AI processing complete")
                    else:
                        print(f"   ⚠️  AI processing failed or skipped")
                else:
                    print(f"   ⚠️  No transcript text to process")
            
            # Save classification to database if AI processing was done
            if ai_result:
                print(f"   💾 Saving classification to database...")
                if save_classification_to_db(db, workspace_id, call, ai_result):
                    db_saved_count += 1
                    print(f"   ✅ Saved to database")
                else:
                    print(f"   ⚠️  Failed to save to database")
            
            # Store in Langfuse dataset if enabled
            if langfuse_client and dataset and formatted_transcript:
                print(f"   💾 Storing in Langfuse dataset...")
                if store_in_langfuse_dataset(langfuse_client, dataset, call, formatted_transcript, ai_result):
                    stored_count += 1
                    print(f"   ✅ Stored in dataset")
                else:
                    print(f"   ⚠️  Failed to store in dataset")
            
            # Save to files (JSON and TXT)
            json_filepath, txt_filepath = save_transcript_to_file(call, transcript, args.output_dir, i)
            saved_json_files.append(json_filepath)
            if txt_filepath:
                saved_txt_files.append(txt_filepath)
                print(f"   💾 Saved JSON: {os.path.basename(json_filepath)}")
                print(f"   💾 Saved TXT:  {os.path.basename(txt_filepath)}")
            else:
                print(f"   💾 Saved JSON: {os.path.basename(json_filepath)}")
        
        print(f"\n✅ Complete! Saved {len(saved_json_files)} JSON files and {len(saved_txt_files)} TXT files to {args.output_dir}/")
        print(f"\n📊 Summary:")
        print(f"   Calls fetched: {len(calls)}")
        print(f"   Transcripts fetched: {len(saved_txt_files)}")
        if args.use_langfuse:
            print(f"   Already processed (skipped): {skipped_count}/{len(calls)}")
            print(f"   AI processed: {processed_count}/{len(calls)}")
            print(f"   Saved to database: {db_saved_count}/{len(calls)}")
            print(f"   Stored in dataset: {stored_count}/{len(calls)}")
        print(f"   Output directory: {os.path.abspath(args.output_dir)}")


if __name__ == "__main__":
    main()
