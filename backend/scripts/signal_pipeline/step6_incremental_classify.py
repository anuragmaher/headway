#!/usr/bin/env python
"""
Step 6: Incremental classification of new signals and asks.

Reads last_batch_transcript_ids.json (from Step 1 --incremental), loads new signals
from all_signals.json, then:
1. Classifies new signals into existing themes (Prompt 1); proposes new themes only if no match.
2. Per theme with new signals, classifies new customer asks into existing ask groups (Prompt 2);
   increments counts; proposes new asks only if no match.
Updates signal_to_theme.json, theme_ask_groups.json; writes proposed_new_themes.json and
proposed_new_asks.json; runs Step 4 to refresh counts. Run after Step 1 --incremental.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

# Add backend to path for app imports
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from openai import OpenAI

from app.core.config import Settings

SCRIPT_DIR = Path(__file__).resolve().parent
PROMPT_THEME = SCRIPT_DIR / "prompts" / "step6_incremental_theme.txt"
PROMPT_ASK = SCRIPT_DIR / "prompts" / "step6_incremental_ask.txt"

# Chunk size for theme classification to avoid LLM output truncation
THEME_CLASSIFY_CHUNK_SIZE = 40


def load_last_batch_ids(signals_dir: Path) -> list[str]:
    path = signals_dir / "last_batch_transcript_ids.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return list(data.get("transcript_ids", []))


def load_new_signals_from_all(signals_dir: Path, transcript_ids: list[str]) -> list[dict]:
    """From all_signals.json, return flat list of signals for given transcript_ids (signal_id, transcript_id, problem_statement, customer_ask)."""
    all_path = signals_dir / "all_signals.json"
    if not all_path.exists():
        return []
    data = json.loads(all_path.read_text(encoding="utf-8"))
    tid_set = set(transcript_ids)
    out: list[dict] = []
    for rec in data.get("transcripts", []):
        tid = rec.get("transcript_id", "")
        if tid not in tid_set:
            continue
        for i, sig in enumerate(rec.get("signals", [])):
            out.append({
                "signal_id": f"{tid}_{i}",
                "transcript_id": tid,
                "problem_statement": (sig.get("problem_statement") or "").strip(),
                "customer_ask": (sig.get("customer_ask") or "").strip(),
            })
    return out


def load_global_themes(taxonomy_dir: Path) -> list[dict]:
    path = taxonomy_dir / "global_themes.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("themes", [])


def load_signal_to_theme(taxonomy_dir: Path) -> dict[str, dict]:
    path = taxonomy_dir / "signal_to_theme.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_theme_ask_groups(taxonomy_dir: Path) -> list[dict]:
    path = taxonomy_dir / "theme_ask_groups.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("themes", [])


def classify_signals_into_themes(
    client: OpenAI,
    existing_themes: list[dict],
    new_signals: list[dict],
    model: str,
) -> dict:
    """Prompt 1: return { classified_signals, proposed_new_themes }."""
    if not new_signals:
        return {"classified_signals": [], "proposed_new_themes": []}
    themes_json = json.dumps(
        [{"id": t.get("id"), "name": t.get("name"), "description": t.get("description", "")} for t in existing_themes],
        indent=2,
    )
    signals_json = json.dumps(
        [{"signal_id": s["signal_id"], "problem_statement": s["problem_statement"], "customer_ask": s.get("customer_ask", "")} for s in new_signals],
        indent=2,
    )
    template = PROMPT_THEME.read_text(encoding="utf-8")
    user_content = template.replace("{{EXISTING_THEMES_JSON}}", themes_json).replace("{{NEW_SIGNALS_JSON}}", signals_json)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": user_content}],
        temperature=0,
        response_format={"type": "json_object"},
        max_tokens=16000,
    )
    raw = response.choices[0].message.content
    out = json.loads(raw)
    classified = out.get("classified_signals", [])
    proposed = out.get("proposed_new_themes", [])
    if not isinstance(classified, list):
        classified = []
    if not isinstance(proposed, list):
        proposed = []
    return {"classified_signals": classified, "proposed_new_themes": proposed}


def classify_asks_into_groups(
    client: OpenAI,
    theme_name: str,
    existing_ask_groups: list[dict],
    new_asks: list[dict],
    model: str,
) -> dict:
    """Prompt 2: return { ask_classification, proposed_new_asks }."""
    if not new_asks:
        return {"ask_classification": [], "proposed_new_asks": []}
    groups_json = json.dumps(
        [{"ask_name": g.get("ask_name"), "ask_description": g.get("ask_description", "")} for g in existing_ask_groups],
        indent=2,
    )
    asks_json = json.dumps(
        [{"ask_id": a["ask_id"], "customer_ask": a.get("customer_ask", "")} for a in new_asks],
        indent=2,
    )
    template = PROMPT_ASK.read_text(encoding="utf-8")
    user_content = (
        template.replace("{{THEME_NAME}}", theme_name)
        .replace("{{EXISTING_ASK_GROUPS_JSON}}", groups_json)
        .replace("{{NEW_CUSTOMER_ASKS_JSON}}", asks_json)
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
    classification = out.get("ask_classification", [])
    proposed = out.get("proposed_new_asks", [])
    if not isinstance(classification, list):
        classification = []
    if not isinstance(proposed, list):
        proposed = []
    return {"ask_classification": classification, "proposed_new_asks": proposed}


def main() -> None:
    parser = argparse.ArgumentParser(description="Step 6: Incremental classification into existing themes and ask groups.")
    parser.add_argument("--output-dir", type=str, default="./gong_signal_pipeline", help="Pipeline output root")
    parser.add_argument("--signals-dir", type=str, default=None, help="Path to signals (default: output_dir/signals)")
    parser.add_argument("--taxonomy-dir", type=str, default=None, help="Path to taxonomy (default: output_dir/taxonomy)")
    parser.add_argument("--model", type=str, default="gpt-4o-mini", help="OpenAI model")
    parser.add_argument("--skip-step4", action="store_true", help="Do not run Step 4 after updating taxonomy")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    signals_dir = Path(args.signals_dir) if args.signals_dir else (output_dir / "signals")
    taxonomy_dir = Path(args.taxonomy_dir) if args.taxonomy_dir else (output_dir / "taxonomy")

    batch_ids = load_last_batch_ids(signals_dir)
    if not batch_ids:
        print("No last_batch_transcript_ids.json found. Run Step 1 with --incremental --limit 50 first.")
        sys.exit(1)

    new_signals = load_new_signals_from_all(signals_dir, batch_ids)
    if not new_signals:
        print("No signals found for last batch transcripts.")
        sys.exit(0)

    existing_themes = load_global_themes(taxonomy_dir)
    if not existing_themes:
        print("No global_themes.json found. Run full pipeline (Steps 1–5) first.")
        sys.exit(1)

    signal_to_theme = load_signal_to_theme(taxonomy_dir)
    theme_ask_groups_data = load_theme_ask_groups(taxonomy_dir)
    theme_by_name: dict[str, dict] = {}
    for t in existing_themes:
        name = (t.get("name") or "").strip()
        if name:
            theme_by_name[name] = t

    settings = Settings()
    if not settings.OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not set")
        sys.exit(1)
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    # Prompt 1: classify signals into themes (chunked to avoid truncation)
    print("Classifying new signals into existing themes...")
    classified_signals = []
    proposed_new_themes = []
    for i in range(0, len(new_signals), THEME_CLASSIFY_CHUNK_SIZE):
        chunk = new_signals[i : i + THEME_CLASSIFY_CHUNK_SIZE]
        theme_result = classify_signals_into_themes(client, existing_themes, chunk, args.model)
        classified_signals.extend(theme_result.get("classified_signals", []))
        proposed_new_themes.extend(theme_result.get("proposed_new_themes", []))

    # Map signal_id -> (theme_id, sub_theme_id) for matched signals
    for c in classified_signals:
        sig_id = c.get("signal_id", "")
        assigned = (c.get("assigned_theme") or "").strip()
        if not assigned or not sig_id:
            continue
        theme = theme_by_name.get(assigned)
        if not theme:
            continue
        theme_id = theme.get("id", "")
        sub_themes = theme.get("sub_themes", [])
        sub_theme_id = sub_themes[0].get("id", "") if sub_themes else ""
        if not theme_id or not sub_theme_id:
            continue
        # transcript_id for this signal
        rec = next((s for s in new_signals if s.get("signal_id") == sig_id), None)
        transcript_id = rec.get("transcript_id", "") if rec else ""
        signal_to_theme[sig_id] = {"theme_id": theme_id, "sub_theme_id": sub_theme_id, "transcript_id": transcript_id}

    # Per-theme: new asks (signals assigned to this theme that have customer_ask)
    theme_id_to_new_asks: dict[str, list[dict]] = {}
    for c in classified_signals:
        sig_id = c.get("signal_id", "")
        assigned = (c.get("assigned_theme") or "").strip()
        if not assigned or not sig_id:
            continue
        theme = theme_by_name.get(assigned)
        if not theme:
            continue
        theme_id = theme.get("id", "")
        rec = next((s for s in new_signals if s.get("signal_id") == sig_id), None)
        ask = (rec.get("customer_ask") or "").strip() if rec else ""
        if not ask:
            continue
        if theme_id not in theme_id_to_new_asks:
            theme_id_to_new_asks[theme_id] = []
        theme_id_to_new_asks[theme_id].append({"ask_id": sig_id, "customer_ask": ask})

    # Prompt 2 per theme with new asks; update theme_ask_groups counts
    theme_ask_by_theme_id: dict[str, dict] = {}
    for t in theme_ask_groups_data:
        theme_ask_by_theme_id[t.get("theme_id", "")] = t

    all_proposed_new_asks: list[dict] = []
    for theme_id, asks in theme_id_to_new_asks.items():
        if not asks:
            continue
        theme_entry = theme_ask_by_theme_id.get(theme_id, {})
        theme_name = theme_entry.get("theme_name", "")
        existing_groups = theme_entry.get("ask_groups", [])
        if not theme_name or not existing_groups:
            continue
        print(f"  Classifying asks for theme: {theme_name} ({len(asks)} new asks)")
        ask_result = classify_asks_into_groups(client, theme_name, existing_groups, asks, args.model)
        classification = ask_result.get("ask_classification", [])
        proposed = ask_result.get("proposed_new_asks", [])
        for p in proposed:
            p["theme_id"] = theme_id
            p["theme_name"] = theme_name
        all_proposed_new_asks.extend(proposed)
        # Increment signals_supporting for matched ask groups
        group_by_name: dict[str, dict] = {g.get("ask_name", ""): g for g in existing_groups}
        for c in classification:
            group_name = (c.get("assigned_ask_group") or "").strip()
            if not group_name:
                continue
            g = group_by_name.get(group_name)
            if g:
                g["signals_supporting"] = g.get("signals_supporting", 0) + 1

    # Write updated signal_to_theme
    with open(taxonomy_dir / "signal_to_theme.json", "w", encoding="utf-8") as f:
        json.dump(signal_to_theme, f, indent=2, ensure_ascii=False, default=str)

    # Write updated theme_ask_groups (counts incremented)
    with open(taxonomy_dir / "theme_ask_groups.json", "w", encoding="utf-8") as f:
        json.dump({"themes": theme_ask_groups_data}, f, indent=2, ensure_ascii=False, default=str)

    # Proposals for review
    with open(taxonomy_dir / "proposed_new_themes.json", "w", encoding="utf-8") as f:
        json.dump({"proposed_new_themes": proposed_new_themes, "batch_transcript_ids": batch_ids}, f, indent=2, ensure_ascii=False, default=str)
    with open(taxonomy_dir / "proposed_new_asks.json", "w", encoding="utf-8") as f:
        json.dump({"proposed_new_asks": all_proposed_new_asks, "batch_transcript_ids": batch_ids}, f, indent=2, ensure_ascii=False, default=str)

    print(f"  Matched {len([c for c in classified_signals if (c.get('assigned_theme') or '').strip()])} signals to existing themes")
    print(f"  Proposed new themes: {len(proposed_new_themes)}")
    print(f"  Proposed new asks: {len(all_proposed_new_asks)}")

    if not args.skip_step4:
        print("Running Step 4 to refresh counts...")
        step4 = SCRIPT_DIR / "step4_quantify.py"
        ret = subprocess.run(
            [sys.executable, str(step4), "--output-dir", str(output_dir)],
            cwd=str(BACKEND_DIR),
        )
        if ret.returncode != 0:
            print("Step 4 failed.")
            sys.exit(1)

    # Clear last batch so the same batch is not re-processed if Step 6 is run again
    last_batch_path = signals_dir / "last_batch_transcript_ids.json"
    if last_batch_path.exists():
        last_batch_path.write_text(json.dumps({"transcript_ids": []}, indent=2))

    print(f"Done. signal_to_theme and theme_ask_groups updated; proposals in {taxonomy_dir}")


if __name__ == "__main__":
    main()
