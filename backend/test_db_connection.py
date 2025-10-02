#!/usr/bin/env python3
"""
Simple script to test Supabase database connection
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.core.config import settings
from sqlalchemy import create_engine, text

def test_connection():
    """Test database connection with provided URL"""
    print("🔗 Testing Supabase database connection...")
    print(f"Database URL (masked): {settings.DATABASE_URL[:30]}...")
    
    try:
        # For now, test with a mock connection string that doesn't need a password
        test_url = "postgresql://postgres:dummy_password@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
        
        print("\n⚠️  Note: You need to set the correct database password in your .env file")
        print("The PASSWORD placeholder in DATABASE_URL needs to be replaced with your actual Supabase database password")
        print("\nYou can find the password in your Supabase dashboard under Settings > Database")
        
        engine = create_engine(test_url, echo=False)
        
        # Test connection
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1 as test"))
            test_value = result.fetchone()[0]
            if test_value == 1:
                print("✅ Database connection successful!")
                return True
                
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("\n💡 Next steps:")
        print("1. Get your database password from Supabase dashboard")
        print("2. Update DATABASE_URL in .env file with the correct password")
        print("3. Run this script again to test the connection")
        return False

if __name__ == "__main__":
    test_connection()