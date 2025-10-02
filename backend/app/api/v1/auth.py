"""
Authentication API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_auth_service
from app.models.user import User
from app.services.auth_service import AuthService
from app.schemas.auth import (
    UserCreate,
    UserUpdate,
    User as UserSchema,
    Token,
    LoginRequest,
    RefreshTokenRequest,
    ChangePasswordRequest
)

router = APIRouter()


@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    auth_service: AuthService = Depends(get_auth_service)
) -> UserSchema:
    """
    Register a new user account.
    
    Args:
        user_data: User registration data
        auth_service: Authentication service instance
        
    Returns:
        Created user information (without password)
        
    Raises:
        HTTPException: If email already exists or validation fails
    """
    user = auth_service.register_user(user_data)
    return UserSchema.from_orm(user)


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service)
) -> Token:
    """
    Authenticate user and return access tokens.
    
    Args:
        login_data: User login credentials
        auth_service: Authentication service instance
        
    Returns:
        JWT access and refresh tokens
        
    Raises:
        HTTPException: If credentials are invalid
    """
    user = auth_service.authenticate_user(login_data)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    tokens = auth_service.create_tokens(user)
    return Token(**tokens)


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    auth_service: AuthService = Depends(get_auth_service)
) -> Token:
    """
    Refresh access token using refresh token.
    
    Args:
        refresh_data: Refresh token data
        auth_service: Authentication service instance
        
    Returns:
        New JWT access token
        
    Raises:
        HTTPException: If refresh token is invalid
    """
    tokens = auth_service.refresh_access_token(refresh_data.refresh_token)
    return Token(**tokens)


@router.get("/me", response_model=UserSchema)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
) -> UserSchema:
    """
    Get current authenticated user information.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current user information
    """
    return UserSchema.from_orm(current_user)


@router.put("/me", response_model=UserSchema)
async def update_current_user(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service)
) -> UserSchema:
    """
    Update current user information.
    
    Args:
        user_data: Updated user data
        current_user: Current authenticated user
        auth_service: Authentication service instance
        
    Returns:
        Updated user information
    """
    updated_user = auth_service.update_user(str(current_user.id), user_data)
    return UserSchema.from_orm(updated_user)


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service)
) -> dict:
    """
    Change current user password.
    
    Args:
        password_data: Current and new password data
        current_user: Current authenticated user
        auth_service: Authentication service instance
        
    Returns:
        Success message
        
    Raises:
        HTTPException: If current password is incorrect
    """
    auth_service.change_password(
        str(current_user.id),
        password_data.current_password,
        password_data.new_password
    )
    
    return {"message": "Password changed successfully"}


@router.post("/complete-onboarding", response_model=UserSchema)
async def complete_onboarding(
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service)
) -> UserSchema:
    """
    Mark current user onboarding as completed.
    
    Args:
        current_user: Current authenticated user
        auth_service: Authentication service instance
        
    Returns:
        Updated user information with onboarding completed
    """
    updated_user = auth_service.complete_onboarding(str(current_user.id))
    return UserSchema.from_orm(updated_user)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout() -> dict:
    """
    Logout current user.
    
    Note: In a stateless JWT system, logout is handled client-side
    by removing the tokens. This endpoint exists for consistency
    and potential future token blacklisting.
    
    Returns:
        Success message
    """
    return {"message": "Successfully logged out"}


@router.get("/verify", response_model=UserSchema)
async def verify_token_endpoint(
    current_user: User = Depends(get_current_user)
) -> UserSchema:
    """
    Verify that the current token is valid and return user info.
    Useful for frontend token validation.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current user information if token is valid
    """
    return UserSchema.from_orm(current_user)