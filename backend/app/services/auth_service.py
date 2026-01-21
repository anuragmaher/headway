"""
Authentication service for user management and JWT operations
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from datetime import datetime
from typing import Optional
from google.auth.transport import requests
from google.oauth2 import id_token
import logging

from app.models.user import User
from app.models.company import Company
from app.models.workspace import Workspace
from app.schemas.auth import UserCreate, UserUpdate, LoginRequest
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_refresh_token
)
from app.core.config import settings

logger = logging.getLogger(__name__)


class AuthService:
    """Service class for authentication operations"""

    def __init__(self, db: Session):
        self.db = db

    def _ensure_workspace_exists(self, company: Company, owner_id: str) -> Optional[Workspace]:
        """
        Ensure a workspace exists for the given company.
        Creates one if it doesn't exist.

        Args:
            company: Company to create workspace for
            owner_id: User ID to set as workspace owner

        Returns:
            Workspace if created/found, None if creation failed
        """
        try:
            existing_workspace = self.db.query(Workspace).filter(
                Workspace.company_id == company.id
            ).first()

            if existing_workspace:
                return existing_workspace

            # Generate slug from company name
            workspace_slug = company.name.lower().replace(" ", "-").replace(".", "-")

            workspace = Workspace(
                name=company.name,
                slug=workspace_slug,
                company_id=company.id,
                owner_id=owner_id,
                is_active=True
            )
            self.db.add(workspace)
            self.db.commit()
            logger.info(f"Workspace '{company.name}' created for company {company.id}")
            return workspace

        except IntegrityError as e:
            self.db.rollback()
            logger.warning(f"Failed to create workspace: {str(e)}")
            return None
        except Exception as e:
            logger.warning(f"Error ensuring workspace exists: {str(e)}")
            return None

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

            # Ensure workspace exists for the company
            self._ensure_workspace_exists(company, user.id)

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

    def authenticate_with_google(self, google_token: str) -> Optional[User]:
        """
        Authenticate a user with Google ID token.
        Automatically creates a new user if they don't exist.

        Args:
            google_token: Google ID token from frontend

        Returns:
            User object if authentication successful, None otherwise

        Raises:
            HTTPException: If token is invalid or user creation fails
        """
        try:
            # Verify the Google ID token
            idinfo = id_token.verify_oauth2_token(
                google_token,
                requests.Request()
            )

            # Get user email from token
            email = idinfo.get('email')
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Email not found in Google token"
                )

            # Check if user already exists
            user = self.db.query(User).filter(User.email == email).first()

            if user:
                if not user.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User account is inactive"
                    )

                # Update last login time
                user.last_login_at = datetime.utcnow()
                self.db.commit()
                return user

            # Create new user from Google token data
            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')
            picture_url = idinfo.get('picture', '')

            # Extract domain from email for company association
            email_domain = email.split('@')[1].lower()

            # Check if company exists by domain
            existing_company = self.db.query(Company).filter(
                Company.domain == email_domain
            ).first()

            if existing_company:
                # Add user to existing company
                company = existing_company
                user_role = "member"
            else:
                # Create new company from email domain
                # Use domain name as company/workspace name (e.g., grexit.com)
                company_name = email_domain
                company = Company(
                    name=company_name,
                    size="1-10",  # Default size for new workspaces
                    domain=email_domain,
                    is_active=True,
                    subscription_plan="free"
                )
                user_role = "owner"
                logger.info(f"Creating new workspace '{company_name}' for domain '{email_domain}' from Google login")

                try:
                    self.db.add(company)
                    self.db.flush()
                except IntegrityError as e:
                    self.db.rollback()
                    logger.warning(f"IntegrityError creating company: {str(e)}")
                    # Company may have been created by another request, try again
                    existing_company = self.db.query(Company).filter(
                        Company.domain == email_domain
                    ).first()
                    if existing_company:
                        company = existing_company
                        user_role = "member"
                    else:
                        # If company still doesn't exist, log the error and create a fallback
                        logger.error(f"Failed to create or find company for domain {email_domain}: {str(e)}")
                        # Try with a unique name by appending domain hash
                        import hashlib
                        unique_suffix = hashlib.md5(email_domain.encode()).hexdigest()[:8]
                        fallback_name = f"{company_name}_{unique_suffix}"

                        try:
                            company = Company(
                                name=fallback_name,
                                size="1-10",  # Default size for new workspaces
                                domain=email_domain,
                                is_active=True,
                                subscription_plan="free"
                            )
                            self.db.add(company)
                            self.db.flush()
                        except Exception as fallback_error:
                            logger.error(f"Fallback company creation also failed: {str(fallback_error)}")
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Failed to create company: {str(e)}"
                            )

            # Create new user with a random password (won't be used)
            import secrets
            random_password = secrets.token_urlsafe(32)
            hashed_password = get_password_hash(random_password)

            user = User(
                email=email,
                first_name=first_name,
                last_name=last_name,
                company_id=company.id,
                role=user_role,
                hashed_password=hashed_password,
                is_active=True,
                onboarding_completed=False
            )

            try:
                self.db.add(user)
                self.db.commit()
                self.db.refresh(user)

                logger.info(f"New user created via Google OAuth: {email}")

                # Ensure workspace exists for the company
                self._ensure_workspace_exists(company, user.id)

                return user

            except IntegrityError as e:
                self.db.rollback()
                logger.error(f"Failed to create user from Google token: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create user account"
                )

        except ValueError as e:
            # Invalid token
            logger.error(f"Invalid Google token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token"
            )
        except Exception as e:
            logger.error(f"Error authenticating with Google: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google authentication failed"
            )
    
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

        tokens = {
            "access_token": access_token,
            "refresh_token": refresh_token,  # Return same refresh token
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }

        # Get user's workspace by company
        workspace = self.db.query(Workspace).filter(
            Workspace.company_id == user.company_id
        ).first()

        if workspace:
            tokens['workspace_id'] = workspace.id

        return tokens
    
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