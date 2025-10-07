"""create_workspace_data_points

Revision ID: create_workspace_data_points
Revises: add_signals_to_features
Create Date: 2025-10-07 15:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'create_workspace_data_points'
down_revision = 'add_signals_to_features'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create workspace_data_points table
    op.create_table(
        'workspace_data_points',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('feature_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('features.id'), nullable=False),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('messages.id'), nullable=False),
        sa.Column('data_point_key', sa.String(), nullable=False),
        sa.Column('data_point_category', sa.String(), nullable=False),
        sa.Column('numeric_value', sa.Float(), nullable=True),
        sa.Column('integer_value', sa.Integer(), nullable=True),
        sa.Column('text_value', sa.String(), nullable=True),
        sa.Column('author', sa.String(), nullable=True),
        sa.Column('extracted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Create indexes for fast querying
    op.create_index('idx_workspace_data_points_workspace_key', 'workspace_data_points', ['workspace_id', 'data_point_key'])
    op.create_index('idx_workspace_data_points_category', 'workspace_data_points', ['workspace_id', 'data_point_category'])
    op.create_index('idx_workspace_data_points_feature', 'workspace_data_points', ['feature_id'])
    op.create_index('idx_workspace_data_points_numeric', 'workspace_data_points', ['workspace_id', 'data_point_key', 'numeric_value'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_workspace_data_points_numeric', table_name='workspace_data_points')
    op.drop_index('idx_workspace_data_points_feature', table_name='workspace_data_points')
    op.drop_index('idx_workspace_data_points_category', table_name='workspace_data_points')
    op.drop_index('idx_workspace_data_points_workspace_key', table_name='workspace_data_points')

    # Drop table
    op.drop_table('workspace_data_points')