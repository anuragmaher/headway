"""
User repository for database operations
"""

from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.user import User


class UserRepository:
    """Repository class for User database operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create(self, user_data: dict) -> User:
        """
        Create a new user.
        
        Args:
            user_data: Dictionary with user data
            
        Returns:
            Created User object
        """
        user = User(**user_data)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def get_by_id(self, user_id: str) -> Optional[User]:
        """
        Get user by ID.
        
        Args:
            user_id: User ID to lookup
            
        Returns:
            User object if found, None otherwise
        """
        return self.db.query(User).filter(User.id == user_id).first()
    
    def get_by_email(self, email: str) -> Optional[User]:
        """
        Get user by email.
        
        Args:
            email: Email to lookup
            
        Returns:
            User object if found, None otherwise
        """
        return self.db.query(User).filter(User.email == email).first()
    
    def get_all(self, skip: int = 0, limit: int = 100) -> List[User]:
        """
        Get all users with pagination.
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of User objects
        """
        return self.db.query(User).offset(skip).limit(limit).all()
    
    def get_active_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        """
        Get all active users with pagination.
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of active User objects
        """
        return self.db.query(User).filter(
            User.is_active == True
        ).offset(skip).limit(limit).all()
    
    def update(self, user: User, update_data: dict) -> User:
        """
        Update user with new data.
        
        Args:
            user: User object to update
            update_data: Dictionary with updated data
            
        Returns:
            Updated User object
        """
        for field, value in update_data.items():
            if hasattr(user, field):
                setattr(user, field, value)
        
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def delete(self, user: User) -> bool:
        """
        Delete a user (soft delete by setting is_active=False).
        
        Args:
            user: User object to delete
            
        Returns:
            True if successful
        """
        user.is_active = False
        self.db.commit()
        return True
    
    def hard_delete(self, user: User) -> bool:
        """
        Permanently delete a user from database.
        
        Args:
            user: User object to delete
            
        Returns:
            True if successful
        """
        self.db.delete(user)
        self.db.commit()
        return True
    
    def count_total(self) -> int:
        """
        Count total number of users.
        
        Returns:
            Total user count
        """
        return self.db.query(User).count()
    
    def count_active(self) -> int:
        """
        Count total number of active users.
        
        Returns:
            Active user count
        """
        return self.db.query(User).filter(User.is_active == True).count()
    
    def exists_by_email(self, email: str) -> bool:
        """
        Check if user exists by email.
        
        Args:
            email: Email to check
            
        Returns:
            True if user exists, False otherwise
        """
        return self.db.query(User).filter(User.email == email).first() is not None