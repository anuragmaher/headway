"""
Cleanup script to remove duplicate transcripts from raw_transcripts table.

Keeps only the most recent record (by created_at) for each unique
(workspace_id, source_type, source_id) combination.

Usage:
    python -m scripts.cleanup_duplicate_transcripts [--dry-run]

Options:
    --dry-run    Show what would be deleted without actually deleting
"""

import sys
import argparse
from sqlalchemy import text

# Add parent directory to path for imports
sys.path.insert(0, '.')

from app.core.database import SessionLocal


def find_duplicates(db):
    """Find all duplicate transcripts (same title + same date)."""
    query = text("""
        WITH duplicates AS (
            SELECT
                id,
                workspace_id,
                source_type,
                source_id,
                title,
                transcript_date,
                created_at,
                ROW_NUMBER() OVER (
                    PARTITION BY workspace_id, COALESCE(title, ''), DATE(COALESCE(transcript_date, created_at))
                    ORDER BY created_at DESC
                ) as row_num
            FROM raw_transcripts
        )
        SELECT id, workspace_id, source_type, source_id, title, created_at, row_num
        FROM duplicates
        WHERE row_num > 1
        ORDER BY workspace_id, title, created_at DESC
    """)

    result = db.execute(query)
    return result.fetchall()


def count_duplicates(db):
    """Count total duplicates grouped by workspace (same title + same date)."""
    query = text("""
        WITH duplicates AS (
            SELECT
                workspace_id,
                title,
                transcript_date,
                created_at,
                ROW_NUMBER() OVER (
                    PARTITION BY workspace_id, COALESCE(title, ''), DATE(COALESCE(transcript_date, created_at))
                    ORDER BY created_at DESC
                ) as row_num
            FROM raw_transcripts
        )
        SELECT
            workspace_id,
            COUNT(*) as duplicate_count
        FROM duplicates
        WHERE row_num > 1
        GROUP BY workspace_id
    """)

    result = db.execute(query)
    return result.fetchall()


def delete_duplicates(db, dry_run=False):
    """Delete duplicate transcripts (same title + date), keeping the most recent one."""

    # First, get the IDs of records to delete
    delete_query = text("""
        WITH duplicates AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY workspace_id, COALESCE(title, ''), DATE(COALESCE(transcript_date, created_at))
                    ORDER BY created_at DESC
                ) as row_num
            FROM raw_transcripts
        )
        SELECT id FROM duplicates WHERE row_num > 1
    """)

    result = db.execute(delete_query)
    ids_to_delete = [row[0] for row in result.fetchall()]

    if not ids_to_delete:
        print("No duplicates found!")
        return 0

    print(f"Found {len(ids_to_delete)} duplicate records to delete")

    if dry_run:
        print("[DRY RUN] Would delete the following IDs:")
        for id in ids_to_delete[:10]:  # Show first 10
            print(f"  - {id}")
        if len(ids_to_delete) > 10:
            print(f"  ... and {len(ids_to_delete) - 10} more")
        return len(ids_to_delete)

    # Actually delete
    # Convert UUIDs to strings for the IN clause
    id_strings = [str(id) for id in ids_to_delete]

    # Delete in batches to avoid memory issues
    batch_size = 100
    deleted_count = 0

    for i in range(0, len(id_strings), batch_size):
        batch = id_strings[i:i + batch_size]
        placeholders = ','.join([f"'{id}'" for id in batch])

        delete_stmt = text(f"""
            DELETE FROM raw_transcripts
            WHERE id IN ({placeholders})
        """)

        db.execute(delete_stmt)
        deleted_count += len(batch)
        print(f"  Deleted {deleted_count}/{len(id_strings)} records...")

    db.commit()
    print(f"Successfully deleted {deleted_count} duplicate records")

    return deleted_count


def main():
    parser = argparse.ArgumentParser(description='Cleanup duplicate transcripts')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be deleted without actually deleting')
    args = parser.parse_args()

    print("=" * 60)
    print("Duplicate Transcript Cleanup Script")
    print("=" * 60)

    db = SessionLocal()

    try:
        # Show summary by workspace
        print("\nDuplicates by workspace:")
        workspace_counts = count_duplicates(db)

        if not workspace_counts:
            print("  No duplicates found in any workspace!")
            return

        total = 0
        for workspace_id, count in workspace_counts:
            print(f"  Workspace {workspace_id}: {count} duplicates")
            total += count

        print(f"\nTotal duplicates: {total}")

        # Show some example duplicates
        print("\nSample duplicates (showing first 5):")
        duplicates = find_duplicates(db)
        for dup in duplicates[:5]:
            print(f"  ID: {dup[0]}")
            print(f"    source_type: {dup[2]}, source_id: {dup[3]}")
            print(f"    title: {dup[4][:50]}..." if dup[4] and len(dup[4]) > 50 else f"    title: {dup[4]}")
            print(f"    created_at: {dup[5]}, row_num: {dup[6]}")
            print()

        if args.dry_run:
            print("\n[DRY RUN MODE]")
        else:
            print("\nProceeding with deletion...")
            confirm = input("Are you sure you want to delete duplicates? (yes/no): ")
            if confirm.lower() != 'yes':
                print("Aborted.")
                return

        # Delete duplicates
        deleted = delete_duplicates(db, dry_run=args.dry_run)

        print(f"\n{'Would delete' if args.dry_run else 'Deleted'}: {deleted} records")

    finally:
        db.close()


if __name__ == "__main__":
    main()
