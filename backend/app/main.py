from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import os
import logging
import traceback
from dotenv import load_dotenv

from app.core.config import settings
from app.core.database import create_all_tables

# Load environment variables
load_dotenv()

# Test Supabase connection on startup
try:
    from app.core.database import create_all_tables
    create_all_tables()
except Exception as e:
    print(f"⚠️  Supabase connection test failed: {e}")
    print("   This is expected if environment variables are not set yet")

app = FastAPI(
    title="HeadwayHQ API",
    description="Product Intelligence Platform API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global exception handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.error(f"HTTP exception: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "message": str(exc.detail),
            "status_code": exc.status_code,
            "path": str(request.url.path)
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}")
    
    # Convert error details to be JSON serializable
    details = []
    for error in exc.errors():
        error_dict = dict(error)
        # Convert bytes to string if present
        if 'input' in error_dict and isinstance(error_dict['input'], bytes):
            error_dict['input'] = f"<bytes data of length {len(error_dict['input'])}>"
        details.append(error_dict)
    
    return JSONResponse(
        status_code=422,
        content={
            "message": "Validation error",
            "details": details,
            "path": str(request.url.path)
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}")
    logger.error(f"Traceback: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={
            "message": "Internal server error",
            "error": str(exc),
            "type": type(exc).__name__,
            "path": str(request.url.path)
        }
    )

@app.get("/")
async def root():
    """Health check endpoint"""
    return JSONResponse(
        content={
            "message": "HeadwayHQ API is running",
            "version": "1.0.0",
            "status": "healthy"
        }
    )

@app.get("/health")
async def health_check():
    """Detailed health check"""
    try:
        # Test database connection
        from app.core.database import get_db
        db = next(get_db())
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = f"failed: {str(e)}"
    
    return JSONResponse(
        content={
            "status": "healthy",
            "environment": settings.ENVIRONMENT,
            "version": "1.0.0",
            "database": db_status,
            "supabase_url": settings.SUPABASE_URL[:50] + "..." if len(settings.SUPABASE_URL) > 50 else settings.SUPABASE_URL
        }
    )

# Simple test endpoints that don't require database
@app.get("/api/test")
async def test_endpoint():
    """Simple test endpoint that doesn't require database"""
    return {"message": "API is working!", "timestamp": "2025-10-02"}

@app.post("/api/test-register")
async def test_register(data: dict):
    """Test registration endpoint that doesn't hit database"""
    logger.info(f"Test registration received: {data}")
    return {
        "message": "Test registration successful", 
        "received_data": data,
        "note": "This is a test endpoint"
    }

# Include routers
from app.api.v1.auth import router as auth_router
app.include_router(auth_router, prefix="/api/v1/auth", tags=["authentication"])
# app.include_router(themes_router, prefix="/api/v1/themes", tags=["themes"])
# app.include_router(features_router, prefix="/api/v1/features", tags=["features"])
# app.include_router(slack_router, prefix="/api/v1/slack", tags=["slack"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True if settings.ENVIRONMENT == "development" else False
    )