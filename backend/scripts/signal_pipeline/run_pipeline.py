#!/usr/bin/env python
"""
Orchestrator: Run Gong Signal Discovery Pipeline (Steps 1 -> 2 -> 3 -> 4 -> 5).

Usage:
  python scripts/signal_pipeline/run_pipeline.py
  python scripts/signal_pipeline/run_pipeline.py --config ./gong_signal_pipeline/config.json
  python scripts/signal_pipeline/run_pipeline.py --from 2 --to 4
  python scripts/signal_pipeline/run_pipeline.py --from 5 --to 5
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

# Script dir and backend root
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent.parent


def load_config(config_path: Path) -> dict:
    if not config_path.exists():
        return {}
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def run_step(step: int, config: dict) -> int:
    step_scripts = {
        1: "step1_extract_signals.py",
        2: "step2_cluster_signals.py",
        3: "step3_synthesize_taxonomy.py",
        4: "step4_quantify.py",
        5: "step5_group_theme_asks.py",
    }
    name = step_scripts.get(step)
    if not name:
        return 1
    script = SCRIPT_DIR / name
    if not script.exists():
        print(f"Script not found: {script}")
        return 1

    input_dir = config.get("input_transcripts_dir", "./gong_transcripts")
    output_dir = config.get("pipeline_output_dir", "./gong_signal_pipeline")
    if not Path(output_dir).is_absolute():
        output_dir = str(BACKEND_DIR / output_dir)
    if not Path(input_dir).is_absolute():
        input_dir = str(BACKEND_DIR / input_dir)

    cmd = [sys.executable, str(script)]
    if step == 1:
        cmd.extend(["--input-dir", input_dir, "--output-dir", output_dir])
        s1 = config.get("step1", {})
        if s1.get("limit") is not None:
            cmd.extend(["--limit", str(s1["limit"])])
        if s1.get("model"):
            cmd.extend(["--model", s1["model"]])
    elif step == 2:
        cmd.extend(["--output-dir", output_dir])
        s2 = config.get("step2", {})
        if s2.get("batch_size") is not None:
            cmd.extend(["--batch-size", str(s2["batch_size"])])
        if s2.get("min_signals_per_cluster") is not None:
            cmd.extend(["--min-signals-per-cluster", str(s2["min_signals_per_cluster"])])
        if s2.get("distance_threshold") is not None:
            cmd.extend(["--distance-threshold", str(s2["distance_threshold"])])
        if s2.get("min_confidence"):
            cmd.extend(["--min-confidence", s2["min_confidence"]])
        if s2.get("embedding_model"):
            cmd.extend(["--embedding-model", s2["embedding_model"]])
    elif step == 3:
        cmd.extend(["--output-dir", output_dir])
        s3 = config.get("step3", {})
        if s3.get("model"):
            cmd.extend(["--model", s3["model"]])
    elif step == 4:
        cmd.extend(["--output-dir", output_dir])
        s4 = config.get("step4", {})
        if s4.get("time_bucket"):
            cmd.extend(["--time-bucket", s4["time_bucket"]])
    elif step == 5:
        cmd.extend(["--output-dir", output_dir])
        s5 = config.get("step5", {})
        if s5.get("model"):
            cmd.extend(["--model", s5["model"]])

    print(f"\n--- Step {step}: {name} ---")
    ret = subprocess.run(cmd, cwd=str(BACKEND_DIR))
    return ret.returncode


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Gong Signal Discovery Pipeline (Steps 1-5).")
    parser.add_argument("--config", type=str, default=None, help="Path to config.json (default: pipeline_output_dir/config.json)")
    parser.add_argument("--from", dest="from_step", type=int, default=1, choices=[1, 2, 3, 4, 5], help="First step to run (default: 1)")
    parser.add_argument("--to", dest="to_step", type=int, default=4, choices=[1, 2, 3, 4, 5], help="Last step to run (default: 4)")
    args = parser.parse_args()

    output_dir = Path(args.config).parent if args.config else (BACKEND_DIR / "gong_signal_pipeline")
    config_path = Path(args.config) if args.config else (BACKEND_DIR / "gong_signal_pipeline" / "config.json")
    config = load_config(config_path)
    if config:
        output_dir = Path(config.get("pipeline_output_dir", output_dir))
        if not output_dir.is_absolute():
            output_dir = BACKEND_DIR / output_dir

    from_step = args.from_step
    to_step = args.to_step
    if from_step > to_step:
        from_step, to_step = to_step, from_step

    for step in range(from_step, to_step + 1):
        if run_step(step, config) != 0:
            print(f"Step {step} failed.")
            sys.exit(1)

    print("\nPipeline complete.")


if __name__ == "__main__":
    main()
