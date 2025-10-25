"""Add match_confidence and extraction_index to features table

Revision ID: b0e8e4ba20a5
Revises: 8b6016bc9e8d
Create Date: 2025-10-26 00:27:12.118830

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b0e8e4ba20a5'
down_revision = '8b6016bc9e8d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add match_confidence column (stores LLM confidence score 0.0-1.0 for feature matching)
    op.add_column('features', sa.Column('match_confidence', sa.Float(), nullable=True))

    # Add extraction_index column (tracks order of extraction from single message/call)
    op.add_column('features', sa.Column('extraction_index', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove extraction_index column
    op.drop_column('features', 'extraction_index')

    # Remove match_confidence column
    op.drop_column('features', 'match_confidence')