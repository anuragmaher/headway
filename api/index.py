"""
Vercel serverless function entry point for FastAPI
"""

import sys
import os

# Add the backend directory to the Python path
backend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend')
sys.path.insert(0, backend_path)

# Import the FastAPI app
from app.main import app

# Export the FastAPI app for Vercel (using the standard name)
app = app