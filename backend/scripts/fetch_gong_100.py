#!/usr/bin/env python
"""
Fetch Gong Transcripts (Simple - No AI)

Fetches Gong call transcripts from the Gong API and saves them to JSON and TXT files.
No Langfuse, no classification, no database. Default: 100 calls.

Usage:
    python scripts/fetch_gong_100.py --email anurag@grexit.com
    python scripts/fetch_gong_100.py --email anurag@grexit.com --limit 100 --output-dir ./gong_transcripts
    python scripts/fetch_gong_100.py --workspace-id <uuid> --limit 50
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.database import engine
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_connector import WorkspaceConnector


def find_workspace_by_email(db: Session, email: str) -> Optional[UUID]:
    """Find workspace_id by user email."""
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.workspace_id:
        return None
    return user.workspace_id


def get_gong_credentials(db: Session, workspace_id: UUID) -> Optional[Dict[str, str]]:
    """Get Gong API credentials from workspace connector."""
    connector = db.query(WorkspaceConnector).filter(
        and_(
            WorkspaceConnector.workspace_id == workspace_id,
            WorkspaceConnector.connector_type == "gong",
            WorkspaceConnector.is_active == True,
        )
    ).first()
    if not connector:
        return None
    creds = connector.credentials or {}
    access_key = creds.get("access_key")
    secret_key = creds.get("secret_key")
    if not access_key or not secret_key:
        return None
    return {"access_key": access_key, "secret_key": secret_key}


def fetch_gong_calls(
    credentials: Dict[str, str],
    limit: int = 100,
    days_back: int = 90,
    base_url: str = "https://api.gong.io",
) -> List[Dict[str, Any]]:
    """Fetch calls from Gong API with pagination support."""
    try:
        to_date = datetime.now(timezone.utc)
        from_date = to_date - timedelta(days=days_back)
        from_datetime = from_date.strftime("%Y-%m-%dT%H:%M:%S-00:00")
        to_datetime = to_date.strftime("%Y-%m-%dT%H:%M:%S-00:00")

        url = f"{base_url}/v2/calls/extensive"
        auth = (credentials["access_key"], credentials["secret_key"])

        all_calls = []
        cursor = None

        while len(all_calls) < limit:
            payload = {
                "filter": {"fromDateTime": from_datetime, "toDateTime": to_datetime},
                "contentSelector": {
                    "context": "Extended",
                    "exposedFields": {
                        "parties": True,
                        "content": {"structure": True},
                        "interaction": {"speakers": True},
                    },
                },
            }

            if cursor:
                payload["cursor"] = cursor

            response = requests.post(
                url,
                auth=auth,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=60,
            )
            response.raise_for_status()
            data = response.json()
            calls = data.get("calls", [])

            if not calls:
                break

            all_calls.extend(calls)
            print(f"  📥 Fetched {len(calls)} calls (total: {len(all_calls)})")

            # Check for more pages
            records_info = data.get("records", {})
            cursor = records_info.get("cursor")
            if not cursor:
                break

        # Sort by start date descending (latest first)
        all_calls.sort(
            key=lambda c: c.get("metaData", {}).get("started", ""),
            reverse=True,
        )

        return all_calls[:limit]
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching Gong calls: {e}")
        return []


def fetch_gong_transcript(
    credentials: Dict[str, str],
    call_id: str,
    base_url: str = "https://api.gong.io",
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
            timeout=30,
        )
        response.raise_for_status()
        transcripts = response.json().get("callTranscripts", [])
        return transcripts[0] if transcripts else None
    except Exception as e:
        print(f"⚠️  Could not fetch transcript for call {call_id}: {e}")
        return None


def format_transcript_as_text(
    call_data: Dict[str, Any],
    transcript_data: Optional[Dict[str, Any]],
) -> str:
    """Format transcript as readable text."""
    if not transcript_data:
        return "No transcript available."

    parties = call_data.get("parties", [])
    speaker_map = {}
    for party in parties:
        speaker_id = party.get("speakerId")
        if speaker_id:
            speaker_map[str(speaker_id)] = {
                "name": party.get("name", "Unknown"),
                "email": party.get("emailAddress", ""),
            }

    transcript_segments = transcript_data.get("transcript", [])
    if not isinstance(transcript_segments, list):
        return "Transcript format not recognized."

    lines = []
    metadata = call_data.get("metaData", call_data.get("call_metadata", {}))
    lines.append("=" * 80)
    lines.append(f"Call: {metadata.get('title', 'Untitled Call')}")
    lines.append(f"Date: {metadata.get('started', 'Unknown')}")
    lines.append("=" * 80)
    lines.append("")

    for segment in transcript_segments:
        speaker_id = str(segment.get("speakerId", ""))
        info = speaker_map.get(speaker_id, {"name": "Unknown Speaker", "email": ""})
        name, email = info["name"], info["email"]
        sentences = segment.get("sentences", [])
        if not sentences:
            continue
        text_parts = []
        for s in sentences:
            if isinstance(s, dict):
                t = s.get("text", "").strip()
                if t:
                    text_parts.append(t)
            elif isinstance(s, str) and s.strip():
                text_parts.append(s.strip())
        if not text_parts:
            continue
        full_text = " ".join(text_parts)
        lines.append(f"{name} ({email}):" if email else f"{name}:")
        lines.append(f"  {full_text}")
        lines.append("")

    return "\n".join(lines)


def save_transcript_to_file(
    call_data: Dict[str, Any],
    transcript_data: Optional[Dict[str, Any]],
    output_dir: str,
    index: int,
) -> tuple[str, Optional[str]]:
    """Save call + transcript to JSON and TXT. Returns (json_path, txt_path or None)."""
    os.makedirs(output_dir, exist_ok=True)

    metadata = call_data.get("metaData", {})
    call_id = metadata.get("id", "unknown")
    title = metadata.get("title", "Untitled Call")
    started = metadata.get("started", "")

    safe_title = "".join(c for c in title if c.isalnum() or c in (" ", "-", "_")).strip()[:50]
    safe_title = safe_title.replace(" ", "_")

    json_filename = f"{index:02d}_{call_id}_{safe_title}.json"
    json_filepath = os.path.join(output_dir, json_filename)

    output_data = {
        "call_id": call_id,
        "title": title,
        "started": started,
        "duration_seconds": metadata.get("duration"),
        "call_metadata": metadata,
        "parties": call_data.get("parties", []),
        "transcript": transcript_data,
        "has_transcript": transcript_data is not None,
    }
    if transcript_data:
        transcript_text = transcript_data.get("transcript", "")
        if isinstance(transcript_text, list):
            transcript_text = "\n".join(
                p.get("text", "") if isinstance(p, dict) else str(p) for p in transcript_text
            )
        output_data["transcript_text"] = transcript_text
        output_data["transcript_length"] = len(transcript_text) if transcript_text else 0

    with open(json_filepath, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False, default=str)

    txt_filepath = None
    if transcript_data:
        txt_filename = f"{index:02d}_{call_id}_{safe_title}.txt"
        txt_filepath = os.path.join(output_dir, txt_filename)
        formatted_call = {"metaData": metadata, "parties": call_data.get("parties", [])}
        text_content = format_transcript_as_text(formatted_call, transcript_data)
        with open(txt_filepath, "w", encoding="utf-8") as f:
            f.write(text_content)

    return json_filepath, txt_filepath


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch Gong transcripts (no AI). Saves JSON + TXT only.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/fetch_gong_100.py --email anurag@grexit.com
  python scripts/fetch_gong_100.py --email anurag@grexit.com --limit 100 --output-dir ./gong_transcripts
  python scripts/fetch_gong_100.py --workspace-id <uuid> --limit 50 --days-back 60
        """,
    )
    parser.add_argument("--email", type=str, help="User email to resolve workspace")
    parser.add_argument("--workspace-id", type=str, help="Workspace ID (skip email lookup)")
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Max number of calls to fetch (default: 100)",
    )
    parser.add_argument(
        "--days-back",
        type=int,
        default=90,
        help="Fetch calls from last N days (default: 90)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./gong_transcripts",
        help="Output directory for JSON and TXT files (default: ./gong_transcripts)",
    )
    args = parser.parse_args()

    if not args.email and not args.workspace_id:
        print("❌ Provide --email or --workspace-id")
        sys.exit(1)

    with Session(engine) as db:
        if args.workspace_id:
            try:
                workspace_id = UUID(args.workspace_id)
            except ValueError:
                print(f"❌ Invalid workspace-id: {args.workspace_id}")
                sys.exit(1)
            ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if not ws:
                print(f"❌ Workspace not found: {args.workspace_id}")
                sys.exit(1)
            print(f"✅ Workspace: {ws.name} ({workspace_id})")
        else:
            workspace_id = find_workspace_by_email(db, args.email)
            if not workspace_id:
                print(f"❌ User or workspace not found for: {args.email}")
                sys.exit(1)
            print(f"✅ Resolved workspace: {workspace_id}")

        credentials = get_gong_credentials(db, workspace_id)
        if not credentials:
            print("❌ No active Gong connector or credentials for this workspace")
            sys.exit(1)
        print("✅ Gong credentials found")

        calls = fetch_gong_calls(
            credentials=credentials,
            limit=args.limit,
            days_back=args.days_back,
        )
        if not calls:
            print("❌ No calls returned from Gong API")
            sys.exit(1)
        print(f"✅ Fetched {len(calls)} calls, fetching transcripts...")

        saved_json = []
        saved_txt = []
        for i, call in enumerate(calls, 1):
            meta = call.get("metaData", {})
            cid = meta.get("id", "unknown")
            title = meta.get("title", "Untitled")
            print(f"  [{i}/{len(calls)}] {title} ({cid})")
            transcript = fetch_gong_transcript(credentials, cid)
            json_path, txt_path = save_transcript_to_file(
                call, transcript, args.output_dir, i
            )
            saved_json.append(json_path)
            if txt_path:
                saved_txt.append(txt_path)

        out_abs = os.path.abspath(args.output_dir)
        print(f"\n✅ Done. {len(saved_json)} JSON, {len(saved_txt)} TXT in {out_abs}")


if __name__ == "__main__":
    main()
