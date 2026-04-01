#!/usr/bin/env python3
"""Build papers.json and embeddings.json from judge_papers.csv."""

import argparse
import json
import math
from pathlib import Path

import pandas as pd
from sentence_transformers import SentenceTransformer
from umap import UMAP


def repo_root() -> Path:
    """Return the repository root (parent of scripts/)."""
    return Path(__file__).resolve().parent.parent


def parse_year(val) -> int | None:
    """Convert a year value to int, or None if missing/non-numeric."""
    if pd.isna(val):
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def strip_str(val) -> str:
    """Return a stripped string; empty string for NaN/None."""
    if pd.isna(val):
        return ""
    return str(val).strip()


def build_papers(df: pd.DataFrame) -> list[dict]:
    """Convert the dataframe into the papers.json structure."""
    papers = []
    for idx, row in df.iterrows():
        papers.append(
            {
                "id": idx,
                "section": strip_str(row.get("Section", "")),
                "section2": strip_str(row.get("Section 2", "")),
                "title": strip_str(row.get("Article Name", "")),
                "venue": strip_str(row.get("Venue", "")),
                "year": parse_year(row.get("Year")),
                "authors": strip_str(row.get("Author List", "")),
                "about": strip_str(row.get("About", "")),
                "link": strip_str(row.get("Link", "")),
                "date_added": strip_str(row.get("Date added", "")),
            }
        )
    return papers


def build_embeddings(papers: list[dict]) -> dict:
    """Compute 2-D UMAP coordinates from paper descriptions."""
    texts = []
    for p in papers:
        text = p["about"] if p["about"] else p["title"]
        texts.append(text)

    print(f"  Loading sentence-transformers model 'all-MiniLM-L6-v2' …")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    print(f"  Encoding {len(texts)} texts …")
    embeddings = model.encode(texts, show_progress_bar=True)

    n_samples = len(texts)
    n_neighbors = min(15, max(2, n_samples - 1))
    print(f"  Running UMAP (n_neighbors={n_neighbors}, n_samples={n_samples}) …")

    reducer = UMAP(
        n_neighbors=n_neighbors,
        min_dist=0.1,
        n_components=2,
        metric="cosine",
        random_state=42,
    )
    coords_2d = reducer.fit_transform(embeddings)

    coords = [[round(float(x), 4), round(float(y), 4)] for x, y in coords_2d]

    return {"coords": coords, "method": "umap", "source": "about"}


def main() -> None:
    root = repo_root()

    parser = argparse.ArgumentParser(description="Build site data from CSV.")
    parser.add_argument(
        "--csv",
        default=str(root / "judge_papers.csv"),
        help="Path to the input CSV (default: <repo>/judge_papers.csv)",
    )
    parser.add_argument(
        "--outdir",
        default=str(root / "site" / "data"),
        help="Output directory for JSON files (default: <repo>/site/data)",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)
    outdir = Path(args.outdir)

    print(f"Reading {csv_path} …")
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    df = df.dropna(subset=["Article Name"])
    df = df[df["Article Name"].str.strip().astype(bool)]
    df = df.reset_index(drop=True)
    print(f"  Found {len(df)} papers.")

    print("Building papers.json …")
    papers = build_papers(df)

    outdir.mkdir(parents=True, exist_ok=True)

    papers_path = outdir / "papers.json"
    with open(papers_path, "w", encoding="utf-8") as f:
        json.dump(papers, f, ensure_ascii=False, indent=2)
    print(f"  Wrote {papers_path}")

    print("Building embeddings.json …")
    emb = build_embeddings(papers)

    emb_path = outdir / "embeddings.json"
    with open(emb_path, "w", encoding="utf-8") as f:
        json.dump(emb, f, ensure_ascii=False, indent=2)
    print(f"  Wrote {emb_path}")

    print("Done.")


if __name__ == "__main__":
    main()
