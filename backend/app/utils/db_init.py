"""
Database initialization utilities
"""

from sqlalchemy.orm import Session
from app.models.theme import Theme
from app.models.workspace import Workspace
from app.utils.enums import DEFAULT_THEMES
import logging

logger = logging.getLogger(__name__)


def create_default_themes(db: Session, workspace_id: str) -> list[Theme]:
    """
    Create default themes for a workspace.
    
    Args:
        db: Database session
        workspace_id: ID of the workspace to create themes for
        
    Returns:
        List of created Theme objects
    """
    logger.info(f"Creating default themes for workspace {workspace_id}")
    
    created_themes = []
    
    for theme_data in DEFAULT_THEMES:
        # Check if theme already exists
        existing = db.query(Theme).filter(
            Theme.workspace_id == workspace_id,
            Theme.name == theme_data["name"]
        ).first()
        
        if existing:
            logger.info(f"Theme '{theme_data['name']}' already exists, skipping")
            created_themes.append(existing)
            continue
            
        # Create new theme
        theme = Theme(
            workspace_id=workspace_id,
            **theme_data
        )
        
        db.add(theme)
        created_themes.append(theme)
        logger.info(f"Created theme: {theme_data['name']}")
    
    db.commit()
    
    # Refresh all themes to get IDs
    for theme in created_themes:
        db.refresh(theme)
    
    logger.info(f"Successfully created {len(created_themes)} themes")
    return created_themes


def initialize_workspace(db: Session, workspace: Workspace) -> None:
    """
    Initialize a new workspace with default data.
    
    Args:
        db: Database session
        workspace: Workspace object to initialize
    """
    logger.info(f"Initializing workspace: {workspace.name}")
    
    # Create default themes
    themes = create_default_themes(db, str(workspace.id))
    
    logger.info(f"Workspace '{workspace.name}' initialized with {len(themes)} themes")


def get_or_create_workspace(
    db: Session, 
    owner_id: str, 
    name: str, 
    slug: str
) -> Workspace:
    """
    Get existing workspace or create a new one.
    
    Args:
        db: Database session
        owner_id: ID of the workspace owner
        name: Workspace name
        slug: Workspace slug
        
    Returns:
        Workspace object
    """
    # Check if workspace exists
    workspace = db.query(Workspace).filter(
        Workspace.slug == slug
    ).first()
    
    if workspace:
        logger.info(f"Found existing workspace: {workspace.name}")
        return workspace
    
    # Create new workspace
    workspace = Workspace(
        owner_id=owner_id,
        name=name,
        slug=slug
    )
    
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    
    # Initialize with default data
    initialize_workspace(db, workspace)
    
    logger.info(f"Created new workspace: {workspace.name}")
    return workspace