#!/usr/bin/env python
"""
One-time script: backfill priority from all_signals.json into final.json,
then rebuild signals_by_theme.json so the dashboard shows High/Medium/Low.

Run from backend: python scripts/signal_pipeline/backfill_priority_to_final.py
"""

import json
import sys
from pathlib import Path

# Add backend to path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

SIGNALS_DIR_DEFAULT = BACKEND_DIR / "gong_signal_pipeline" / "signals"


def load_all_signals(signals_dir: Path) -> list[dict]:
    path = signals_dir / "all_signals.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("transcripts", [])


def build_priority_lookup(transcripts: list[dict]) -> dict[tuple[str, str], str]:
    """(transcript_id, ask) -> priority. Also (transcript_id, evidence) -> priority for fallback."""
    lookup: dict[tuple[str, str], str] = {}
    for rec in transcripts:
        tid = (rec.get("transcript_id") or "").strip()
        for sig in rec.get("signals", []):
            ask = (sig.get("Ask") or sig.get("ask") or "").strip()
            evidence = (sig.get("Evidence") or sig.get("evidence") or "").strip()
            priority = (sig.get("Priority") or sig.get("priority") or "Medium").strip()
            if tid and ask:
                lookup[(tid, ask)] = priority
            if tid and evidence:
                lookup[(tid, evidence)] = priority
    return lookup


def main() -> None:
    signals_dir = Path(__file__).resolve().parent.parent.parent / "gong_signal_pipeline" / "signals"
    if len(sys.argv) > 1:
        signals_dir = Path(sys.argv[1]).resolve()

    if not signals_dir.is_dir():
        print(f"Error: signals dir not found: {signals_dir}")
        sys.exit(1)

    transcripts = load_all_signals(signals_dir)
    if not transcripts:
        print("Error: all_signals.json not found or has no transcripts.")
        sys.exit(1)

    lookup = build_priority_lookup(transcripts)

    final_path = signals_dir / "final.json"
    if not final_path.exists():
        print(f"Error: {final_path} not found.")
        sys.exit(1)

    final = json.loads(final_path.read_text(encoding="utf-8"))
    if not isinstance(final, list):
        print("Error: final.json is not a list.")
        sys.exit(1)

    matched = 0
    for entry in final:
        if not isinstance(entry, dict):
            continue
        tid = (entry.get("transcript_id") or "").strip()
        ask = (entry.get("ask") or "").strip()
        evidence = (entry.get("evidence") or "").strip()
        priority = lookup.get((tid, ask)) or lookup.get((tid, evidence)) or "Medium"
        entry["priority"] = priority
        if priority != "Medium":
            matched += 1

    final_path.write_text(json.dumps(final, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Backfilled priority into final.json: {len(final)} entries ({matched} non-Medium from all_signals).")

    # Rebuild signals_by_theme.json (same logic as build_signals_by_theme_from_final.py)
    view: dict = {}
    UNMAPPED, NO_SUB = "Unmapped", "(no sub_theme)"
    for sig in final:
        if not isinstance(sig, dict):
            continue
        theme = (sig.get("theme") or "").strip() or UNMAPPED
        sub_theme = (sig.get("sub_theme") or "").strip() or NO_SUB
        item = {
            "ask": sig.get("ask") or "",
            "evidence": sig.get("evidence") or "",
            "transcript_id": sig.get("transcript_id") or "",
            "transcript_title": sig.get("title") or "",
            "started": sig.get("date") or "",
            "priority": sig.get("priority") or "Medium",
        }
        if theme not in view:
            view[theme] = {}
        if sub_theme not in view[theme]:
            view[theme][sub_theme] = []
        view[theme][sub_theme].append(item)

    out_format = {
        t: [{st: items} for st, items in by_sub.items()]
        for t, by_sub in view.items()
    }
    out_path = signals_dir / "signals_by_theme.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out_format, f, indent=2, ensure_ascii=False)
    total = sum(len(items) for by_sub in view.values() for items in by_sub.values())
    print(f"Rebuilt signals_by_theme.json: {len(view)} themes, {total} signals.")


if __name__ == "__main__":
    main()
