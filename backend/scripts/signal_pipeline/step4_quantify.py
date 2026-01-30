#!/usr/bin/env python
"""
Stage 4: Quantification and Trends (no AI).

Counts signals per theme/sub_theme; optional time bucketing (month/quarter).
Writes counts/by_theme.json, counts/trends.json, counts/summary.json.
"""

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Optional

# Add backend to path for app imports
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))


def parse_date(s: str) -> Optional[datetime]:
    if not s:
        return None
    s_clean = s.replace("+00:00", "").replace("+05:30", "").replace("+0530", "").strip()
    for fmt, max_len in (("%Y-%m-%dT%H:%M:%S", 19), ("%Y-%m-%d", 10), ("%Y-%m", 7)):
        try:
            return datetime.strptime(s_clean[:max_len], fmt)
        except Exception:
            continue
    try:
        from dateutil import parser as date_parser
        return date_parser.parse(s)
    except Exception:
        return None


def load_all_signals(signals_dir: Path) -> list[dict]:
    all_path = signals_dir / "all_signals.json"
    if not all_path.exists():
        return []
    data = json.loads(all_path.read_text(encoding="utf-8"))
    transcripts = data.get("transcripts", [])
    flat = []
    for rec in transcripts:
        tid = rec.get("transcript_id", "")
        started = rec.get("started", "")
        for i in range(len(rec.get("signals", []))):
            flat.append({
                "signal_id": f"{tid}_{i}",
                "transcript_id": tid,
                "started": started,
            })
    return flat


def load_signal_to_theme(taxonomy_dir: Path) -> dict[str, dict]:
    path = taxonomy_dir / "signal_to_theme.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Stage 4: Quantify signals by theme and trends.")
    parser.add_argument("--signals-dir", type=str, default=None, help="Path to signals (default: output_dir/signals)")
    parser.add_argument("--taxonomy-dir", type=str, default=None, help="Path to taxonomy (default: output_dir/taxonomy)")
    parser.add_argument("--output-dir", type=str, default="./gong_signal_pipeline", help="Pipeline output root")
    parser.add_argument("--time-bucket", type=str, default="month", choices=["month", "quarter"], help="Time bucket for trends")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    signals_dir = Path(args.signals_dir) if args.signals_dir else (output_dir / "signals")
    taxonomy_dir = Path(args.taxonomy_dir) if args.taxonomy_dir else (output_dir / "taxonomy")
    counts_dir = output_dir / "counts"
    counts_dir.mkdir(parents=True, exist_ok=True)

    signals = load_all_signals(signals_dir)
    signal_to_theme = load_signal_to_theme(taxonomy_dir)
    if not signal_to_theme:
        print("No signal_to_theme.json found. Run Step 3 first.")
        sys.exit(1)

    # By theme and sub_theme: count + transcript_ids (evidence)
    by_theme: dict[str, dict] = defaultdict(lambda: {"count": 0, "transcript_ids": set(), "sub_themes": defaultdict(lambda: {"count": 0, "transcript_ids": set()})})
    by_sub_theme: dict[str, dict] = defaultdict(lambda: {"count": 0, "transcript_ids": set(), "theme_id": ""})

    for sig_id, m in signal_to_theme.items():
        theme_id = m.get("theme_id", "")
        sub_theme_id = m.get("sub_theme_id", "")
        transcript_id = m.get("transcript_id", "")
        if not theme_id or not sub_theme_id:
            continue
        by_theme[theme_id]["count"] += 1
        by_theme[theme_id]["transcript_ids"].add(transcript_id)
        by_theme[theme_id]["sub_themes"][sub_theme_id]["count"] += 1
        by_theme[theme_id]["sub_themes"][sub_theme_id]["transcript_ids"].add(transcript_id)
        by_sub_theme[sub_theme_id]["count"] += 1
        by_sub_theme[sub_theme_id]["transcript_ids"].add(transcript_id)
        by_sub_theme[sub_theme_id]["theme_id"] = theme_id

    by_theme_serial: dict[str, dict] = {}
    for theme_id, v in by_theme.items():
        by_theme_serial[theme_id] = {
            "count": v["count"],
            "transcript_ids": sorted(v["transcript_ids"]),
            "sub_themes": {st_id: {"count": st_v["count"], "transcript_ids": sorted(st_v["transcript_ids"])} for st_id, st_v in v["sub_themes"].items()},
        }

    with open(counts_dir / "by_theme.json", "w", encoding="utf-8") as f:
        json.dump(by_theme_serial, f, indent=2, ensure_ascii=False, default=str)

    # Trends: bucket by started date (signal_id -> started from transcripts)
    signal_started: dict[str, str] = {}
    for rec in load_all_signals(signals_dir):
        signal_started[rec["signal_id"]] = rec.get("started", "")

    trends: dict[str, dict[str, dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for sig_id, m in signal_to_theme.items():
        theme_id = m.get("theme_id", "")
        sub_theme_id = m.get("sub_theme_id", "")
        started = signal_started.get(sig_id, "")
        dt = parse_date(started)
        if dt:
            if args.time_bucket == "month":
                bucket = dt.strftime("%Y-%m")
            else:
                bucket = f"{dt.year}-Q{(dt.month - 1) // 3 + 1}"
            trends[bucket]["by_theme"][theme_id] = trends[bucket]["by_theme"].get(theme_id, 0) + 1
            trends[bucket]["by_sub_theme"][sub_theme_id] = trends[bucket]["by_sub_theme"].get(sub_theme_id, 0) + 1

    trends_serial = {k: dict(v) for k, v in sorted(trends.items())}
    with open(counts_dir / "trends.json", "w", encoding="utf-8") as f:
        json.dump(trends_serial, f, indent=2, ensure_ascii=False, default=str)

    total_signals = len(signal_to_theme)
    total_transcripts = len(set(m.get("transcript_id", "") for m in signal_to_theme.values() if m.get("transcript_id")))
    summary = {
        "total_signals_mapped": total_signals,
        "total_transcripts_with_signals": total_transcripts,
        "total_themes": len(by_theme),
        "total_sub_themes": len(by_sub_theme),
        "top_themes_by_count": sorted(by_theme.items(), key=lambda x: -x[1]["count"])[:10],
        "top_sub_themes_by_count": sorted(by_sub_theme.items(), key=lambda x: -x[1]["count"])[:10],
        "time_bucket": args.time_bucket,
    }
    # Convert top lists to serializable
    summary["top_themes_by_count"] = [{"theme_id": k, "count": v["count"]} for k, v in summary["top_themes_by_count"]]
    summary["top_sub_themes_by_count"] = [{"sub_theme_id": k, "count": v["count"], "theme_id": v["theme_id"]} for k, v in summary["top_sub_themes_by_count"]]
    with open(counts_dir / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False, default=str)

    print(f"Done. {total_signals} signals, {len(by_theme)} themes -> {counts_dir}")
    print(f"  by_theme.json, trends.json, summary.json written.")


if __name__ == "__main__":
    main()
