from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Create SQLAlchemy engine for native PostgreSQL connection
# Optimized for Railway/cloud PostgreSQL with aggressive connection handling
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Test connections before using - critical for cloud DBs
    pool_recycle=300,  # Recycle connections every 5 minutes (Railway terminates idle connections quickly)
    pool_size=5,  # Smaller pool size to avoid connection limits
    max_overflow=10,  # Allow overflow connections
    pool_timeout=30,  # Wait up to 30s for a connection from pool
    connect_args={
        'connect_timeout': 30,  # Increased timeout for cloud DB (can be slow to wake up)
        'keepalives': 1,  # Enable TCP keepalives
        'keepalives_idle': 15,  # Start keepalives after 15s of idle (more aggressive)
        'keepalives_interval': 5,  # Send keepalive every 5s
        'keepalives_count': 3,  # Retry 3 times before giving up
        'options': '-c statement_timeout=60000',  # 60s statement timeout
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