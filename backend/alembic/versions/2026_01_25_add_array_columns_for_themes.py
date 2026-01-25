"""add_array_columns_for_themes

Revision ID: add_theme_arrays
Revises: optimize_jsonb_mappings
Create Date: 2026-01-25 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'add_theme_arrays'
down_revision = 'optimize_jsonb_mappings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add array columns for theme_ids and sub_theme_ids.
    
    These columns are denormalized from extracted_data.mappings[] for:
    - Much faster queries (1-5ms vs 10-50ms)
    - Simpler SQL (ANY operator vs EXISTS subquery)
    - Better index utilization (GIN on arrays)
    """
    # Add array columns
    op.add_column(
        'transcript_classifications',
        sa.Column('theme_ids', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True)
    )
    op.add_column(
        'transcript_classifications',
        sa.Column('sub_theme_ids', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True)
    )
    
    # Create GIN indexes on arrays for fast containment queries
    op.execute("""
        CREATE INDEX idx_transcript_classifications_theme_ids 
        ON transcript_classifications 
        USING GIN (theme_ids)
    """)
    
    op.execute("""
        CREATE INDEX idx_transcript_classifications_sub_theme_ids 
        ON transcript_classifications 
        USING GIN (sub_theme_ids)
    """)
    
    # Backfill arrays from mappings
    op.execute("""
        UPDATE transcript_classifications
        SET 
            theme_ids = (
                SELECT array_agg(DISTINCT (mapping->>'theme_id')::uuid)
                FROM jsonb_array_elements(extracted_data->'mappings') AS mapping
                WHERE mapping->>'theme_id' IS NOT NULL
            ),
            sub_theme_ids = (
                SELECT array_agg(DISTINCT (mapping->>'sub_theme_id')::uuid)
                FROM jsonb_array_elements(extracted_data->'mappings') AS mapping
                WHERE mapping->>'sub_theme_id' IS NOT NULL
            )
        WHERE extracted_data->'mappings' IS NOT NULL
    """)


def downgrade() -> None:
    # Drop indexes
    op.execute("DROP INDEX IF EXISTS idx_transcript_classifications_sub_theme_ids")
    op.execute("DROP INDEX IF EXISTS idx_transcript_classifications_theme_ids")
    
    # Drop columns
    op.drop_column('transcript_classifications', 'sub_theme_ids')
    op.drop_column('transcript_classifications', 'theme_ids')
