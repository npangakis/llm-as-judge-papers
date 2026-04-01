#!/usr/bin/env python3
"""Fetch recent LLM-as-a-Judge papers from arXiv and append to judge_papers.csv."""

import argparse
import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ARXIV_API = "http://export.arxiv.org/api/query"
ATOM_NS = "{http://www.w3.org/2005/Atom}"

SEARCH_KEYWORDS = [
    "LLM-as-a-judge",
    "LLM as a judge",
    "large language model judge",
    "language model judge",
    "judge LLM",
    "LLM judge",
    "model-based evaluation",
    "model evaluator",
    "automatic evaluator",
    "automated evaluation using LLMs",
    "LLM-based evaluation",
    "LLM evaluator",
    "generative evaluator",
]

CSV_COLUMNS = [
    "Section",
    "Section 2",
    "Article Name",
    "Venue",
    "Year",
    "Author List",
    "About",
    "Link",
    "Date added",
]


def repo_root() -> Path:
    """Return the repository root (parent of scripts/)."""
    return Path(__file__).resolve().parent.parent


def build_query() -> str:
    """Build the arXiv API query string for title + abstract search."""
    parts = []
    for kw in SEARCH_KEYWORDS:
        escaped = f'"{kw}"'
        parts.append(f"ti:{escaped}")
        parts.append(f"abs:{escaped}")
    return " OR ".join(parts)


def fetch_arxiv_papers(max_results: int = 200) -> list[dict]:
    """Query arXiv API and return parsed paper entries."""
    query = build_query()
    # Sort by submitted date descending to get newest first
    params = {
        "search_query": query,
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }
    url = f"{ARXIV_API}?{urllib.parse.urlencode(params)}"

    print(f"Querying arXiv API …")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "LLJ-Ingestion/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
    except Exception as e:
        print(f"Error fetching arXiv API: {e}", file=sys.stderr)
        return []

    # Respect rate limit
    time.sleep(3)

    root = ET.fromstring(data)
    entries = root.findall(f"{ATOM_NS}entry")
    print(f"  Received {len(entries)} entries from arXiv.")

    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    papers = []

    for entry in entries:
        published_str = entry.findtext(f"{ATOM_NS}published", "")
        try:
            published = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
        except ValueError:
            continue

        if published < cutoff:
            continue

        # Extract arXiv ID from the entry id URL
        entry_id_url = entry.findtext(f"{ATOM_NS}id", "")
        arxiv_id = extract_arxiv_id(entry_id_url)
        if not arxiv_id:
            continue

        title = entry.findtext(f"{ATOM_NS}title", "")
        title = clean_text(title)

        summary = entry.findtext(f"{ATOM_NS}summary", "")
        summary = clean_text(summary)

        authors = []
        for author_el in entry.findall(f"{ATOM_NS}author"):
            name = author_el.findtext(f"{ATOM_NS}name", "")
            if name:
                authors.append(name.strip())

        # Get the abstract page link (prefer abs link)
        link = f"https://arxiv.org/abs/{arxiv_id}"

        papers.append(
            {
                "arxiv_id": arxiv_id,
                "title": title,
                "authors": authors,
                "summary": summary,
                "published": published,
                "link": link,
                "year": published.year,
            }
        )

    print(f"  {len(papers)} papers within the last 14 days.")
    return papers


def extract_arxiv_id(url: str) -> str | None:
    """Extract arXiv ID from a URL or ID string.

    Handles formats like:
      http://arxiv.org/abs/2411.15594v1  → 2411.15594
      https://arxiv.org/abs/2411.15594   → 2411.15594
    """
    match = re.search(r"(\d{4}\.\d{4,5})(v\d+)?", url)
    if match:
        return match.group(1)
    return None


def clean_text(text: str) -> str:
    """Collapse whitespace and strip a string."""
    return re.sub(r"\s+", " ", text).strip()


def load_existing_csv(csv_path: Path) -> tuple[list[dict], set[str], set[str]]:
    """Load existing CSV and return rows, existing arXiv IDs, and existing titles."""
    existing_ids: set[str] = set()
    existing_titles: set[str] = set()
    rows: list[dict] = []

    if not csv_path.exists():
        return rows, existing_ids, existing_titles

    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
            link = row.get("Link", "")
            aid = extract_arxiv_id(link)
            if aid:
                existing_ids.add(aid)
            title = row.get("Article Name", "").strip().lower()
            if title:
                existing_titles.add(title)

    return rows, existing_ids, existing_titles


def append_papers_to_csv(csv_path: Path, new_papers: list[dict]) -> None:
    """Append new paper rows to the CSV, preserving UTF-8-sig BOM encoding."""
    if not new_papers:
        return

    # Read existing content to check if file ends with newline
    existing_content = b""
    if csv_path.exists():
        with open(csv_path, "rb") as f:
            existing_content = f.read()

    now = datetime.now()
    today = f"{now.month}/{now.day}/{now.strftime('%y')}"

    with open(csv_path, "a", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS, quoting=csv.QUOTE_MINIMAL)

        # If file doesn't end with a newline, add one
        if existing_content and not existing_content.endswith(b"\n"):
            f.write("\n")

        for paper in new_papers:
            writer.writerow(
                {
                    "Section": "",
                    "Section 2": "",
                    "Article Name": paper["title"],
                    "Venue": "arXiv",
                    "Year": paper["year"],
                    "Author List": "; ".join(paper["authors"]),
                    "About": "",
                    "Link": paper["link"],
                    "Date added": today,
                }
            )


def run_build_data() -> None:
    """Import and run build_data.py logic to recompute site data."""
    print("\nRebuilding site data (papers.json + embeddings.json) …")
    scripts_dir = Path(__file__).resolve().parent
    sys.path.insert(0, str(scripts_dir))
    import build_data

    build_data.main()


def main() -> None:
    root = repo_root()

    parser = argparse.ArgumentParser(
        description="Ingest recent LLM-as-a-Judge papers from arXiv."
    )
    parser.add_argument(
        "--csv",
        default=str(root / "judge_papers.csv"),
        help="Path to judge_papers.csv (default: <repo>/judge_papers.csv)",
    )
    parser.add_argument(
        "--rebuild-embeddings",
        action="store_true",
        help="Rebuild papers.json and embeddings.json after ingestion",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)

    # Load existing data
    print(f"Loading existing CSV: {csv_path}")
    _, existing_ids, existing_titles = load_existing_csv(csv_path)
    print(f"  {len(existing_ids)} existing arXiv IDs, {len(existing_titles)} existing titles.")

    # Fetch from arXiv
    arxiv_papers = fetch_arxiv_papers()

    # Deduplicate
    new_papers = []
    for paper in arxiv_papers:
        if paper["arxiv_id"] in existing_ids:
            continue
        if paper["title"].strip().lower() in existing_titles:
            continue
        new_papers.append(paper)

    print(f"\n{'=' * 50}")
    print(f"New papers found: {len(new_papers)}")
    print(f"{'=' * 50}")

    if new_papers:
        append_papers_to_csv(csv_path, new_papers)
        print(f"Appended {len(new_papers)} papers to {csv_path}")
    else:
        print("No new papers to add.")

    # Output summary as JSON for downstream use (e.g., email notification)
    summary = [{"title": p["title"], "link": p["link"]} for p in new_papers]
    print(f"\n::begin-summary::")
    print(json.dumps(summary, indent=2))
    print(f"::end-summary::")

    if new_papers and args.rebuild_embeddings:
        run_build_data()

    print(f"\nDone. {len(new_papers)} new papers processed.")


if __name__ == "__main__":
    main()
