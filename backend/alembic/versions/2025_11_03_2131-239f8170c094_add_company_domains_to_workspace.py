"""add_company_domains_to_workspace

Revision ID: 239f8170c094
Revises: 120f915b7fb0
Create Date: 2025-11-03 21:31:14.298198

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '239f8170c094'
down_revision = '120f915b7fb0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add company_domains column as an array of strings
    op.add_column('workspaces', sa.Column('company_domains', sa.ARRAY(sa.String()), nullable=True))


def downgrade() -> None:
    # Remove company_domains column
    op.drop_column('workspaces', 'company_domains')