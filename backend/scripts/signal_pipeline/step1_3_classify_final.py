#!/usr/bin/env python
"""
Stage 1.3: Final classification of each signal using taxonomy with ids.

Reads all_signals.json and theme_consolidation.json. For each signal, fills
prompts/step1_3_classify_final.txt with THEMES_WITH_IDS_JSON, ASK, EVIDENCE;
LLM returns theme_id, sub_theme_id. Script maps ids to theme/sub_theme names.
Writes final.json with schema: theme_id, sub_theme_id, theme, sub_theme, ask, evidence (+ transcript_id).
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Add backend to path for app imports
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from openai import OpenAI

from app.core.config import Settings

SCRIPT_DIR = Path(__file__).resolve().parent
PROMPT_PATH = SCRIPT_DIR / "prompts" / "step1_3_classify_final.txt"

THEME_CONSOLIDATION_FILENAME = "theme_consolidation.json"
OUTPUT_FILENAME = "final.json"


def load_prompt_template() -> str:
    if not PROMPT_PATH.exists():
        raise FileNotFoundError(f"Prompt not found: {PROMPT_PATH}")
    return PROMPT_PATH.read_text(encoding="utf-8")


def _build_user_message(template: str, themes_with_ids_json: str, ask: str, evidence: str) -> str:
    """Fill prompt template with taxonomy, ask, and evidence."""
    return (
        template.replace("{{THEMES_WITH_IDS_JSON}}", themes_with_ids_json)
        .replace("{{ASK}}", ask or "")
        .replace("{{EVIDENCE}}", evidence or "")
    )


def _messages_to_openai_format(user_content: str) -> list[dict]:
    """Build OpenAI messages; ensure 'json' appears for response_format json_object."""
    if "json" not in user_content.lower():
        user_content = user_content + "\n\nRespond with valid JSON only."
    return [{"role": "user", "content": user_content}]


def load_theme_consolidation(signals_dir: Path) -> dict[str, Any]:
    """Load theme_consolidation.json; return full data (themes with id, name, sub_themes)."""
    path = signals_dir / THEME_CONSOLIDATION_FILENAME
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def build_id_to_names(taxonomy: dict[str, Any]) -> tuple[dict[int, str], dict[str, str]]:
    """Build theme_id -> theme_name and sub_theme_id -> sub_theme_name from taxonomy."""
    theme_id_to_name: dict[int, str] = {}
    sub_theme_id_to_name: dict[str, str] = {}
    for theme in taxonomy.get("themes") or []:
        tid = theme.get("id")
        tname = (theme.get("name") or "").strip()
        if tid is not None:
            theme_id_to_name[int(tid)] = tname
        for sub in theme.get("sub_themes") or []:
            sid = sub.get("id")
            sname = (sub.get("name") if isinstance(sub, dict) else str(sub)).strip()
            if sid is not None:
                sub_theme_id_to_name[str(sid)] = sname
    return theme_id_to_name, sub_theme_id_to_name


def load_signals_flat(signals_dir: Path) -> list[dict[str, Any]]:
    """Load all_signals.json and flatten to list of { transcript_id, title, date, ask, evidence }."""
    path = signals_dir / "all_signals.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    flat: list[dict[str, Any]] = []
    for rec in data.get("transcripts", []):
        transcript_id = rec.get("transcript_id") or ""
        title = rec.get("title") or ""
        date = rec.get("started") or ""
        for sig in rec.get("signals", []):
            ask = (sig.get("Ask") or sig.get("ask") or "").strip()
            evidence = (sig.get("Evidence") or sig.get("evidence") or "").strip()
            flat.append({
                "transcript_id": transcript_id,
                "title": title,
                "date": date,
                "ask": ask,
                "evidence": evidence,
            })
    return flat


def parse_classification_response(raw: str) -> dict[str, Any]:
    """Parse LLM JSON to theme_id (number), sub_theme_id (string), ask, evidence."""
    try:
        out = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(out, dict):
        return {}
    theme_id = out.get("theme_id")
    if theme_id is not None and not isinstance(theme_id, int):
        try:
            theme_id = int(theme_id)
        except (TypeError, ValueError):
            theme_id = None
    sub_theme_id = out.get("sub_theme_id")
    if sub_theme_id is not None:
        sub_theme_id = str(sub_theme_id).strip() or None
    return {
        "theme_id": theme_id,
        "sub_theme_id": sub_theme_id,
        "ask": out.get("ask", ""),
        "evidence": out.get("evidence", ""),
    }


def classify_one_signal(
    client: OpenAI,
    template: str,
    themes_with_ids_json: str,
    ask: str,
    evidence: str,
    model: str = "gpt-4o-mini",
    debug: bool = False,
) -> dict[str, Any]:
    """Fill prompt template and call OpenAI; return parsed classification (theme_id, sub_theme_id, ask, evidence)."""
    if debug:
        print("--- DEBUG: variables ---")
        print("  THEMES_WITH_IDS_JSON length:", len(themes_with_ids_json))
        print("  ASK length:", len(ask), "| preview:", repr((ask or "")[:200]))
        print("  EVIDENCE length:", len(evidence), "| preview:", repr((evidence or "")[:200]))
        print("--- END DEBUG ---")
    user_content = _build_user_message(template, themes_with_ids_json, ask or "", evidence or "")
    openai_messages = _messages_to_openai_format(user_content)
    if debug:
        print("--- DEBUG: messages sent to API ---")
        print(json.dumps(openai_messages, indent=2, ensure_ascii=False))
        print("--- END DEBUG ---")
    response = client.chat.completions.create(
        model=model,
        messages=openai_messages,
        temperature=0,
        response_format={"type": "json_object"},
        max_tokens=500,
    )
    raw = response.choices[0].message.content or "{}"
    return parse_classification_response(raw)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Stage 1.3: Classify each signal to canonical themes via prompts/step1_3_classify_final.txt."
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
        help="OpenAI model for classification",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max number of signals to process (default: all)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Log the final prompt (messages sent to API) for each signal",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    signals_dir = output_dir / "signals"
    signals_dir.mkdir(parents=True, exist_ok=True)

    taxonomy = load_theme_consolidation(signals_dir)
    if not taxonomy or not taxonomy.get("themes"):
        print(f"Error: {THEME_CONSOLIDATION_FILENAME} not found or has no themes in {signals_dir}")
        sys.exit(1)

    theme_id_to_name, sub_theme_id_to_name = build_id_to_names(taxonomy)
    themes_with_ids_json = json.dumps(taxonomy, ensure_ascii=False)

    signals_flat = load_signals_flat(signals_dir)
    if not signals_flat:
        print("Error: all_signals.json not found or has no signals.")
        sys.exit(1)

    if args.limit is not None:
        signals_flat = signals_flat[: args.limit]

    settings = Settings()
    if not settings.OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not set")
        sys.exit(1)

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    prompt_template = load_prompt_template()

    results: list[dict[str, Any]] = []
    total = len(signals_flat)
    for i, sig in enumerate(signals_flat, 1):
        print(f"[{i}/{total}] Classifying signal...")
        parsed = classify_one_signal(
            client,
            prompt_template,
            themes_with_ids_json,
            sig["ask"],
            sig["evidence"],
            args.model,
            debug=args.debug,
        )
        theme_id = parsed.get("theme_id")
        sub_theme_id = parsed.get("sub_theme_id")
        theme_name = theme_id_to_name.get(theme_id, "") if theme_id is not None else ""
        sub_theme_name = sub_theme_id_to_name.get(sub_theme_id or "", "") if sub_theme_id else ""

        out_entry: dict[str, Any] = {
            "theme_id": theme_id,
            "sub_theme_id": sub_theme_id,
            "theme": theme_name,
            "sub_theme": sub_theme_name,
            "ask": sig["ask"],
            "evidence": sig["evidence"],
            "transcript_id": sig.get("transcript_id") or "",
            "title": sig.get("title") or "",
            "date": sig.get("date") or "",
        }
        results.append(out_entry)

    out_path = signals_dir / OUTPUT_FILENAME
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"Done. {len(results)} signals -> {out_path}")


if __name__ == "__main__":
    main()
