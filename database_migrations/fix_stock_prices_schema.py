#!/usr/bin/env python3
"""
Fix stock_prices table schema - Add missing ID column and constraints
This script updates the stock_prices table to match the expected schema
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_supabase_client():
    """Create Supabase client from environment variables"""
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SECRET')  # Use service key for admin operations
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SECRET must be set in .env file")
    
    return create_client(url, key)

def fix_stock_prices_table(supabase: Client):
    """Fix the stock_prices table schema"""
    
    # SQL to fix the table schema
    fix_sql = """
    -- 1. Add missing ID column (UUID Primary Key) if not exists
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_prices' AND column_name = 'id'
      ) THEN
        ALTER TABLE stock_prices 
        ADD COLUMN id UUID DEFAULT gen_random_uuid();
        
        -- Make it the primary key
        ALTER TABLE stock_prices 
        ADD CONSTRAINT stock_prices_pkey PRIMARY KEY (id);
        
        RAISE NOTICE 'Added id column with UUID primary key to stock_prices table';
      ELSE
        RAISE NOTICE 'ID column already exists in stock_prices table';
      END IF;
    END $$;
    
    -- 2. Add missing adjusted_close column if not exists
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_prices' AND column_name = 'adjusted_close'
      ) THEN
        ALTER TABLE stock_prices 
        ADD COLUMN adjusted_close DECIMAL(12,4);
        
        RAISE NOTICE 'Added adjusted_close column to stock_prices table';
      ELSE
        RAISE NOTICE 'adjusted_close column already exists in stock_prices table';
      END IF;
    END $$;
    
    -- 3. Ensure proper constraints exist
    DO $$ 
    BEGIN 
      -- Add unique constraint if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'stock_prices' 
        AND constraint_name = 'stock_prices_symbol_date_unique'
      ) THEN
        ALTER TABLE stock_prices 
        ADD CONSTRAINT stock_prices_symbol_date_unique 
        UNIQUE (stock_symbol, price_date);
        
        RAISE NOTICE 'Added unique constraint on stock_symbol and price_date';
      ELSE
        RAISE NOTICE 'Unique constraint already exists on stock_prices table';
      END IF;
    END $$;
    
    -- 4. Set default values where needed
    UPDATE stock_prices 
    SET source = 'alpha_vantage' 
    WHERE source IS NULL;
    """
    
    try:
        print("🔄 Starting stock_prices table schema fix...")
        
        # Execute the schema fix
        result = supabase.rpc('exec_sql', {'sql': fix_sql}).execute()
        
        print("✅ Successfully executed schema fix")
        
        # Verify the schema
        print("\n🔍 Verifying current schema...")
        
        verify_sql = """
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'stock_prices'
        ORDER BY ordinal_position;
        """
        
        schema_result = supabase.rpc('exec_sql', {'sql': verify_sql}).execute()
        
        if schema_result.data:
            print("\n📋 Current stock_prices table schema:")
            for column in schema_result.data:
                nullable = "NULL" if column['is_nullable'] == 'YES' else "NOT NULL"
                default = f"DEFAULT {column['column_default']}" if column['column_default'] else ""
                print(f"  - {column['column_name']}: {column['data_type']} {nullable} {default}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error fixing stock_prices schema: {str(e)}")
        return False

def main():
    """Main function to run the schema fix"""
    try:
        print("🚀 Stock Prices Table Schema Fix")
        print("=" * 50)
        
        # Create Supabase client
        supabase = create_supabase_client()
        print("✅ Connected to Supabase")
        
        # Fix the schema
        success = fix_stock_prices_table(supabase)
        
        if success:
            print("\n🎉 Schema fix completed successfully!")
            print("\n📝 What was fixed:")
            print("  ✅ Added missing 'id' UUID primary key column")
            print("  ✅ Added missing 'adjusted_close' DECIMAL column")
            print("  ✅ Added unique constraint on (stock_symbol, price_date)")
            print("  ✅ Set default 'source' values to 'alpha_vantage'")
        else:
            print("\n❌ Schema fix failed!")
            sys.exit(1)
            
    except Exception as e:
        print(f"💥 Critical error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()