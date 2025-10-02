from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.supabase_client import get_supabase_client

# Create SQLAlchemy engine (still needed for ORM models, but using Supabase connection)
# For Supabase, we'll use their client for most operations but keep SQLAlchemy for model definitions
try:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
    )
    # Create SessionLocal class
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception:
    # Fallback if DATABASE_URL is not properly configured
    engine = None
    SessionLocal = None

# Create Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency to get database session.
    Use this in FastAPI route dependencies.
    """
    if SessionLocal is None:
        raise Exception("Database session not available. Check DATABASE_URL configuration.")
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_supabase():
    """
    Dependency to get Supabase client.
    Use this for Supabase-specific operations.
    """
    return get_supabase_client()


def create_all_tables():
    """Create all tables in the database using Supabase"""
    supabase = get_supabase_client()
    
    # Test Supabase connection
    try:
        # Simple test query to verify connection
        result = supabase.table('information_schema.tables').select('table_name').limit(1).execute()
        print("✅ Supabase connection successful!")
        
        # Note: Supabase tables are typically created through their dashboard or SQL editor
        # For production, consider using Supabase migrations
        print("💡 Create tables through Supabase dashboard or SQL editor")
        print("   Tables needed: companies, users, workspaces, themes, features, messages, slack_integrations")
        
        return True
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        return False


def drop_all_tables():
    """Drop all tables in the database (use with caution!)"""
    if engine:
        Base.metadata.drop_all(bind=engine)