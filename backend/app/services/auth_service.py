"""
Authentication service for user management and JWT operations
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from datetime import datetime
from typing import Optional

from app.models.user import User
from app.models.company import Company
from app.schemas.auth import UserCreate, UserUpdate, LoginRequest
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_refresh_token
)
from app.core.config import settings


class AuthService:
    """Service class for authentication operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def register_user(self, user_data: UserCreate) -> User:
        """
        Register a new user and optionally create a new company.
        
        Args:
            user_data: User creation data
            
        Returns:
            Created User object
            
        Raises:
            HTTPException: If email already exists or validation fails
        """
        # Check if email already exists
        existing_user = self.db.query(User).filter(
            User.email == user_data.email
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Extract domain from email for company association
        email_domain = user_data.email.split('@')[1].lower()
        
        # Check if company exists by name
        existing_company = self.db.query(Company).filter(
            Company.name == user_data.company_name
        ).first()
        
        company = None
        user_role = "member"  # Default role
        
        if existing_company:
            # Company exists - check if user's email domain matches
            if existing_company.domain and existing_company.domain != email_domain:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email domain '{email_domain}' does not match company domain '{existing_company.domain}'"
                )
            company = existing_company
        else:
            # Create new company
            company = Company(
                name=user_data.company_name,
                size=user_data.company_size,
                domain=email_domain,
                is_active=True,
                subscription_plan="free"
            )
            user_role = "owner"  # First user in company becomes owner
            
            try:
                self.db.add(company)
                self.db.flush()  # Get the company ID without committing
            except IntegrityError:
                self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Company name already taken. Please choose a different name."
                )
        
        # Hash password
        hashed_password = get_password_hash(user_data.password)
        
        # Create user
        user = User(
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            job_title=user_data.job_title,
            company_id=company.id,
            role=user_role,
            hashed_password=hashed_password,
            theme_preference=user_data.theme_preference,
            is_active=True,
            onboarding_completed=False
        )
        
        try:
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)
            return user
            
        except IntegrityError as e:
            self.db.rollback()
            error_detail = "Failed to create user"
            if "email" in str(e.orig).lower():
                error_detail = "Email already registered"
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_detail
            )
    
    def authenticate_user(self, login_data: LoginRequest) -> Optional[User]:
        """
        Authenticate a user with email and password.
        
        Args:
            login_data: Login credentials
            
        Returns:
            User object if authentication successful, None otherwise
        """
        user = self.db.query(User).filter(
            User.email == login_data.email
        ).first()
        
        if not user:
            return None
            
        if not user.is_active:
            return None
            
        if not verify_password(login_data.password, user.hashed_password):
            return None
            
        # Update last login time
        user.last_login_at = datetime.utcnow()
        self.db.commit()
        
        return user
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """
        Get user by ID.
        
        Args:
            user_id: User ID to lookup
            
        Returns:
            User object if found, None otherwise
        """
        return self.db.query(User).filter(User.id == user_id).first()
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Get user by email.
        
        Args:
            email: Email to lookup
            
        Returns:
            User object if found, None otherwise
        """
        return self.db.query(User).filter(User.email == email).first()
    
    def update_user(self, user_id: str, user_data: UserUpdate) -> User:
        """
        Update user information.
        
        Args:
            user_id: ID of user to update
            user_data: Updated user data
            
        Returns:
            Updated User object
            
        Raises:
            HTTPException: If user not found
        """
        user = self.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update fields
        update_data = user_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        
        user.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(user)
        
        return user
    
    def change_password(
        self, 
        user_id: str, 
        current_password: str, 
        new_password: str
    ) -> bool:
        """
        Change user password.
        
        Args:
            user_id: ID of user
            current_password: Current password for verification
            new_password: New password to set
            
        Returns:
            True if password changed successfully
            
        Raises:
            HTTPException: If user not found or current password incorrect
        """
        user = self.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Verify current password
        if not verify_password(current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password"
            )
        
        # Update password
        user.hashed_password = get_password_hash(new_password)
        user.updated_at = datetime.utcnow()
        
        self.db.commit()
        
        return True
    
    def create_tokens(self, user: User) -> dict:
        """
        Create access and refresh tokens for user.
        
        Args:
            user: User object to create tokens for
            
        Returns:
            Dictionary with access_token, refresh_token, token_type, expires_in
        """
        access_token = create_access_token(subject=str(user.id))
        refresh_token = create_refresh_token(subject=str(user.id))
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert to seconds
        }
    
    def refresh_access_token(self, refresh_token: str) -> dict:
        """
        Create new access token from refresh token.
        
        Args:
            refresh_token: Valid refresh token
            
        Returns:
            Dictionary with new access_token and token info
            
        Raises:
            HTTPException: If refresh token invalid or user not found
        """
        user_id = verify_refresh_token(refresh_token)
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        user = self.get_user_by_id(user_id)
        
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Create new access token (keep same refresh token)
        access_token = create_access_token(subject=str(user.id))
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,  # Return same refresh token
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    
    def complete_onboarding(self, user_id: str) -> User:
        """
        Mark user onboarding as completed.
        
        Args:
            user_id: ID of user to update
            
        Returns:
            Updated User object
            
        Raises:
            HTTPException: If user not found
        """
        user = self.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user.onboarding_completed = True
        user.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(user)
        
        return user