"""
FastAPI dependencies for authentication and database sessions
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User
from app.models.workspace import Workspace
from app.services.auth_service import AuthService

# Security scheme for JWT tokens
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> dict:
    """
    Get current authenticated user from JWT token using PostgreSQL database.
    
    Args:
        credentials: HTTP authorization credentials
        db: Database session
        
    Returns:
        Current User dict
        
    Raises:
        HTTPException: If token invalid or user not found
    """
    # Extract token from credentials
    token = credentials.credentials
    
    # Verify token and get user ID
    user_id = verify_token(token)
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    auth_service = AuthService(db)
    user = auth_service.get_user_by_id(user_id)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Convert User model to dict for compatibility
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "job_title": user.job_title,
        "company_id": str(user.company_id),
        "role": user.role,
        "is_active": user.is_active,
        "theme_preference": user.theme_preference,
        "onboarding_completed": user.onboarding_completed,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "last_login_at": user.last_login_at
    }


def get_current_active_user(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Get current active user (alias for clarity).
    
    Args:
        current_user: Current user from get_current_user dependency
        
    Returns:
        Current active User dict
    """
    return current_user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
    db: Session = Depends(get_db)
) -> Optional[dict]:
    """
    Get current user if token provided, otherwise return None.
    Useful for endpoints that work with or without authentication.
    
    Args:
        credentials: Optional HTTP authorization credentials
        db: Database session
        
    Returns:
        Current User dict if authenticated, None otherwise
    """
    if credentials is None:
        return None
    
    try:
        token = credentials.credentials
        user_id = verify_token(token)
        
        if user_id is None:
            return None
        
        auth_service = AuthService(db)
        user = auth_service.get_user_by_id(user_id)
        
        if user is None or not user.is_active:
            return None
            
        # Convert User model to dict for compatibility
        return {
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "job_title": user.job_title,
            "company_id": str(user.company_id),
            "role": user.role,
            "is_active": user.is_active,
            "theme_preference": user.theme_preference,
            "onboarding_completed": user.onboarding_completed,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "last_login_at": user.last_login_at
        }
        
    except Exception:
        return None


def require_onboarding_completed(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Require that the current user has completed onboarding.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current User dict
        
    Raises:
        HTTPException: If onboarding not completed
    """
    if not current_user.get('onboarding_completed', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Onboarding not completed. Please complete onboarding first."
        )
    
    return current_user


def get_current_user_with_workspace(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Get current user with workspace information.
    Creates a default workspace if the user doesn't have one.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Current User dict with workspace_id added
    """
    import uuid
    
    # Check if user has a workspace
    workspace = db.query(Workspace).filter(
        Workspace.owner_id == current_user['id']
    ).first()
    
    if not workspace:
        # Create a default workspace for the user
        workspace = Workspace(
            id=uuid.uuid4(),
            name=f"{current_user['first_name']}'s Workspace",
            slug=f"{current_user['first_name'].lower()}-workspace-{str(uuid.uuid4())[:8]}",
            company_id=current_user['company_id'],
            owner_id=current_user['id'],
            is_active=True
        )
        
        db.add(workspace)
        db.commit()
        db.refresh(workspace)
    
    # Add workspace_id to user dict
    current_user_with_workspace = current_user.copy()
    current_user_with_workspace['workspace_id'] = str(workspace.id)
    
    return current_user_with_workspace


