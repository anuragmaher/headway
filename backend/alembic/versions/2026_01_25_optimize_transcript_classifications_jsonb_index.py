"""optimize_transcript_classifications_jsonb_index

Revision ID: optimize_jsonb_mappings
Revises: a1b2c3d4e5f6
Create Date: 2026-01-25 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'optimize_jsonb_mappings'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add optimized index for JSONB mappings array queries.
    
    This index helps with:
    1. Fast lookups when filtering by theme_id/sub_theme_id in mappings array
    2. Better query performance using JSONB containment operators (@>)
    
    The existing GIN index on extracted_data helps, but a specific index on
    the mappings path can be more efficient for array containment queries.
    """
    # Create a GIN index specifically on the mappings array path
    # This allows PostgreSQL to efficiently search within the mappings array
    # when using containment operators like @>
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_transcript_classifications_mappings_gin 
        ON transcript_classifications 
        USING GIN ((extracted_data->'mappings'))
    """)


def downgrade() -> None:
    # Drop the optimized index
    op.execute("DROP INDEX IF EXISTS idx_transcript_classifications_mappings_gin")
