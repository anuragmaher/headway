#!/usr/bin/env python
"""
Step 5: Group customer asks within each theme.

For each theme, collects signals mapped to that theme, extracts customer_ask,
and uses an LLM to group asks into 2–6 deduplicated ask clusters per theme.
Writes taxonomy/theme_ask_groups.json. Run after Step 3 (and Step 4 optional).
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
PROMPT_PATH = SCRIPT_DIR / "prompts" / "step5_ask_grouping.txt"


def load_signal_to_theme(taxonomy_dir: Path) -> dict[str, dict]:
    path = taxonomy_dir / "signal_to_theme.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_global_themes(taxonomy_dir: Path) -> list[dict]:
    path = taxonomy_dir / "global_themes.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("themes", [])


def load_customer_asks_by_signal(signals_dir: Path) -> dict[str, str]:
    """Build signal_id -> customer_ask from all_signals.json. Only non-empty asks."""
    all_path = signals_dir / "all_signals.json"
    if not all_path.exists():
        return {}
    data = json.loads(all_path.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for rec in data.get("transcripts", []):
        tid = rec.get("transcript_id", "")
        for i, sig in enumerate(rec.get("signals", [])):
            ask = (sig.get("customer_ask") or "").strip()
            if ask:
                out[f"{tid}_{i}"] = ask
    return out


def collects_asks_per_theme(
    signal_to_theme: dict[str, dict],
    signal_to_ask: dict[str, str],
) -> dict[str, list[str]]:
    """theme_id -> list of customer_ask (only from mapped signals with non-empty ask)."""
    theme_asks: dict[str, list[str]] = {}
    for sig_id, m in signal_to_theme.items():
        theme_id = m.get("theme_id", "")
        if not theme_id:
            continue
        ask = signal_to_ask.get(sig_id, "")
        if not ask:
            continue
        if theme_id not in theme_asks:
            theme_asks[theme_id] = []
        theme_asks[theme_id].append(ask)
    return theme_asks


def load_prompt_template() -> str:
    if not PROMPT_PATH.exists():
        raise FileNotFoundError(f"Prompt not found: {PROMPT_PATH}")
    return PROMPT_PATH.read_text(encoding="utf-8")


def group_asks_with_llm(
    client: OpenAI,
    theme_name: str,
    asks: list[str],
    model: str = "gpt-4o-mini",
) -> dict:
    """Call LLM to group asks; return { theme, ask_groups }."""
    if not asks:
        return {"theme": theme_name, "ask_groups": []}
    template = load_prompt_template()
    asks_json = json.dumps(asks, indent=2)
    user_content = (
        template.replace("{{THEME_NAME}}", theme_name).replace("{{CUSTOMER_ASKS_JSON}}", asks_json)
    )
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": user_content}],
        temperature=0,
        response_format={"type": "json_object"},
        max_tokens=4000,
    )
    raw = response.choices[0].message.content
    out = json.loads(raw)
    ask_groups = out.get("ask_groups", [])
    if not isinstance(ask_groups, list):
        ask_groups = []
    return {"theme": out.get("theme", theme_name), "ask_groups": ask_groups}


def main() -> None:
    parser = argparse.ArgumentParser(description="Step 5: Group customer asks within each theme.")
    parser.add_argument("--output-dir", type=str, default="./gong_signal_pipeline", help="Pipeline output root")
    parser.add_argument("--signals-dir", type=str, default=None, help="Path to signals (default: output_dir/signals)")
    parser.add_argument("--taxonomy-dir", type=str, default=None, help="Path to taxonomy (default: output_dir/taxonomy)")
    parser.add_argument("--model", type=str, default="gpt-4o-mini", help="OpenAI model")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    signals_dir = Path(args.signals_dir) if args.signals_dir else (output_dir / "signals")
    taxonomy_dir = Path(args.taxonomy_dir) if args.taxonomy_dir else (output_dir / "taxonomy")

    signal_to_theme = load_signal_to_theme(taxonomy_dir)
    if not signal_to_theme:
        print("No signal_to_theme.json found. Run Step 3 first.")
        sys.exit(1)

    global_themes = load_global_themes(taxonomy_dir)
    if not global_themes:
        print("No global_themes.json found. Run Step 3 first.")
        sys.exit(1)

    signal_to_ask = load_customer_asks_by_signal(signals_dir)
    theme_asks = collects_asks_per_theme(signal_to_theme, signal_to_ask)

    theme_name_by_id = {t.get("id", ""): t.get("name", "") for t in global_themes}

    settings = Settings()
    if not settings.OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not set")
        sys.exit(1)
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    results: list[dict] = []
    for theme in global_themes:
        theme_id = theme.get("id", "")
        theme_name = theme.get("name", "") or "Unnamed theme"
        asks = theme_asks.get(theme_id, [])
        if not asks:
            results.append({
                "theme_id": theme_id,
                "theme_name": theme_name,
                "total_signals_with_ask": 0,
                "ask_groups": [],
            })
            continue
        llm_out = group_asks_with_llm(client, theme_name, asks, args.model)
        results.append({
            "theme_id": theme_id,
            "theme_name": theme_name,
            "total_signals_with_ask": len(asks),
            "ask_groups": llm_out.get("ask_groups", []),
        })
        print(f"  {theme_name}: {len(asks)} asks -> {len(llm_out.get('ask_groups', []))} ask groups")

    out_path = taxonomy_dir / "theme_ask_groups.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"themes": results}, f, indent=2, ensure_ascii=False, default=str)

    print(f"Done. {len(results)} themes -> {out_path}")


if __name__ == "__main__":
    main()
