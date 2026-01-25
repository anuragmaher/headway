"""add_transcript_classifications_table

Revision ID: a1b2c3d4e5f6
Revises: 239f8170c094
Create Date: 2026-01-25 15:17:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '239f8170c094'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create transcript_classifications table
    op.create_table(
        'transcript_classifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('source_type', sa.String(50), nullable=False),
        sa.Column('source_id', sa.String(255), nullable=False),
        sa.Column('source_title', sa.String(500), nullable=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('theme_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('sub_theme_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('extracted_data', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('raw_ai_response', postgresql.JSONB(), nullable=True),
        sa.Column('processing_status', sa.String(50), nullable=False, server_default='completed'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('confidence_score', sa.String(20), nullable=True),
        sa.Column('transcript_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['theme_id'], ['themes.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sub_theme_id'], ['sub_themes.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_transcript_classifications_id'), 'transcript_classifications', ['id'], unique=False)
    op.create_index('idx_transcript_classifications_workspace', 'transcript_classifications', ['workspace_id'], unique=False)
    op.create_index('idx_transcript_classifications_theme', 'transcript_classifications', ['theme_id'], unique=False)
    op.create_index('idx_transcript_classifications_sub_theme', 'transcript_classifications', ['sub_theme_id'], unique=False)
    op.create_index('idx_transcript_classifications_source', 'transcript_classifications', ['source_type', 'source_id'], unique=False)
    op.create_index('idx_transcript_classifications_workspace_source', 'transcript_classifications', ['workspace_id', 'source_type'], unique=False)
    op.create_index('idx_transcript_classifications_status', 'transcript_classifications', ['processing_status'], unique=False)
    op.create_index('idx_transcript_classifications_date', 'transcript_classifications', ['transcript_date'], unique=False)
    
    # Create GIN index for JSONB queries on extracted_data
    op.execute("CREATE INDEX idx_transcript_classifications_extracted_data ON transcript_classifications USING GIN (extracted_data)")


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_transcript_classifications_extracted_data', table_name='transcript_classifications', if_exists=True)
    op.drop_index('idx_transcript_classifications_date', table_name='transcript_classifications', if_exists=True)
    op.drop_index('idx_transcript_classifications_status', table_name='transcript_classifications', if_exists=True)
    op.drop_index('idx_transcript_classifications_workspace_source', table_name='transcript_classifications', if_exists=True)
    op.drop_index('idx_transcript_classifications_source', table_name='transcript_classifications', if_exists=True)
    op.drop_index('idx_transcript_classifications_sub_theme', table_name='transcript_classifications', if_exists=True)
    op.drop_index('idx_transcript_classifications_theme', table_name='transcript_classifications', if_exists=True)
    op.drop_index('idx_transcript_classifications_workspace', table_name='transcript_classifications', if_exists=True)
    op.drop_index(op.f('ix_transcript_classifications_id'), table_name='transcript_classifications', if_exists=True)
    
    # Drop table
    op.drop_table('transcript_classifications', if_exists=True)
