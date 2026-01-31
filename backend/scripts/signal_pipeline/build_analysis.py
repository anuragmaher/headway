#!/usr/bin/env python
"""
Build analysis dashboard data from signals_by_theme.json.

Reads signals/signals_by_theme.json, computes summary stats, writes analysis/summary.json,
and copies signals_by_theme.json to analysis/data/ so the dashboard can be served standalone.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path
from collections import defaultdict

# Add backend to path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))


def load_signals_by_theme(signals_dir: Path) -> dict:
    path = signals_dir / "signals_by_theme.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def compute_summary(data: dict) -> dict:
    """Compute theme counts, priority breakdown, transcript coverage, top raw themes."""
    theme_signal_counts: dict[str, int] = {}
    priority_counts: dict[str, int] = defaultdict(int)
    transcript_ids: set[str] = set()
    raw_theme_counts: dict[str, int] = defaultdict(int)

    for canonical, raw_list in data.items():
        count = 0
        for item in raw_list:
            if not isinstance(item, dict):
                continue
            for raw_theme, signals in item.items():
                if not isinstance(signals, list):
                    continue
                raw_theme_counts[raw_theme] = raw_theme_counts.get(raw_theme, 0) + len(signals)
                for sig in signals:
                    if isinstance(sig, dict):
                        count += 1
                        priority_counts[sig.get("priority", "Medium")] += 1
                        tid = sig.get("transcript_id")
                        if tid:
                            transcript_ids.add(tid)
        theme_signal_counts[canonical] = count

    themes_sorted = sorted(theme_signal_counts.items(), key=lambda x: -x[1])
    raw_sorted = sorted(raw_theme_counts.items(), key=lambda x: -x[1])[:30]

    return {
        "total_signals": sum(theme_signal_counts.values()),
        "total_canonical_themes": len(theme_signal_counts),
        "total_transcripts": len(transcript_ids),
        "theme_signal_counts": dict(themes_sorted),
        "priority_counts": dict(priority_counts),
        "top_raw_themes": dict(raw_sorted),
        "transcript_count": len(transcript_ids),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build analysis dashboard data from signals_by_theme.json"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./gong_signal_pipeline",
        help="Pipeline root (signals/ and analysis/ live here)",
    )
    args = parser.parse_args()

    root = Path(args.output_dir)
    signals_dir = root / "signals"
    analysis_dir = root / "analysis"
    data_dir = analysis_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    data = load_signals_by_theme(signals_dir)
    if not data:
        print(f"Error: signals_by_theme.json not found in {signals_dir}")
        sys.exit(1)

    summary = compute_summary(data)
    summary_path = analysis_dir / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    print(f"Wrote {summary_path}")

    src = signals_dir / "signals_by_theme.json"
    dst = data_dir / "signals_by_theme.json"
    shutil.copy2(src, dst)
    print(f"Copied {src} -> {dst}")
    print("Done. Serve analysis/ with a static server (e.g. python3 -m http.server 8080 from gong_signal_pipeline).")


if __name__ == "__main__":
    main()
