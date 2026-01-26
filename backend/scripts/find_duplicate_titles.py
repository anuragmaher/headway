"""
Script to find transcripts with duplicate titles.
This helps identify if the "duplicates" are actually different calls with the same name.

Usage:
    python -m scripts.find_duplicate_titles
"""

import sys
sys.path.insert(0, '.')

from sqlalchemy import text
from app.core.database import SessionLocal


def find_duplicate_titles(db):
    """Find transcripts with duplicate titles."""
    query = text("""
        SELECT
            title,
            COUNT(*) as count,
            array_agg(source_id) as source_ids,
            array_agg(transcript_date::text) as dates,
            array_agg(id::text) as ids
        FROM raw_transcripts
        WHERE title IS NOT NULL
        GROUP BY workspace_id, title
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 20
    """)

    result = db.execute(query)
    return result.fetchall()


def main():
    print("=" * 60)
    print("Finding Transcripts with Duplicate Titles")
    print("=" * 60)

    db = SessionLocal()

    try:
        duplicates = find_duplicate_titles(db)

        if not duplicates:
            print("\nNo transcripts with duplicate titles found!")
            return

        print(f"\nFound {len(duplicates)} titles with duplicates:\n")

        for row in duplicates:
            title = row[0]
            count = row[1]
            source_ids = row[2]
            dates = row[3]
            ids = row[4]

            print(f"Title: {title[:60]}..." if len(title) > 60 else f"Title: {title}")
            print(f"  Count: {count}")
            print(f"  Source IDs: {source_ids}")
            print(f"  Dates: {dates}")
            print(f"  DB IDs: {ids[:3]}..." if len(ids) > 3 else f"  DB IDs: {ids}")
            print()

    finally:
        db.close()


if __name__ == "__main__":
    main()
