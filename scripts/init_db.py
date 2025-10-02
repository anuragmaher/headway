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

from app.core.supabase_client import get_supabase_client
from app.core.config import settings

def init_database():
    """Initialize the database with all tables using Supabase"""
    print("🚀 Initializing HeadwayHQ database with Supabase...")
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Supabase URL: {settings.SUPABASE_URL}")
    
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Read the SQL file
        sql_file_path = os.path.join(backend_path, 'sql', 'create_tables.sql')
        
        if not os.path.exists(sql_file_path):
            print(f"❌ SQL file not found: {sql_file_path}")
            print("💡 Please ensure the sql/create_tables.sql file exists")
            sys.exit(1)
        
        print("📄 Reading SQL schema file...")
        with open(sql_file_path, 'r') as f:
            sql_content = f.read()
        
        # Split SQL into individual statements (basic splitting)
        sql_statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
        
        print(f"📝 Executing {len(sql_statements)} SQL statements...")
        
        # Execute each SQL statement
        success_count = 0
        for i, statement in enumerate(sql_statements):
            try:
                if statement.strip():
                    # Use Supabase RPC to execute raw SQL
                    result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                    success_count += 1
                    if i % 5 == 0:  # Progress indicator
                        print(f"  ✓ Executed {i+1}/{len(sql_statements)} statements...")
            except Exception as e:
                print(f"  ⚠️  Statement {i+1} failed (might be expected): {str(e)[:100]}...")
                # Continue with other statements
                continue
        
        print(f"✅ Database initialization completed!")
        print(f"   Successfully executed {success_count}/{len(sql_statements)} statements")
        print("\n📋 Tables that should now exist:")
        print("  - companies")
        print("  - users") 
        print("  - workspaces")
        print("  - themes")
        print("  - features")
        print("  - messages")
        print("  - slack_integrations")
        
        print("\n💡 Alternative setup:")
        print("  1. Copy the contents of backend/sql/create_tables.sql")
        print("  2. Go to Supabase Dashboard > SQL Editor")
        print("  3. Paste and run the SQL directly")
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        print("\n💡 Manual setup required:")
        print("1. Go to Supabase Dashboard > SQL Editor")
        print("2. Copy and run the SQL from backend/sql/create_tables.sql")
        print("3. This will create all necessary tables and policies")
        sys.exit(1)

if __name__ == "__main__":
    init_database()