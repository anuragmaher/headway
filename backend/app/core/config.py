from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # Database - Supabase
    DATABASE_URL: str = "postgresql://postgres.wyoakbnxehosonecuovy:YOUR_DB_PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
    SUPABASE_URL: str = "https://wyoakbnxehosonecuovy.supabase.co"
    SUPABASE_KEY: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5b2FrYm54ZWhvc29uZWN1b3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA1NjI2MTYsImV4cCI6MjA0NjEzODYxNn0.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5b2FrYm54ZWhvc29uZWN1b3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA1NjI2MTYsImV4cCI6MjA0NjEzODYxNn0"
    
    # JWT Configuration
    JWT_SECRET_KEY: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 48
    
    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Anthropic AI
    ANTHROPIC_API_KEY: Optional[str] = None
    
    # Slack Integration
    SLACK_CLIENT_ID: Optional[str] = None
    SLACK_CLIENT_SECRET: Optional[str] = None
    SLACK_REDIRECT_URI: str = "http://localhost:8000/api/v1/slack/callback"
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev port
        "https://headwayhq.com",  # Production domain
    ]
    
    # Celery Configuration
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()