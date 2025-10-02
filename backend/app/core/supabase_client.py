"""
Supabase client configuration for HeadwayHQ
"""

import os
from supabase import create_client, Client
from app.core.config import settings

# Initialize Supabase client
supabase: Client = create_client(
    supabase_url=settings.SUPABASE_URL,
    supabase_key=settings.SUPABASE_KEY
)

def get_supabase_client() -> Client:
    """
    Get the Supabase client instance
    """
    return supabase