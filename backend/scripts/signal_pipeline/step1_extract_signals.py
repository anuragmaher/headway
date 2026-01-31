#!/usr/bin/env python
"""
Stage 1: Signal Extraction (per transcript).

Reads .txt (and optional .json) from input dir, extracts product signals via one LLM call
per transcript using prompts/step1_extract_signals.txt, writes signals to pipeline_output_dir/signals/.
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Add backend to path for app imports
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from openai import OpenAI

from app.core.config import Settings

SCRIPT_DIR = Path(__file__).resolve().parent
PROMPT_PATH = SCRIPT_DIR / "prompts" / "step1_extract_signals.txt"

# Max chars to send to the model (leave room for prompt + response)
MAX_TRANSCRIPT_CHARS = 60000

# Appended so the model doesn't echo placeholder text from the instructions
_EXTRACTION_SUFFIX = (
    "\n\n---\nExtract real signals from the transcript above only. "
    "Do not return the example placeholder text from the instructions."
)


def load_prompt_template() -> str:
    if not PROMPT_PATH.exists():
        raise FileNotFoundError(f"Prompt not found: {PROMPT_PATH}")
    return PROMPT_PATH.read_text(encoding="utf-8")


def _build_user_message(template: str, transcript_text: str) -> str:
    """Fill prompt template with transcript and append extraction nudge."""
    content = template.replace("{{TRANSCRIPT_TEXT}}", transcript_text or "")
    return content + _EXTRACTION_SUFFIX


def parse_filename(base: str) -> tuple[str, str]:
    """Parse {index}_{call_id}_{safe_title} -> (call_id, transcript_id)."""
    parts = base.split("_", 2)
    if len(parts) >= 2 and parts[1].isdigit():
        call_id = parts[1]
        transcript_id = f"{parts[0]}_{call_id}"
        return call_id, transcript_id
    transcript_id = base.replace(" ", "_")[:80]
    return base, transcript_id


def find_txt_files(input_dir: Path, limit: Optional[int]) -> list[Path]:
    txts = sorted(input_dir.glob("*.txt"))
    if limit is not None:
        txts = txts[:limit]
    return txts


PROCESSED_MANIFEST_NAME = "processed_transcripts.json"
LAST_BATCH_IDS_NAME = "last_batch_transcript_ids.json"


def get_processed_ids(signals_dir: Path) -> list[str]:
    """Load processed transcript IDs from manifest; if missing, bootstrap from all_signals.json."""
    manifest_path = signals_dir / PROCESSED_MANIFEST_NAME
    if manifest_path.exists():
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
            return list(data.get("processed_ids", []))
        except Exception:
            pass
    all_path = signals_dir / "all_signals.json"
    if all_path.exists():
        try:
            data = json.loads(all_path.read_text(encoding="utf-8"))
            return [r.get("transcript_id", "") for r in data.get("transcripts", []) if r.get("transcript_id")]
        except Exception:
            pass
    return []


def find_txt_files_incremental(
    input_dir: Path,
    processed_ids: list[str],
    limit: int,
) -> list[Path]:
    """Return .txt paths for transcripts not in processed_ids, up to limit, sorted by path."""
    processed_set = set(processed_ids)
    txts = sorted(input_dir.glob("*.txt"))
    out: list[Path] = []
    for p in txts:
        _, transcript_id = parse_filename(p.stem)
        if transcript_id not in processed_set:
            out.append(p)
            if len(out) >= limit:
                break
    return out


def load_transcript_and_metadata(txt_path: Path, input_dir: Path) -> tuple[str, dict]:
    text = txt_path.read_text(encoding="utf-8", errors="replace")
    if len(text) > MAX_TRANSCRIPT_CHARS:
        text = text[:MAX_TRANSCRIPT_CHARS] + "\n\n[Transcript truncated for length.]"

    json_path = input_dir / (txt_path.stem + ".json")
    meta: dict = {"call_id": "", "title": "Untitled", "started": ""}
    if json_path.exists():
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
            meta["call_id"] = data.get("call_id", data.get("call_metadata", {}).get("id", ""))
            meta["title"] = data.get("title", data.get("call_metadata", {}).get("title", "Untitled"))
            meta["started"] = data.get("started", data.get("call_metadata", {}).get("started", ""))
        except Exception:
            pass

    _, transcript_id = parse_filename(txt_path.stem)
    meta["transcript_id"] = transcript_id
    return text, meta


# API expects few messages with large content blocks (system + user), not many small messages.
OPENAI_MESSAGES_ARRAY_LIMIT = 16384


def _get_message_role_and_content(msg: dict) -> tuple[str, str]:
    """Extract role and content from a message dict or object."""
    if isinstance(msg, dict):
        return (msg.get("role", "user"), (msg.get("content") or ""))
    if hasattr(msg, "role") and hasattr(msg, "content"):
        return (getattr(msg, "role", "user"), getattr(msg, "content", "") or "")
    return ("user", str(msg))


def _consolidate_messages(messages: list) -> list[dict]:
    """
    Always send few messages with large content blocks.
    Merge by role so we get at most one system and one user message (never many small messages).
    """
    system_parts: list[str] = []
    user_parts: list[str] = []
    for msg in messages:
        role, content = _get_message_role_and_content(msg)
        if not content:
            continue
        if role == "system":
            system_parts.append(content)
        else:
            user_parts.append(content)
    # Use "" when many parts (e.g. Langfuse split into chars) to reconstruct; else "\n\n"
    sep = "" if len(system_parts) + len(user_parts) > 1000 else "\n\n"
    out: list[dict] = []
    if system_parts:
        out.append({"role": "system", "content": sep.join(system_parts)})
    if user_parts:
        out.append({"role": "user", "content": sep.join(user_parts)})
    return out if out else [{"role": "user", "content": ""}]


def _messages_to_openai_format(messages: list) -> list[dict]:
    """Convert Langfuse message list to OpenAI API format; consolidate if too long."""
    consolidated = _consolidate_messages(messages)
    out = []
    for msg in consolidated:
        if isinstance(msg, dict) and "role" in msg and "content" in msg:
            out.append(msg)
        else:
            r, c = _get_message_role_and_content(msg) if isinstance(msg, dict) else ("user", str(msg))
            out.append({"role": r, "content": c})
    return out


def _parse_asks_response(raw: str) -> list[dict]:
    """Parse LLM response: array of {Theme, Sub-Theme, Ask, Priority, Evidence}. Accepts top-level array, object with list value, or single signal object."""
    try:
        out = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(out, list):
        items = out
    elif isinstance(out, dict):
        for key in ("asks", "items", "signals", "refined", "list"):
            if isinstance(out.get(key), list):
                items = out[key]
                break
        else:
            # Single signal object (Theme/Ask keys) or dict with list value
            first_list = next((v for v in out.values() if isinstance(v, list)), None)
            if first_list is not None:
                items = first_list
            elif "Theme" in out or "Ask" in out or "theme" in out or "ask" in out:
                items = [out]
            else:
                items = []
    else:
        return []
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        # Normalize keys (prompt uses Theme, Sub-Theme, Ask, Priority, Evidence)
        theme = item.get("Theme") or item.get("theme") or ""
        sub_theme = item.get("Sub-Theme") or item.get("sub_theme") or item.get("subtheme") or ""
        ask = item.get("Ask") or item.get("ask") or ""
        priority = item.get("Priority") or item.get("priority") or "Medium"
        evidence = item.get("Evidence") or item.get("evidence") or ""
        result.append({
            "Theme": theme,
            "Sub-Theme": sub_theme,
            "Ask": ask,
            "Priority": priority,
            "Evidence": evidence,
        })
    return result


def extract_signals_for_transcript(
    client: OpenAI,
    messages: list,
    model: str = "gpt-4o-mini",
) -> list[dict]:
    openai_messages = _messages_to_openai_format(messages)
    response = client.chat.completions.create(
        model=model,
        messages=openai_messages,
        temperature=0,
        response_format={"type": "json_object"},
        max_tokens=4000,
    )
    raw = response.choices[0].message.content or "[]"
    print("--- OpenAI raw response ---")
    print(raw)
    print("--- end raw response ---")
    return _parse_asks_response(raw)


def main() -> None:
    parser = argparse.ArgumentParser(description="Stage 1: Extract product signals from transcripts.")
    parser.add_argument("--input-dir", type=str, default="./gong_transcripts", help="Directory with .txt (and .json) transcript files")
    parser.add_argument("--output-dir", type=str, default="./gong_signal_pipeline", help="Pipeline output root (signals written to output_dir/signals/)")
    parser.add_argument("--limit", type=int, default=None, help="Max number of transcripts to process")
    parser.add_argument("--model", type=str, default="gpt-4o-mini", help="OpenAI model for extraction")
    parser.add_argument("--incremental", action="store_true", help="Only process transcripts not in processed_transcripts.json; append to all_signals; update manifest")
    parser.add_argument("--manifest", type=str, default=None, help="Path to processed_transcripts.json (default: output_dir/signals/processed_transcripts.json)")
    parser.add_argument("--transcript", type=str, default=None, help="Process only this transcript file (e.g. backend/gong_transcripts/06_xxx.txt)")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    signals_dir = output_dir / "signals"
    signals_dir.mkdir(parents=True, exist_ok=True)

    if args.transcript:
        txt_path = Path(args.transcript).resolve()
        if not txt_path.is_file():
            print(f"Error: transcript file not found: {txt_path}")
            sys.exit(1)
        if txt_path.suffix.lower() != ".txt":
            print(f"Error: transcript must be a .txt file: {txt_path}")
            sys.exit(1)
        input_dir = txt_path.parent
        txt_files = [txt_path]
        print(f"Single transcript: {txt_path.name}")
    elif not input_dir.is_dir():
        print(f"Error: input dir not found: {input_dir}")
        sys.exit(1)

    settings = Settings()
    if not settings.OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not set")
        sys.exit(1)

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    prompt_template = load_prompt_template()

    if not args.transcript:
        if args.incremental:
            limit = args.limit or 50
            processed_ids = get_processed_ids(signals_dir)
            txt_files = find_txt_files_incremental(input_dir, processed_ids, limit)
            if not txt_files:
                print(f"No new transcripts (all {len(processed_ids)} already processed).")
                sys.exit(0)
            print(f"Incremental: {len(txt_files)} new transcripts (limit={limit}, already processed={len(processed_ids)})")
        else:
            txt_files = find_txt_files(input_dir, args.limit)
            if not txt_files:
                print(f"No .txt files in {input_dir}")
                sys.exit(0)

    all_records: list[dict] = []
    for i, txt_path in enumerate(txt_files, 1):
        base = txt_path.stem
        call_id, transcript_id = parse_filename(base)
        print(f"[{i}/{len(txt_files)}] {transcript_id}")

        text, meta = load_transcript_and_metadata(txt_path, input_dir)
        user_content = _build_user_message(prompt_template, text)
        messages = [{"role": "user", "content": user_content}]
        signals = extract_signals_for_transcript(client, messages, args.model)

        record = {
            "transcript_id": transcript_id,
            "call_id": meta["call_id"],
            "title": meta["title"],
            "started": meta["started"],
            "signals": signals,  # Theme, Ask, Priority, Evidence
        }
        all_records.append(record)

        # Per-transcript file for traceability
        per_file = signals_dir / f"{transcript_id}.json"
        with open(per_file, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2, ensure_ascii=False, default=str)

    if args.incremental or args.transcript:
        # Append to existing all_signals (incremental or single --transcript)
        all_path = signals_dir / "all_signals.json"
        existing: list[dict] = []
        if all_path.exists():
            try:
                data = json.loads(all_path.read_text(encoding="utf-8"))
                existing = data.get("transcripts", [])
            except Exception:
                pass
        # For single transcript: replace existing entry for same transcript_id if present
        if args.transcript and all_records:
            new_id = all_records[0]["transcript_id"]
            existing = [r for r in existing if r.get("transcript_id") != new_id]
        combined = existing + all_records
        with open(all_path, "w", encoding="utf-8") as f:
            json.dump({"transcripts": combined}, f, indent=2, ensure_ascii=False, default=str)
        # Update processed manifest
        new_ids = [r["transcript_id"] for r in all_records]
        processed_ids_updated = list(dict.fromkeys(get_processed_ids(signals_dir) + new_ids))
        manifest_path = Path(args.manifest) if args.manifest else (signals_dir / PROCESSED_MANIFEST_NAME)
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump({
                "processed_ids": processed_ids_updated,
                "updated_at": datetime.utcnow().isoformat() + "Z",
            }, f, indent=2)
        # Last batch for Step 6
        with open(signals_dir / LAST_BATCH_IDS_NAME, "w", encoding="utf-8") as f:
            json.dump({"transcript_ids": new_ids}, f, indent=2)
        total_signals = sum(len(r["signals"]) for r in all_records)
        print(f"Done. {len(all_records)} new transcripts, {total_signals} signals (total {len(combined)} transcripts) -> {signals_dir}")
    else:
        # Combined file + manifest (original behavior)
        with open(signals_dir / "all_signals.json", "w", encoding="utf-8") as f:
            json.dump({"transcripts": all_records}, f, indent=2, ensure_ascii=False, default=str)
        total_signals = sum(len(r["signals"]) for r in all_records)
        manifest = {
            "stage": "step1_extract_signals",
            "transcripts_processed": len(all_records),
            "total_signals": total_signals,
            "input_dir": str(input_dir),
            "output_dir": str(signals_dir),
        }
        with open(signals_dir / "manifest.json", "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
        # Bootstrap processed_transcripts so future --incremental knows these are done
        processed_path = signals_dir / PROCESSED_MANIFEST_NAME
        with open(processed_path, "w", encoding="utf-8") as f:
            json.dump({
                "processed_ids": [r["transcript_id"] for r in all_records],
                "updated_at": datetime.utcnow().isoformat() + "Z",
            }, f, indent=2)
        print(f"Done. {len(all_records)} transcripts, {total_signals} signals -> {signals_dir}")


if __name__ == "__main__":
    main()
