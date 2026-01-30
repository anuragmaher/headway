#!/usr/bin/env python
"""
Run incremental pipeline: next N transcripts → extract signals → classify into existing themes and ask groups.

Usage:
  python scripts/signal_pipeline/run_incremental.py
  python scripts/signal_pipeline/run_incremental.py --limit 50 --config ./gong_signal_pipeline/config.json

Requires: existing taxonomy (run full pipeline Steps 1–5 first). Uses processed_transcripts.json
to determine which transcripts are new; processes up to --limit new ones, then classifies into
existing themes/ask groups and writes proposed_new_themes.json and proposed_new_asks.json for review.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent.parent


def main() -> None:
    parser = argparse.ArgumentParser(description="Run incremental: extract next N transcripts, classify into existing themes/asks.")
    parser.add_argument("--config", type=str, default=None, help="Path to config.json (default: gong_signal_pipeline/config.json)")
    parser.add_argument("--limit", type=int, default=50, help="Max new transcripts to process (default: 50)")
    parser.add_argument("--skip-step4", action="store_true", help="Do not run Step 4 after Step 6")
    args = parser.parse_args()

    config_path = Path(args.config) if args.config else (BACKEND_DIR / "gong_signal_pipeline" / "config.json")
    config: dict = {}
    if config_path.exists():
        config = json.loads(config_path.read_text(encoding="utf-8"))
    input_dir = config.get("input_transcripts_dir", "./gong_transcripts")
    output_dir = config.get("pipeline_output_dir", "./gong_signal_pipeline")
    if not Path(output_dir).is_absolute():
        output_dir = str(BACKEND_DIR / output_dir)
    if not Path(input_dir).is_absolute():
        input_dir = str(BACKEND_DIR / input_dir)
    model = (config.get("step6") or config.get("step1") or {}).get("model", "gpt-4o-mini")

    # Step 1: incremental extract
    step1 = SCRIPT_DIR / "step1_extract_signals.py"
    cmd1 = [sys.executable, str(step1), "--input-dir", input_dir, "--output-dir", output_dir, "--incremental", "--limit", str(args.limit), "--model", model]
    print("--- Step 1 (incremental): extract signals from new transcripts ---")
    ret1 = subprocess.run(cmd1, cwd=str(BACKEND_DIR))
    if ret1.returncode != 0:
        sys.exit(1)
    # If no new transcripts, Step 1 exits 0 and we skip Step 6
    last_batch = Path(output_dir) / "signals" / "last_batch_transcript_ids.json"
    if not last_batch.exists():
        print("No last_batch_transcript_ids.json; no new transcripts were processed. Exiting.")
        sys.exit(0)
    data = json.loads(last_batch.read_text(encoding="utf-8"))
    if not data.get("transcript_ids"):
        print("No new transcripts in batch. Exiting.")
        sys.exit(0)

    # Step 6: classify into existing themes and ask groups
    step6 = SCRIPT_DIR / "step6_incremental_classify.py"
    step6_model = (config.get("step6") or {}).get("model", model)
    cmd6 = [sys.executable, str(step6), "--output-dir", output_dir, "--model", step6_model]
    if args.skip_step4:
        cmd6.append("--skip-step4")
    print("\n--- Step 6: incremental classification into existing themes and ask groups ---")
    ret6 = subprocess.run(cmd6, cwd=str(BACKEND_DIR))
    if ret6.returncode != 0:
        sys.exit(1)

    print("\nIncremental run complete. Review proposed_new_themes.json and proposed_new_asks.json in taxonomy/.")


if __name__ == "__main__":
    main()
