#!/usr/bin/env python3
"""
Simple script to test Supabase client connection
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.core.config import settings
from app.core.supabase_client import get_supabase_client

def test_supabase_connection():
    """Test Supabase client connection"""
    print("🔗 Testing Supabase client connection...")
    print(f"Supabase URL: {settings.SUPABASE_URL}")
    print(f"Supabase Key (masked): {settings.SUPABASE_KEY[:20]}...")
    
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Test connection with a simple health check
        # Just calling the auth API to verify the connection works
        auth_user = supabase.auth.get_user()
        
        print("✅ Supabase client connection successful!")
        print("   API endpoint is accessible and credentials are valid")
        
        # Try to list any existing tables by attempting to query them
        # This will tell us if we have any tables created yet
        common_tables = ['users', 'companies', 'workspaces', 'themes', 'features']
        existing_tables = []
        
        for table_name in common_tables:
            try:
                result = supabase.table(table_name).select('*').limit(1).execute()
                existing_tables.append(table_name)
            except Exception:
                # Table doesn't exist or we don't have access
                pass
        
        if existing_tables:
            print(f"\n📋 Existing tables found:")
            for table in existing_tables:
                print(f"  - {table}")
        else:
            print("\n💡 No application tables found yet. You need to create them:")
            print("  1. Go to Supabase dashboard > SQL Editor")
            print("  2. Run the table creation SQL scripts")
            print("  3. Or use the init_db.py script to create them")
            print(f"\n📝 Tables to create: {', '.join(common_tables)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Supabase client connection failed: {e}")
        print("\n💡 Troubleshooting:")
        print("1. Check your SUPABASE_URL in .env file")
        print("2. Check your SUPABASE_KEY in .env file")
        print("3. Verify network connectivity")
        print("4. Make sure your Supabase project is active")
        return False

if __name__ == "__main__":
    test_supabase_connection()