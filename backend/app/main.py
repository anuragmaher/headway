from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

from app.core.config import settings
from app.core.database import create_all_tables

# Load environment variables
load_dotenv()

# Note: Database table creation should be handled separately in production
# For serverless deployments, consider using Supabase migrations or a separate setup script

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
    return JSONResponse(
        content={
            "status": "healthy",
            "environment": settings.ENVIRONMENT,
            "version": "1.0.0"
        }
    )

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