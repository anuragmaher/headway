#!/usr/bin/env python
"""
Stage 2: Local Clustering (batch level).

Loads signals from Step 1, clusters semantically (embeddings + AgglomerativeClustering),
produces local themes per batch. Writes to pipeline_output_dir/local_themes/.
"""

import argparse
import json
import sys
from pathlib import Path

# Add backend to path for app imports
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sklearn.cluster import AgglomerativeClustering
import numpy as np

from openai import OpenAI

from app.core.config import Settings


# Default batch size (transcripts per batch)
DEFAULT_BATCH_SIZE = 30
# Min signals in a cluster to keep
MIN_SIGNALS_PER_CLUSTER = 2
# Distance threshold for AgglomerativeClustering (lower = more clusters)
DEFAULT_DISTANCE_THRESHOLD = 0.5


def load_all_signals(signals_dir: Path) -> tuple[list[dict], list[dict]]:
    """Load signals from all_signals.json. Supports Langfuse format (Theme, Ask, Priority, Evidence) and legacy format."""
    all_path = signals_dir / "all_signals.json"
    if not all_path.exists():
        raise FileNotFoundError(f"Not found: {all_path}. Run Step 1 first.")

    data = json.loads(all_path.read_text(encoding="utf-8"))
    transcripts = data.get("transcripts", data.get("transcript", []))
    if isinstance(transcripts, dict):
        transcripts = list(transcripts.values()) if isinstance(next(iter(transcripts.values()), dict), dict) else [transcripts]

    flat: list[dict] = []
    meta_by_transcript: dict[str, dict] = {}
    priority_to_confidence = {"High": "high", "Medium": "medium", "Low": "low"}
    for rec in transcripts:
        tid = rec.get("transcript_id", "")
        meta_by_transcript[tid] = {
            "transcript_id": tid,
            "call_id": rec.get("call_id", ""),
            "title": rec.get("title", ""),
            "started": rec.get("started", ""),
        }
        for i, sig in enumerate(rec.get("signals", [])):
            sig_id = f"{tid}_{i}"
            # Langfuse format: Theme, Ask, Priority, Evidence
            theme = sig.get("Theme") or sig.get("theme") or ""
            ask = sig.get("Ask") or sig.get("ask") or ""
            priority = sig.get("Priority") or sig.get("priority") or "Medium"
            evidence = sig.get("Evidence") or sig.get("evidence") or ""
            if theme or ask or evidence:
                confidence = priority_to_confidence.get(str(priority).strip(), "medium")
                flat.append({
                    "signal_id": sig_id,
                    "transcript_id": tid,
                    "theme": theme,
                    "ask": ask,
                    "priority": priority,
                    "evidence": evidence,
                    "confidence": confidence,
                })
            else:
                # Legacy format fallback
                flat.append({
                    "signal_id": sig_id,
                    "transcript_id": tid,
                    "theme": sig.get("customer_ask", "") or sig.get("problem_statement", ""),
                    "ask": sig.get("customer_ask", "") or sig.get("problem_statement", ""),
                    "priority": "Medium",
                    "evidence": sig.get("context", ""),
                    "confidence": sig.get("confidence", "medium"),
                })
    return flat, list(meta_by_transcript.values())


def filter_by_confidence(signals: list[dict], min_confidence: str) -> list[dict]:
    order = {"low": 0, "medium": 1, "high": 2}
    min_val = order.get(min_confidence, 0)
    return [s for s in signals if order.get(s.get("confidence", "low"), 0) >= min_val]


def embed_texts(client: OpenAI, texts: list[str], model: str = "text-embedding-3-small") -> np.ndarray:
    """Call OpenAI embeddings API; return (n, dim) array."""
    out = []
    chunk = 100
    for i in range(0, len(texts), chunk):
        batch = texts[i : i + chunk]
        resp = client.embeddings.create(model=model, input=[t or " " for t in batch])
        for e in resp.data:
            out.append(e.embedding)
    return np.array(out, dtype=np.float32)


def cluster_signals(
    signals: list[dict],
    embeddings: np.ndarray,
    distance_threshold: float = DEFAULT_DISTANCE_THRESHOLD,
    min_signals_per_cluster: int = MIN_SIGNALS_PER_CLUSTER,
) -> list[list[int]]:
    """Return list of clusters; each cluster is list of indices into signals."""
    if len(signals) < 2:
        return [[0]] if len(signals) == 1 else []

    clustering = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=distance_threshold,
        metric="cosine",
        linkage="average",
    )
    labels = clustering.fit_predict(embeddings)
    n_labels = int(labels.max()) + 1
    clusters: list[list[int]] = [[] for _ in range(n_labels)]
    for idx, lab in enumerate(labels):
        clusters[lab].append(idx)

    # Drop tiny clusters if requested
    if min_signals_per_cluster > 1:
        clusters = [c for c in clusters if len(c) >= min_signals_per_cluster]
    return clusters


def build_local_theme(
    cluster_indices: list[int],
    signals: list[dict],
    batch_idx: int,
    cluster_idx: int,
) -> dict:
    """Build one local theme from Ask + Theme + Evidence (Langfuse format)."""
    local_theme_id = f"batch{batch_idx:03d}_cluster{cluster_idx}"
    sigs = [signals[i] for i in cluster_indices]
    asks = [s.get("ask", "").strip() for s in sigs if s.get("ask")]
    themes = [s.get("theme", "").strip() for s in sigs if s.get("theme")]
    evidences = [s.get("evidence", "").strip() for s in sigs if s.get("evidence")]
    sample_phrasings = list(dict.fromkeys(asks + themes))[:5]
    sample_customer_asks = list(dict.fromkeys(asks))[:5]
    canonical_problem = (asks[0] if asks else themes[0] if themes else "Unnamed cluster")[:200]
    signal_ids = [signals[i]["signal_id"] for i in cluster_indices]
    return {
        "local_theme_id": local_theme_id,
        "canonical_problem": canonical_problem,
        "signal_count": len(signal_ids),
        "signal_ids": signal_ids,
        "sample_phrasings": sample_phrasings,
        "sample_customer_asks": sample_customer_asks,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Stage 2: Cluster signals into local themes.")
    parser.add_argument("--signals-dir", type=str, default=None, help="Path to signals dir (default: output_dir/signals)")
    parser.add_argument("--output-dir", type=str, default="./gong_signal_pipeline", help="Pipeline output root")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help="Transcripts per batch")
    parser.add_argument("--min-signals-per-cluster", type=int, default=MIN_SIGNALS_PER_CLUSTER, help="Min signals to form a cluster")
    parser.add_argument("--distance-threshold", type=float, default=DEFAULT_DISTANCE_THRESHOLD, help="AgglomerativeClustering distance_threshold")
    parser.add_argument("--min-confidence", type=str, default="low", choices=["low", "medium", "high"], help="Min signal confidence to include")
    parser.add_argument("--embedding-model", type=str, default="text-embedding-3-small", help="OpenAI embedding model")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    signals_dir = Path(args.signals_dir) if args.signals_dir else (output_dir / "signals")
    local_themes_dir = output_dir / "local_themes"
    local_themes_dir.mkdir(parents=True, exist_ok=True)

    settings = Settings()
    if not settings.OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not set")
        sys.exit(1)
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    flat_signals, transcript_meta = load_all_signals(signals_dir)
    if not flat_signals:
        print("No signals found. Run Step 1 first.")
        sys.exit(0)

    flat_signals = filter_by_confidence(flat_signals, args.min_confidence)
    if not flat_signals:
        print("No signals left after confidence filter.")
        sys.exit(0)

    # Group signals by transcript for batching
    by_transcript: dict[str, list[int]] = {}
    for i, s in enumerate(flat_signals):
        tid = s["transcript_id"]
        if tid not in by_transcript:
            by_transcript[tid] = []
        by_transcript[tid].append(i)
    transcript_ids_ordered = list(by_transcript.keys())

    batch_size = args.batch_size
    batch_files: list[str] = []
    total_themes = 0

    for batch_start in range(0, len(transcript_ids_ordered), batch_size):
        batch_tids = transcript_ids_ordered[batch_start : batch_start + batch_size]
        batch_signal_indices: list[int] = []
        for tid in batch_tids:
            batch_signal_indices.extend(by_transcript[tid])
        batch_signals = [flat_signals[i] for i in batch_signal_indices]

        if len(batch_signals) < 2:
            continue

        # Embed from Ask + Evidence (Langfuse format)
        texts = []
        for s in batch_signals:
            primary = (s.get("ask") or "").strip()
            extra = (s.get("evidence") or "").strip()
            texts.append((primary + " " + extra).strip()[:8000] or " ")

        embeddings = embed_texts(client, texts, args.embedding_model)
        clusters = cluster_signals(
            batch_signals,
            embeddings,
            distance_threshold=args.distance_threshold,
            min_signals_per_cluster=args.min_signals_per_cluster,
        )

        batch_idx = batch_start // batch_size + 1
        local_themes = []
        for ci, cluster_indices in enumerate(clusters):
            local_theme = build_local_theme(cluster_indices, batch_signals, batch_idx, ci)
            local_themes.append(local_theme)
            total_themes += 1

        out_path = local_themes_dir / f"batch_{batch_idx:03d}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"batch_index": batch_idx, "local_themes": local_themes}, f, indent=2, ensure_ascii=False, default=str)
        batch_files.append(out_path.name)
        print(f"Batch {batch_idx}: {len(batch_signals)} signals -> {len(local_themes)} local themes -> {out_path.name}")

    manifest = {
        "stage": "step2_cluster_signals",
        "batch_files": batch_files,
        "total_signals_processed": len(flat_signals),
        "total_local_themes": total_themes,
        "signals_dir": str(signals_dir),
        "output_dir": str(local_themes_dir),
    }
    with open(local_themes_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Done. {total_themes} local themes -> {local_themes_dir}")


if __name__ == "__main__":
    main()
