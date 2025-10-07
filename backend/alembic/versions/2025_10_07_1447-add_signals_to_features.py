"""add_signals_to_features

Revision ID: add_signals_to_features
Revises: f83c8eac3df4
Create Date: 2025-10-07 14:47:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_signals_to_features'
down_revision = 'f83c8eac3df4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add signals column to features table
    op.add_column('features', sa.Column('signals', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    # Remove signals column from features table
    op.drop_column('features', 'signals')