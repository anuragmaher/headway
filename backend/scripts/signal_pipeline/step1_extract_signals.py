#!/usr/bin/env python
"""
Stage 1: Signal Extraction (per transcript).

Reads .txt (and optional .json) from input dir, extracts product signals via one LLM call
per transcript, writes signals to pipeline_output_dir/signals/.
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
from app.services.langfuse_prompt_service import get_signal_extraction_prompt


# Max chars to send to the model (leave room for prompt + response)
MAX_TRANSCRIPT_CHARS = 60000


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
    """Parse LLM response: array of {Theme, Ask, Priority, Evidence}. Accepts top-level array or object with a list value."""
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
            # First key whose value is a list
            items = next((v for v in out.values() if isinstance(v, list)), [])
    else:
        return []
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        # Normalize keys (prompt uses Theme, Ask, Priority, Evidence)
        theme = item.get("Theme") or item.get("theme") or ""
        ask = item.get("Ask") or item.get("ask") or ""
        priority = item.get("Priority") or item.get("priority") or "Medium"
        evidence = item.get("Evidence") or item.get("evidence") or ""
        result.append({
            "Theme": theme,
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
    return _parse_asks_response(raw)


def main() -> None:
    parser = argparse.ArgumentParser(description="Stage 1: Extract product signals from transcripts.")
    parser.add_argument("--input-dir", type=str, default="./gong_transcripts", help="Directory with .txt (and .json) transcript files")
    parser.add_argument("--output-dir", type=str, default="./gong_signal_pipeline", help="Pipeline output root (signals written to output_dir/signals/)")
    parser.add_argument("--limit", type=int, default=None, help="Max number of transcripts to process")
    parser.add_argument("--model", type=str, default="gpt-4o-mini", help="OpenAI model for extraction")
    parser.add_argument("--incremental", action="store_true", help="Only process transcripts not in processed_transcripts.json; append to all_signals; update manifest")
    parser.add_argument("--manifest", type=str, default=None, help="Path to processed_transcripts.json (default: output_dir/signals/processed_transcripts.json)")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    signals_dir = output_dir / "signals"
    signals_dir.mkdir(parents=True, exist_ok=True)

    if not input_dir.is_dir():
        print(f"Error: input dir not found: {input_dir}")
        sys.exit(1)

    settings = Settings()
    if not settings.OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not set")
        sys.exit(1)
    if not settings.LANGFUSE_SECRET_KEY or not settings.LANGFUSE_PUBLIC_KEY:
        print("Error: Langfuse not configured. Set LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY (Signal prompt is loaded from Langfuse).")
        sys.exit(1)

    client = OpenAI(api_key=settings.OPENAI_API_KEY)

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
        messages = get_signal_extraction_prompt(text)
        signals = extract_signals_for_transcript(client, messages, args.model)

        record = {
            "transcript_id": transcript_id,
            "call_id": meta["call_id"],
            "title": meta["title"],
            "started": meta["started"],
            "signals": signals,  # Langfuse format: Theme, Ask, Priority, Evidence
        }
        all_records.append(record)

        # Per-transcript file for traceability
        per_file = signals_dir / f"{transcript_id}.json"
        with open(per_file, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2, ensure_ascii=False, default=str)

    if args.incremental:
        # Append to existing all_signals
        all_path = signals_dir / "all_signals.json"
        existing: list[dict] = []
        if all_path.exists():
            try:
                data = json.loads(all_path.read_text(encoding="utf-8"))
                existing = data.get("transcripts", [])
            except Exception:
                pass
        combined = existing + all_records
        with open(all_path, "w", encoding="utf-8") as f:
            json.dump({"transcripts": combined}, f, indent=2, ensure_ascii=False, default=str)
        # Update processed manifest
        new_ids = [r["transcript_id"] for r in all_records]
        processed_ids_updated = get_processed_ids(signals_dir) + new_ids
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
