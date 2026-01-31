#!/usr/bin/env python
"""
Stage 1.1: Theme consolidation from all signals.

Reads all_signals.json, collects distinct Theme and Sub-Theme pairs from every signal,
sends them to an LLM to produce a canonical theme → raw theme/sub-theme mapping.
Writes theme_consolidation.json to pipeline_output_dir/signals/.
"""

import argparse
import json
import sys
from pathlib import Path

# Add backend to path for app imports
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from openai import OpenAI

from app.core.config import Settings

SCRIPT_DIR = Path(__file__).resolve().parent
PROMPT_PATH = SCRIPT_DIR / "prompts" / "step1_1_theme_consolidation.txt"

OUTPUT_FILENAME = "theme_consolidation.json"


THEME_SUB_SEP = " | "


def get_distinct_theme_subtheme_entries(signals_dir: Path) -> list[str]:
    """Load all_signals.json and return sorted unique Theme and Theme|Sub-Theme entries from all signals."""
    all_path = signals_dir / "all_signals.json"
    if not all_path.exists():
        return []
    data = json.loads(all_path.read_text(encoding="utf-8"))
    entries: set[str] = set()
    for rec in data.get("transcripts", []):
        for sig in rec.get("signals", []):
            theme = (sig.get("Theme") or sig.get("theme") or "").strip()
            sub = (sig.get("Sub-Theme") or sig.get("sub_theme") or sig.get("subtheme") or "").strip()
            if theme:
                entry = f"{theme}{THEME_SUB_SEP}{sub}" if sub else theme
                entries.add(entry)
    return sorted(entries)


def load_prompt_template() -> str:
    if not PROMPT_PATH.exists():
        raise FileNotFoundError(f"Prompt not found: {PROMPT_PATH}")
    return PROMPT_PATH.read_text(encoding="utf-8")


def consolidate_themes(
    client: OpenAI,
    unique_entries: list[str],
    model: str = "gpt-4o-mini",
) -> dict[str, list[str]]:
    """Call LLM with theme consolidation prompt; return canonical_theme -> [raw theme/sub-theme entries]."""
    if not unique_entries:
        return {}
    theme_list_text = "\n".join(unique_entries)
    template = load_prompt_template()
    user_content = template.replace("{{UNIQUE_THEME_LIST}}", theme_list_text)

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": user_content}],
        temperature=0,
        response_format={"type": "json_object"},
        max_tokens=8000,
    )
    raw = response.choices[0].message.content or "{}"
    out = json.loads(raw)
    if not isinstance(out, dict):
        return {}
    result: dict[str, list[str]] = {}
    for key, val in out.items():
        if isinstance(val, list):
            result[str(key)] = [str(v) for v in val]
        else:
            result[str(key)] = [str(val)]
    return result


def add_ids(consolidated: dict[str, list[str]]) -> list[dict]:
    """Convert canonical -> [raw list] to list of themes with id and sub_themes with unique id (theme_sub e.g. 1_1, 1_2)."""
    themes_out: list[dict] = []
    theme_id = 0
    for name, raw_list in consolidated.items():
        theme_id += 1
        sub_themes = []
        for sub_idx, raw_name in enumerate(raw_list if isinstance(raw_list, list) else [raw_list], start=1):
            sub_themes.append({"id": f"{theme_id}_{sub_idx}", "name": str(raw_name).strip()})
        themes_out.append({"id": theme_id, "name": str(name).strip(), "sub_themes": sub_themes})
    return themes_out


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Stage 1.1: Consolidate raw themes from all_signals into canonical theme structure."
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./gong_signal_pipeline",
        help="Pipeline output root (reads/writes output_dir/signals/)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="gpt-4o-mini",
        help="OpenAI model for consolidation",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    signals_dir = output_dir / "signals"
    signals_dir.mkdir(parents=True, exist_ok=True)

    unique_entries = get_distinct_theme_subtheme_entries(signals_dir)
    if not unique_entries:
        print("No distinct theme/sub-theme entries found in signals (all_signals.json missing or empty).")
        sys.exit(1)

    settings = Settings()
    if not settings.OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not set")
        sys.exit(1)

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    print(f"Consolidating {len(unique_entries)} distinct theme/sub-theme entries...")
    consolidated = consolidate_themes(client, unique_entries, args.model)
    themes_with_ids = add_ids(consolidated)
    output = {"themes": themes_with_ids}

    out_path = signals_dir / OUTPUT_FILENAME
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Done. {len(themes_with_ids)} canonical themes (with ids) -> {out_path}")


if __name__ == "__main__":
    main()
