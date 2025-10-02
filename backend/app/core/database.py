from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Create SQLAlchemy engine for native PostgreSQL connection
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=False,  # Set to True for SQL debugging
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency to get database session.
    Use this in FastAPI route dependencies.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all_tables():
    """Create all tables in the database using SQLAlchemy"""
    try:
        # Test database connection
        from sqlalchemy import text
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            print("✅ PostgreSQL connection successful!")
        
        # Create all tables (though we're using Alembic for migrations)
        Base.metadata.create_all(bind=engine)
        print("✅ All tables created successfully!")
        
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False


def drop_all_tables():
    """Drop all tables in the database (use with caution!)"""
    if engine:
        Base.metadata.drop_all(bind=engine)