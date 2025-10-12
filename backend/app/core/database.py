from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Create SQLAlchemy engine for native PostgreSQL connection
# Optimized for Neon PostgreSQL serverless with cold start handling
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Test connections before using
    pool_recycle=60,  # Recycle connections every 60s to prevent cold connections
    pool_size=5,  # Maintain 5 connections in the pool
    max_overflow=10,  # Allow up to 10 additional connections when needed
    connect_args={
        'connect_timeout': 30,  # 30 second connection timeout
        'keepalives': 1,  # Enable TCP keepalives
        'keepalives_idle': 30,  # Start keepalives after 30s of idle
        'keepalives_interval': 10,  # Send keepalive every 10s
        'keepalives_count': 5,  # Retry 5 times before giving up
    },
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