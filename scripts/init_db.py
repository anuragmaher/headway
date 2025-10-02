#!/usr/bin/env python3
"""
Database initialization script for Supabase
Run this script to create all necessary tables
"""

import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the backend directory to the Python path
backend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend')
sys.path.insert(0, backend_path)

from app.core.database import create_all_tables
from app.core.config import settings

def init_database():
    """Initialize the database with all tables"""
    print("🚀 Initializing HeadwayHQ database...")
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Database URL (masked): {settings.DATABASE_URL[:50]}...")
    
    try:
        create_all_tables()
        print("✅ Database tables created successfully!")
        print("\n📋 Created tables:")
        print("  - companies")
        print("  - users")
        print("  - workspaces")
        print("  - themes")
        print("  - features")
        print("  - messages")
        print("  - slack_integrations")
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        print("\n💡 Troubleshooting:")
        print("1. Check your DATABASE_URL in .env file")
        print("2. Ensure your Supabase database password is correct")
        print("3. Verify network connectivity to Supabase")
        sys.exit(1)

if __name__ == "__main__":
    init_database()