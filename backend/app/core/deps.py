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
from app.services.auth_service import AuthService

# Security scheme for JWT tokens
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token.
    
    Args:
        credentials: HTTP authorization credentials
        db: Database session
        
    Returns:
        Current User object
        
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
    
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user (alias for clarity).
    
    Args:
        current_user: Current user from get_current_user dependency
        
    Returns:
        Current active User object
    """
    return current_user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get current user if token provided, otherwise return None.
    Useful for endpoints that work with or without authentication.
    
    Args:
        credentials: Optional HTTP authorization credentials
        db: Database session
        
    Returns:
        Current User object if authenticated, None otherwise
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
            
        return user
        
    except Exception:
        return None


def require_onboarding_completed(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Require that the current user has completed onboarding.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current User object
        
    Raises:
        HTTPException: If onboarding not completed
    """
    if not current_user.onboarding_completed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Onboarding not completed. Please complete onboarding first."
        )
    
    return current_user


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    """
    Get AuthService instance with database session.
    
    Args:
        db: Database session
        
    Returns:
        AuthService instance
    """
    return AuthService(db)