"""
Supabase-based authentication service
"""

from fastapi import HTTPException, status
from datetime import datetime
from typing import Optional
import logging
import uuid

from app.core.supabase_client import get_supabase_client
from app.schemas.auth import UserCreate, UserUpdate, LoginRequest
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_refresh_token
)

logger = logging.getLogger(__name__)

class SupabaseAuthService:
    """Authentication service using Supabase client"""
    
    def __init__(self):
        self.supabase = get_supabase_client()
    
    def register_user(self, user_data: UserCreate):
        """Register a new user using Supabase"""
        try:
            logger.info(f"Starting registration for email: {user_data.email}")
            
            # Check if email already exists
            existing_user = self.supabase.table('users').select('*').eq('email', user_data.email).execute()
            if existing_user.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            
            # Extract domain from email for company association
            email_domain = user_data.email.split('@')[1].lower()
            logger.info(f"Email domain: {email_domain}")
            
            # Check if company exists
            existing_company = None
            if user_data.company_name:
                company_result = self.supabase.table('companies').select('*').eq('name', user_data.company_name).execute()
                if company_result.data:
                    existing_company = company_result.data[0]
                    logger.info(f"Found existing company: {existing_company['id']}")
            
            company_id = None
            user_role = "member"
            
            if existing_company:
                # Company exists - check if user's email domain matches
                if existing_company.get('domain') and existing_company['domain'] != email_domain:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Email domain '{email_domain}' does not match company domain '{existing_company['domain']}'"
                    )
                company_id = existing_company['id']
            else:
                # Create new company
                logger.info(f"Creating new company: {user_data.company_name}")
                company_data = {
                    'id': str(uuid.uuid4()),
                    'name': user_data.company_name,
                    'size': user_data.company_size,
                    'domain': email_domain,
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                }
                
                company_result = self.supabase.table('companies').insert(company_data).execute()
                if not company_result.data:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to create company"
                    )
                
                company_id = company_result.data[0]['id']
                user_role = "owner"  # First user in company is owner
                logger.info(f"Created company with ID: {company_id}")
            
            # Create user
            hashed_password = get_password_hash(user_data.password)
            user_id = str(uuid.uuid4())
            
            user_record = {
                'id': user_id,
                'email': user_data.email,
                'first_name': user_data.first_name,
                'last_name': user_data.last_name,
                'full_name': f"{user_data.first_name} {user_data.last_name}".strip(),
                'job_title': getattr(user_data, 'job_title', None),
                'hashed_password': hashed_password,
                'is_active': True,
                'is_verified': False,
                'role': user_role,
                'company_id': company_id,
                'onboarding_completed': False,
                'theme_preference': 'light',
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            
            logger.info(f"Creating user with role: {user_role}")
            user_result = self.supabase.table('users').insert(user_record).execute()
            
            if not user_result.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create user"
                )
            
            created_user = user_result.data[0]
            logger.info(f"User created successfully: {created_user['id']}")
            
            # Remove password from response
            del created_user['hashed_password']
            return created_user
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Registration error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Registration failed: {str(e)}"
            )
    
    def authenticate_user(self, login_data: LoginRequest):
        """Authenticate user with email and password"""
        try:
            # Get user by email
            user_result = self.supabase.table('users').select('*').eq('email', login_data.email).execute()
            
            if not user_result.data:
                return None
            
            user = user_result.data[0]
            
            # Verify password
            if not verify_password(login_data.password, user['hashed_password']):
                return None
            
            # Check if user is active
            if not user['is_active']:
                return None
            
            # Remove password from response
            del user['hashed_password']
            return user
            
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return None
    
    def create_tokens(self, user):
        """Create access and refresh tokens for user"""
        access_token = create_access_token(subject=user['id'])
        refresh_token = create_refresh_token(subject=user['id'])
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": 15 * 60  # 15 minutes in seconds
        }
    
    def get_user_by_id(self, user_id: str):
        """Get user by ID"""
        try:
            user_result = self.supabase.table('users').select('*').eq('id', user_id).execute()
            
            if not user_result.data:
                return None
            
            user = user_result.data[0]
            # Remove password from response
            if 'hashed_password' in user:
                del user['hashed_password']
            return user
            
        except Exception as e:
            logger.error(f"Get user error: {str(e)}")
            return None
    
    def update_user(self, user_id: str, user_data):
        """Update user information"""
        try:
            # Build update data dictionary
            update_data = user_data.dict(exclude_unset=True) if hasattr(user_data, 'dict') else user_data
            update_data['updated_at'] = datetime.utcnow().isoformat()
            
            # Update user in Supabase
            user_result = self.supabase.table('users').update(update_data).eq('id', user_id).execute()
            
            if not user_result.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            
            user = user_result.data[0]
            # Remove password from response
            if 'hashed_password' in user:
                del user['hashed_password']
            return user
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Update user error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update user: {str(e)}"
            )
    
    def change_password(self, user_id: str, current_password: str, new_password: str):
        """Change user password"""
        try:
            # Get user to verify current password
            user_result = self.supabase.table('users').select('*').eq('id', user_id).execute()
            
            if not user_result.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            
            user = user_result.data[0]
            
            # Verify current password
            if not verify_password(current_password, user['hashed_password']):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Incorrect current password"
                )
            
            # Update password
            hashed_password = get_password_hash(new_password)
            update_result = self.supabase.table('users').update({
                'hashed_password': hashed_password,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', user_id).execute()
            
            if not update_result.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update password"
                )
            
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Change password error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to change password: {str(e)}"
            )
    
    def complete_onboarding(self, user_id: str):
        """Mark user onboarding as completed"""
        try:
            update_result = self.supabase.table('users').update({
                'onboarding_completed': True,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', user_id).execute()
            
            if not update_result.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            
            user = update_result.data[0]
            # Remove password from response
            if 'hashed_password' in user:
                del user['hashed_password']
            return user
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Complete onboarding error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to complete onboarding: {str(e)}"
            )
    
    def refresh_access_token(self, refresh_token: str):
        """Create new access token from refresh token"""
        try:
            user_id = verify_refresh_token(refresh_token)
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token"
                )
            
            user = self.get_user_by_id(user_id)
            
            if not user or not user.get('is_active', False):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or inactive"
                )
            
            # Create new access token (keep same refresh token)
            access_token = create_access_token(subject=user_id)
            
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,  # Return same refresh token
                "token_type": "bearer",
                "expires_in": 15 * 60  # 15 minutes in seconds
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Refresh token error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to refresh token: {str(e)}"
            )