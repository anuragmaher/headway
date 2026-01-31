# Signal analysis dashboard

Static HTML/CSS/JS dashboard for `signals_by_theme.json`: summary cards, bar chart (signals by canonical theme), priority donut, and expandable theme → raw theme → signals table.

## Build signals_by_theme from final.json

From backend (run after step 1.3 has produced `final.json`):

```bash
python3 scripts/signal_pipeline/build_signals_by_theme_from_final.py --output-dir gong_signal_pipeline
```

This overwrites `signals/signals_by_theme.json` with a structure built from `final.json`.

## Build (copy data for dashboard)

From backend:

```bash
python3 scripts/signal_pipeline/build_analysis.py --output-dir gong_signal_pipeline
```

This writes `analysis/summary.json` and copies `signals/signals_by_theme.json` to `analysis/data/`.

## Serve

From pipeline root (`gong_signal_pipeline`):

```bash
cd gong_signal_pipeline
python3 -m http.server 8080
```

Open http://localhost:8080/analysis/ in a browser.

Or serve the `analysis` folder only:

```bash
cd gong_signal_pipeline/analysis
python3 -m http.server 8080
```

Open http://localhost:8080/
