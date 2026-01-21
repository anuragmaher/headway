"""
Authentication API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Form, Request
import logging
import traceback

from app.core.deps import get_current_user, get_db
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
    db = Depends(get_db)
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
    try:
        logging.info(f"Registration attempt for email: {user_data.email}")
        logging.info(f"Registration data: company={user_data.company_name}, size={user_data.company_size}")
        
        auth_service = AuthService(db)
        user = auth_service.register_user(user_data)
        logging.info(f"User registered successfully: {user.email}")
        return UserSchema.from_orm(user)
        
    except HTTPException as e:
        logging.error(f"HTTP exception during registration: {e.detail}")
        raise e
        
    except Exception as e:
        logging.error(f"Unexpected error during registration: {str(e)}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Internal server error during registration",
                "error": str(e),
                "type": type(e).__name__
            }
        )


@router.post("/login", response_model=Token)
async def login(
    username: str = Form(None),
    password: str = Form(None),
    db = Depends(get_db)
) -> Token:
    """
    Authenticate user and return access tokens.
    Accepts form data with username/password fields.
    
    Args:
        auth_service: Authentication service instance
        username: User email (form field)
        password: User password (form field)
        
    Returns:
        JWT access and refresh tokens
        
    Raises:
        HTTPException: If credentials are invalid
    """
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Username and password are required"
        )
    
    # Create LoginRequest object from form data
    login_data = LoginRequest(email=username, password=password)
    
    auth_service = AuthService(db)
    user = auth_service.authenticate_user(login_data)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    tokens = auth_service.create_tokens(user)

    # Get user's workspace by company (not by owner)
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.company_id == user.company_id
    ).first()

    if workspace:
        tokens['workspace_id'] = workspace.id

    return Token(**tokens)


@router.post("/login-json", response_model=Token)
async def login_json(
    login_data: LoginRequest,
    db = Depends(get_db)
) -> Token:
    """
    Authenticate user with JSON data.

    Args:
        login_data: User login credentials (JSON format)
        auth_service: Authentication service instance

    Returns:
        JWT access and refresh tokens

    Raises:
        HTTPException: If credentials are invalid
    """
    auth_service = AuthService(db)
    user = auth_service.authenticate_user(login_data)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    tokens = auth_service.create_tokens(user)

    # Get user's workspace by company (not by owner)
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.company_id == user.company_id
    ).first()

    if workspace:
        tokens['workspace_id'] = workspace.id

    return Token(**tokens)


@router.post("/login-google", response_model=Token)
async def login_google(
    google_data: dict,
    db = Depends(get_db)
) -> Token:
    """
    Authenticate user with Google ID token.

    Args:
        google_data: Dictionary containing 'credential' (Google ID token)
        db: Database session

    Returns:
        JWT access and refresh tokens with workspace_id

    Raises:
        HTTPException: If token is invalid or authentication fails
    """
    try:
        credential = google_data.get('credential')
        if not credential:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Google credential is required"
            )

        auth_service = AuthService(db)
        user = auth_service.authenticate_with_google(credential)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google authentication failed",
                headers={"WWW-Authenticate": "Bearer"},
            )

        tokens = auth_service.create_tokens(user)

        # Get user's workspace by company (all users in same company share workspace)
        from app.models.workspace import Workspace
        workspace = db.query(Workspace).filter(
            Workspace.company_id == user.company_id
        ).first()

        if workspace:
            tokens['workspace_id'] = workspace.id

        return Token(**tokens)

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error during Google login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during Google login"
        )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    db = Depends(get_db)
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
    auth_service = AuthService(db)
    tokens = auth_service.refresh_access_token(refresh_data.refresh_token)
    return Token(**tokens)


@router.get("/me", response_model=UserSchema)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user)
) -> UserSchema:
    """
    Get current authenticated user information.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current user information
    """
    return UserSchema(**current_user)


@router.put("/me", response_model=UserSchema)
async def update_current_user(
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
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
    auth_service = AuthService(db)
    updated_user = auth_service.update_user(current_user['id'], user_data)
    return UserSchema.model_validate(updated_user)


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
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
    auth_service = AuthService(db)
    auth_service.change_password(
        current_user['id'],
        password_data.current_password,
        password_data.new_password
    )
    
    return {"message": "Password changed successfully"}


@router.post("/complete-onboarding", response_model=UserSchema)
async def complete_onboarding(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
) -> UserSchema:
    """
    Mark current user onboarding as completed.
    
    Args:
        current_user: Current authenticated user
        auth_service: Authentication service instance
        
    Returns:
        Updated user information with onboarding completed
    """
    auth_service = AuthService(db)
    updated_user = auth_service.complete_onboarding(current_user['id'])
    return UserSchema.model_validate(updated_user)


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
    current_user: dict = Depends(get_current_user)
) -> UserSchema:
    """
    Verify that the current token is valid and return user info.
    Useful for frontend token validation.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current user information if token is valid
    """
    return UserSchema(**current_user)