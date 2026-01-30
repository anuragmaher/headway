#!/usr/bin/env python
"""
Stage 3: Theme classification from signals.

Loads signals from all_signals.json, uses the Product Intelligence Analyst prompt
to classify them into a small set of problem themes. Writes taxonomy/global_themes.json
and taxonomy/signal_to_theme.json. Compatible with Step 4 (counts).
"""

import argparse
import json
import re
import sys
import uuid
from pathlib import Path

# Add backend to path for app imports
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from openai import OpenAI

from app.core.config import Settings

SCRIPT_DIR = Path(__file__).resolve().parent
PROMPT_PATH = SCRIPT_DIR / "prompts" / "step3_theme_classification.txt"


def _normalize(s: str) -> str:
    """Normalize for matching: strip, collapse whitespace, lowercase."""
    if not s:
        return ""
    return re.sub(r"\s+", " ", s.strip()).lower()


def load_signals(signals_dir: Path) -> list[dict]:
    """Load and flatten signals from all_signals.json. Each item: signal_id, transcript_id, problem_statement."""
    all_path = signals_dir / "all_signals.json"
    if not all_path.exists():
        return []
    data = json.loads(all_path.read_text(encoding="utf-8"))
    transcripts = data.get("transcripts", [])
    flat: list[dict] = []
    for rec in transcripts:
        tid = rec.get("transcript_id", "")
        for i, sig in enumerate(rec.get("signals", [])):
            flat.append({
                "signal_id": f"{tid}_{i}",
                "transcript_id": tid,
                "problem_statement": (sig.get("problem_statement") or "").strip(),
            })
    return flat


def load_prompt_template() -> str:
    if not PROMPT_PATH.exists():
        raise FileNotFoundError(f"Prompt not found: {PROMPT_PATH}")
    return PROMPT_PATH.read_text(encoding="utf-8")


def classify_with_llm(
    client: OpenAI,
    signals: list[dict],
    model: str = "gpt-4o-mini",
) -> list[dict]:
    """Call LLM with Product Intelligence Analyst prompt; return themes with signals_covered."""
    if not signals:
        return []

    signals_json = json.dumps(
        [{"problem_statement": s.get("problem_statement", "")} for s in signals],
        indent=2,
    )
    template = load_prompt_template()
    user_content = template.replace("{{SIGNALS_JSON}}", signals_json)

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": user_content}],
        temperature=0,
        response_format={"type": "json_object"},
        max_tokens=8000,
    )
    raw = response.choices[0].message.content
    out = json.loads(raw)
    themes = out.get("themes", [])
    return themes if isinstance(themes, list) else []


def build_global_themes_and_mapping(
    llm_themes: list[dict],
    signals: list[dict],
) -> tuple[list[dict], dict[str, dict]]:
    """
    Assign UUIDs to themes (one sub_theme per theme for Step 4 compatibility).
    Build signal_id -> {theme_id, sub_theme_id, transcript_id} by matching
    signal.problem_statement to theme.signals_covered (exact then normalized).
    """
    global_themes: list[dict] = []
    signal_to_theme: dict[str, dict] = {}
    # theme index -> (theme_id, sub_theme_id) for mapping
    theme_ids: list[tuple[str, str]] = []

    for t in llm_themes:
        theme_id = str(uuid.uuid4())
        sub_theme_id = str(uuid.uuid4())
        theme_ids.append((theme_id, sub_theme_id))
        name = (t.get("theme_name") or "Unnamed theme").strip()
        desc = (t.get("theme_description") or "").strip()
        global_themes.append({
            "id": theme_id,
            "name": name,
            "description": desc,
            "proposed": True,
            "sub_themes": [
                {"id": sub_theme_id, "name": name, "description": desc, "proposed": True},
            ],
        })

    for sig in signals:
        signal_id = sig.get("signal_id", "")
        transcript_id = sig.get("transcript_id", "")
        ps = (sig.get("problem_statement") or "").strip()
        ps_norm = _normalize(ps)
        if not ps_norm:
            continue
        for idx, t in enumerate(llm_themes):
            if idx >= len(theme_ids):
                break
            covered = t.get("signals_covered") or []
            for raw in covered:
                raw_norm = _normalize(raw)
                if raw_norm == ps_norm or (raw or "").strip() == ps:
                    theme_id, sub_theme_id = theme_ids[idx]
                    signal_to_theme[signal_id] = {
                        "theme_id": theme_id,
                        "sub_theme_id": sub_theme_id,
                        "transcript_id": transcript_id,
                    }
                    break
            else:
                continue
            break

    return global_themes, signal_to_theme


def main() -> None:
    parser = argparse.ArgumentParser(description="Stage 3: Classify signals into problem themes.")
    parser.add_argument("--output-dir", type=str, default="./gong_signal_pipeline", help="Pipeline output root")
    parser.add_argument("--signals-dir", type=str, default=None, help="Path to signals (default: output_dir/signals)")
    parser.add_argument("--model", type=str, default="gpt-4o-mini", help="OpenAI model")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    signals_dir = Path(args.signals_dir) if args.signals_dir else (output_dir / "signals")
    taxonomy_dir = output_dir / "taxonomy"
    taxonomy_dir.mkdir(parents=True, exist_ok=True)

    if not signals_dir.exists():
        print(f"Error: {signals_dir} not found. Run Step 1 first.")
        sys.exit(1)

    signals = load_signals(signals_dir)
    if not signals:
        print("No signals found in all_signals.json. Run Step 1 first.")
        sys.exit(1)

    settings = Settings()
    if not settings.OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not set")
        sys.exit(1)
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    llm_themes = classify_with_llm(client, signals, args.model)
    if not llm_themes:
        print("No themes returned from LLM.")
        sys.exit(0)

    global_themes, signal_to_theme = build_global_themes_and_mapping(llm_themes, signals)

    with open(taxonomy_dir / "global_themes.json", "w", encoding="utf-8") as f:
        json.dump({"themes": global_themes}, f, indent=2, ensure_ascii=False, default=str)

    with open(taxonomy_dir / "signal_to_theme.json", "w", encoding="utf-8") as f:
        json.dump(signal_to_theme, f, indent=2, ensure_ascii=False, default=str)

    print(f"Done. {len(global_themes)} themes -> {taxonomy_dir}")
    print(f"  signal_to_theme: {len(signal_to_theme)} signals mapped.")


if __name__ == "__main__":
    main()
