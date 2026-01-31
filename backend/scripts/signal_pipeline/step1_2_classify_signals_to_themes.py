#!/usr/bin/env python
"""
Stage 1.2: Classify all signals to the theme consolidation map.

Reads all_signals.json and theme_consolidation.json, maps each signal's Theme
(raw) to its canonical theme, and writes an analysis view:
  theme (canonical) → raw_theme (next level) → [ signals with transcript context ].

Output: signals_by_theme.json — single JSON with structure:
  { "Canonical Theme": [ { "raw_theme": [ transcript+signal items ] }, ... ], ... }
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Add backend to path for app imports
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

OUTPUT_FILENAME = "signals_by_theme.json"
THEME_CONSOLIDATION_FILENAME = "theme_consolidation.json"
UNMAPPED_THEME = "Unmapped"


def build_raw_to_canonical(signals_dir: Path) -> dict[str, str]:
    """Load theme_consolidation.json; return raw_theme -> canonical_theme."""
    path = signals_dir / THEME_CONSOLIDATION_FILENAME
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    raw_to_canonical: dict[str, str] = {}
    if isinstance(data, dict) and "themes" in data:
        for theme in data["themes"]:
            canonical = (theme.get("name") or "").strip()
            if not canonical:
                continue
            # Map canonical theme name to itself so raw "AI Capabilities" -> "AI Capabilities"
            raw_to_canonical[canonical] = canonical
            for sub in theme.get("sub_themes") or []:
                raw = (sub.get("name") if isinstance(sub, dict) else str(sub)).strip()
                if raw:
                    raw_to_canonical[raw] = canonical
    else:
        for canonical, raw_list in data.items():
            if isinstance(raw_list, list):
                for raw in raw_list:
                    raw_to_canonical[str(raw).strip()] = canonical
    return raw_to_canonical


def load_all_signals(signals_dir: Path) -> list[dict[str, Any]]:
    """Load all_signals.json; return list of { transcript_id, title, started, signals }."""
    path = signals_dir / "all_signals.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return list(data.get("transcripts", []))


def build_view(
    transcripts: list[dict[str, Any]],
    raw_to_canonical: dict[str, str],
) -> dict[str, dict[str, list[dict[str, Any]]]]:
    """
    Build hierarchical view: canonical_theme -> raw_theme -> [ signal_with_transcript ].
    Each signal entry: ask, priority, evidence, transcript_id, transcript_title, started.
    """
    view: dict[str, dict[str, list[dict[str, Any]]]] = {}

    for rec in transcripts:
        transcript_id = rec.get("transcript_id") or ""
        title = rec.get("title") or ""
        started = rec.get("started") or ""
        for sig in rec.get("signals", []):
            raw_theme = (sig.get("Theme") or sig.get("theme") or "").strip()
            canonical = raw_to_canonical.get(raw_theme, UNMAPPED_THEME)
            if raw_theme == "":
                raw_theme = "(no theme)"
            entry: dict[str, Any] = {
                "ask": sig.get("Ask") or sig.get("ask") or "",
                "priority": sig.get("Priority") or sig.get("priority") or "Medium",
                "evidence": sig.get("Evidence") or sig.get("evidence") or "",
                "transcript_id": transcript_id,
                "transcript_title": title,
                "started": started,
            }
            if canonical not in view:
                view[canonical] = {}
            if raw_theme not in view[canonical]:
                view[canonical][raw_theme] = []
            view[canonical][raw_theme].append(entry)

    return view


def view_to_output_format(
    view: dict[str, dict[str, list[dict[str, Any]]]],
) -> dict[str, list[dict[str, Any]]]:
    """
    Convert canonical -> raw_theme -> [signals] to:
    canonical -> [ { raw_theme: [ transcript+signal items ] }, ... ].
    """
    out: dict[str, list[dict[str, Any]]] = {}
    for canonical, by_raw in view.items():
        out[canonical] = [{raw_theme: items} for raw_theme, items in by_raw.items()]
    return out


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Stage 1.2: Classify signals to theme map and build theme → raw_theme → signals view."
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./gong_signal_pipeline",
        help="Pipeline output root (reads/writes output_dir/signals/)",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    signals_dir = output_dir / "signals"
    signals_dir.mkdir(parents=True, exist_ok=True)

    raw_to_canonical = build_raw_to_canonical(signals_dir)
    if not raw_to_canonical:
        print(f"Error: {THEME_CONSOLIDATION_FILENAME} not found or empty in {signals_dir}")
        sys.exit(1)

    transcripts = load_all_signals(signals_dir)
    if not transcripts:
        print("Error: all_signals.json not found or has no transcripts.")
        sys.exit(1)

    view = build_view(transcripts, raw_to_canonical)
    output = view_to_output_format(view)

    out_path = signals_dir / OUTPUT_FILENAME
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    total_signals = sum(
        len(sigs)
        for by_raw in view.values()
        for sigs in by_raw.values()
    )
    unmapped_count = sum(len(sigs) for sigs in view.get(UNMAPPED_THEME, {}).values())
    print(f"Done. {len(view)} themes, {total_signals} signals -> {out_path}")
    if unmapped_count:
        print(f"  ({unmapped_count} signals under '{UNMAPPED_THEME}' — raw theme not in consolidation map)")


if __name__ == "__main__":
    main()
