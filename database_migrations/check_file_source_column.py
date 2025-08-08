#!/usr/bin/env python3
"""
Check if file_source column exists in transactions table
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create and return Supabase client"""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET")  # Use service role key
    
    if not url or not key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SECRET in environment variables")
    
    return create_client(url, key)

def check_file_source_column():
    """Check if file_source column exists"""
    try:
        supabase = get_supabase_client()
        
        print("Checking if file_source column exists...")
        
        # Try to select the file_source column
        try:
            result = supabase.table('transactions').select('file_source').limit(1).execute()
            print("✅ file_source column EXISTS in transactions table")
            print(f"Sample data: {result}")
            return True
        except Exception as e:
            error_message = str(e)
            if 'column "file_source" does not exist' in error_message or 'file_source' in error_message:
                print("❌ file_source column DOES NOT EXIST in transactions table")
                print("Manual migration required!")
                print("\nTo add the column manually in Supabase SQL Editor:")
                print("1. Go to your Supabase Dashboard > SQL Editor")
                print("2. Run this SQL:")
                print("="*50)
                print("ALTER TABLE transactions ADD COLUMN file_source VARCHAR(255) NULL;")
                print("CREATE INDEX idx_transactions_file_source ON transactions(file_source) WHERE file_source IS NOT NULL;")
                print("UPDATE transactions SET file_source = 'legacy' WHERE file_source IS NULL;")
                print("="*50)
                return False
            else:
                print(f"❓ Unexpected error: {e}")
                return False
                
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    print("🔍 Checking file_source column status...")
    exists = check_file_source_column()
    if not exists:
        print("\n⚠️  Action needed: Add the file_source column manually")
    else:
        print("\n✅ No action needed: Column already exists")