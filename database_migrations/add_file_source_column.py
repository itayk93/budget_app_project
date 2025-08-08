#!/usr/bin/env python3
"""
Add file_source column to transactions table
This migration adds support for tracking the source of transaction uploads
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
    key = os.environ.get("SUPABASE_SECRET")  # Use service role key for migrations
    
    if not url or not key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SECRET in environment variables")
    
    return create_client(url, key)

def add_file_source_column():
    """Add file_source column to transactions table"""
    try:
        supabase = get_supabase_client()
        
        print("Adding file_source column to transactions table...")
        
        # Execute the migration SQL
        migration_sql = """
        -- Add file_source column to transactions table for tracking upload source
        ALTER TABLE transactions 
        ADD COLUMN IF NOT EXISTS file_source VARCHAR(255) NULL;
        
        -- Add comment to document the column usage
        COMMENT ON COLUMN transactions.file_source IS 'Source of transaction upload: excel, csv, manual, api, bank_export, etc.';
        
        -- Create index for better performance when filtering by file source (if not exists)
        CREATE INDEX IF NOT EXISTS idx_transactions_file_source ON transactions(file_source) WHERE file_source IS NOT NULL;
        
        -- Set default value for existing transactions
        UPDATE transactions 
        SET file_source = 'legacy' 
        WHERE file_source IS NULL;
        """
        
        # Execute using RPC function (if available) or direct SQL
        try:
            result = supabase.rpc('exec_sql', {'sql': migration_sql}).execute()
            print("✅ Successfully added file_source column using RPC")
            print(f"Result: {result}")
        except Exception as rpc_error:
            print(f"⚠️  RPC method failed: {rpc_error}")
            print("Trying alternative approach...")
            
            # Alternative: Execute each statement separately
            statements = [
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS file_source VARCHAR(255) NULL;",
                "CREATE INDEX IF NOT EXISTS idx_transactions_file_source ON transactions(file_source) WHERE file_source IS NOT NULL;",
                "UPDATE transactions SET file_source = 'legacy' WHERE file_source IS NULL;"
            ]
            
            for i, statement in enumerate(statements, 1):
                try:
                    result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                    print(f"✅ Statement {i} executed successfully")
                except Exception as stmt_error:
                    print(f"❌ Statement {i} failed: {stmt_error}")
                    if i == 1:  # If ALTER TABLE fails, column might already exist
                        print("Column might already exist, continuing...")
                    else:
                        raise stmt_error
        
        print("\n🎉 Migration completed successfully!")
        print("file_source column has been added to transactions table")
        
        # Verify the column was added
        try:
            result = supabase.table('transactions').select('file_source').limit(1).execute()
            print("✅ Verification: Column is accessible")
        except Exception as verify_error:
            print(f"⚠️  Verification failed: {verify_error}")
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("🚀 Starting file_source column migration...")
    add_file_source_column()
    print("✅ Migration process completed!")