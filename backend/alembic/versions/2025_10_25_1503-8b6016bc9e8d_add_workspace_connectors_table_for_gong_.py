"""Add workspace_connectors table for Gong and Fathom credentials

Revision ID: 8b6016bc9e8d
Revises: f8d3888eeeda
Create Date: 2025-10-25 15:03:54.394874

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '8b6016bc9e8d'
down_revision = 'f8d3888eeeda'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create workspace_connectors table with generic credentials storage
    op.create_table(
        'workspace_connectors',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('connector_type', sa.String(), nullable=False),
        sa.Column('credentials', postgresql.JSONB(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workspace_connectors_id'), 'workspace_connectors', ['id'], unique=False)
    op.create_index(op.f('ix_workspace_connectors_workspace_id'), 'workspace_connectors', ['workspace_id'], unique=False)


def downgrade() -> None:
    # Drop the workspace_connectors table
    op.drop_index(op.f('ix_workspace_connectors_workspace_id'), table_name='workspace_connectors', if_exists=True)
    op.drop_index(op.f('ix_workspace_connectors_id'), table_name='workspace_connectors', if_exists=True)
    op.drop_table('workspace_connectors', if_exists=True)