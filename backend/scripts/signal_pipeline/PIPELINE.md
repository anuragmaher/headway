# Signal pipeline: steps and files

Run all commands from **backend** unless noted.

Default paths: `--output-dir ./gong_signal_pipeline`, `--input-dir ./gong_transcripts`.  
Gong fetch uses DB (user/workspace/connector) for API credentials.

---

## Step 0 — Fetch Gong calls

**Script:** `scripts/fetch_gong_100.py`

**Input:** Gong API (credentials from DB: workspace connector). Identify workspace by `--email` or `--workspace-id`.

**Output:** `gong_transcripts/*.json` and `gong_transcripts/*.txt` per call (default 100 calls, last 90 days).

```bash
python3 scripts/fetch_gong_100.py --email your@email.com --limit 100 --output-dir ./gong_transcripts
```

Or by workspace UUID:

```bash
python3 scripts/fetch_gong_100.py --workspace-id <uuid> --limit 50 --output-dir ./gong_transcripts
```

These files are the input for Step 1.

---

## Step 1 — Extract signals

**Script:** `scripts/signal_pipeline/step1_extract_signals.py`

**Input:** `gong_transcripts/*.txt` (and optional `*.json` for metadata), prompt: `scripts/signal_pipeline/prompts/step1_extract_signals.txt`

**Output:** `gong_signal_pipeline/signals/all_signals.json`  
(Also: `{transcript_id}.json` per transcript, `processed_transcripts.json`)

```bash
python3 scripts/signal_pipeline/step1_extract_signals.py --input-dir gong_transcripts --output-dir gong_signal_pipeline
```

---

## Step 1.1 — Theme consolidation

**Script:** `scripts/signal_pipeline/step1_1_theme_consolidation.py`

**Input:** `gong_signal_pipeline/signals/all_signals.json`, prompt: `scripts/signal_pipeline/prompts/step1_1_theme_consolidation.txt`

**Output:** `gong_signal_pipeline/signals/theme_consolidation.json`

```bash
python3 scripts/signal_pipeline/step1_1_theme_consolidation.py --output-dir gong_signal_pipeline
```

---

## Step 1.2 — Map signals to themes (rule-based)

**Script:** `scripts/signal_pipeline/step1_2_classify_signals_to_themes.py`

**Input:**  
- `gong_signal_pipeline/signals/all_signals.json`  
- `gong_signal_pipeline/signals/theme_consolidation.json`

**Output:** `gong_signal_pipeline/signals/signals_by_theme.json`

```bash
python3 scripts/signal_pipeline/step1_2_classify_signals_to_themes.py --output-dir gong_signal_pipeline
```

---

## Step 1.3 — Final classification (LLM per signal)

**Script:** `scripts/signal_pipeline/step1_3_classify_final.py`

**Input:**  
- `gong_signal_pipeline/signals/all_signals.json`  
- `gong_signal_pipeline/signals/theme_consolidation.json`  
- `scripts/signal_pipeline/prompts/step1_3_classify_final.txt`

**Output:** `gong_signal_pipeline/signals/final.json`

```bash
python3 scripts/signal_pipeline/step1_3_classify_final.py --output-dir gong_signal_pipeline
```

---

## Build signals_by_theme from final (for dashboard)

**Script:** `scripts/signal_pipeline/build_signals_by_theme_from_final.py`

**Input:** `gong_signal_pipeline/signals/final.json`

**Output:** Overwrites `gong_signal_pipeline/signals/signals_by_theme.json` with structure derived from `final.json`.

```bash
python3 scripts/signal_pipeline/build_signals_by_theme_from_final.py --output-dir gong_signal_pipeline
```

---

## Build analysis data for dashboard

**Script:** `scripts/signal_pipeline/build_analysis.py`

**Input:** `gong_signal_pipeline/signals/signals_by_theme.json`

**Output:**  
- `gong_signal_pipeline/analysis/summary.json`  
- `gong_signal_pipeline/analysis/data/signals_by_theme.json` (copy)

```bash
python3 scripts/signal_pipeline/build_analysis.py --output-dir gong_signal_pipeline
```

---

## Serve dashboard

From repo root or anywhere:

```bash
cd gong_signal_pipeline/analysis
python3 -m http.server 8081
```

Open: **http://localhost:8081/**

---

## File flow summary

| Step | Yields |
|------|--------|
| 0 (fetch Gong) | `gong_transcripts/*.txt`, `gong_transcripts/*.json` |
| 1 | `signals/all_signals.json` |
| 1.1 | `signals/theme_consolidation.json` |
| 1.2 | `signals/signals_by_theme.json` |
| 1.3 | `signals/final.json` |
| build_signals_by_theme_from_final | overwrites `signals/signals_by_theme.json` |
| build_analysis | `analysis/summary.json`, `analysis/data/signals_by_theme.json` |
| http.server | serve `analysis/` → open http://localhost:8081/ |

Step 0 output dir defaults to `./gong_transcripts`. All other paths under `gong_signal_pipeline/` unless you pass a different `--output-dir`.
