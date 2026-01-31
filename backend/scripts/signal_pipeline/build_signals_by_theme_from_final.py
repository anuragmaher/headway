#!/usr/bin/env python
"""
Build signals_by_theme.json from final.json.

Reads signals/final.json (flat list with theme, sub_theme, ask, evidence, priority, transcript_id, title, date),
builds the same structure as step 1.2 output: theme -> [ { sub_theme: [ signal items ] }, ... ],
and overwrites signals/signals_by_theme.json.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Add backend to path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

OUTPUT_FILENAME = "signals_by_theme.json"
FINAL_FILENAME = "final.json"
UNMAPPED_THEME = "Unmapped"
NO_SUB_THEME = "(no sub_theme)"


def load_final(signals_dir: Path) -> list[dict[str, Any]]:
    path = signals_dir / FINAL_FILENAME
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else []


def build_signals_by_theme(data: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """
    Build theme -> [ { sub_theme: [ signal items ] }, ... ] from flat final.json.
    Signal item: ask, evidence, priority, transcript_id, transcript_title, started.
    """
    # theme -> sub_theme -> list of signal items
    view: dict[str, dict[str, list[dict[str, Any]]]] = {}

    for sig in data:
        if not isinstance(sig, dict):
            continue
        theme = (sig.get("theme") or "").strip() or UNMAPPED_THEME
        sub_theme = (sig.get("sub_theme") or "").strip() or NO_SUB_THEME
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

    # Convert to output format: theme -> [ { sub_theme: [ items ] }, ... ]
    return {theme: [{sub_theme: items} for sub_theme, items in by_sub.items()] for theme, by_sub in view.items()}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build signals_by_theme.json from final.json and overwrite it."
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./gong_signal_pipeline",
        help="Pipeline root (reads/writes output_dir/signals/)",
    )
    args = parser.parse_args()

    root = Path(args.output_dir)
    signals_dir = root / "signals"
    signals_dir.mkdir(parents=True, exist_ok=True)

    data = load_final(signals_dir)
    if not data:
        print(f"Error: {FINAL_FILENAME} not found or empty in {signals_dir}")
        sys.exit(1)

    view = build_signals_by_theme(data)
    out_path = signals_dir / OUTPUT_FILENAME
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(view, f, indent=2, ensure_ascii=False)

    total = sum(len(items) for by_sub in view.values() for obj in by_sub for items in obj.values())
    print(f"Done. {len(view)} themes, {total} signals -> {out_path}")


if __name__ == "__main__":
    main()
