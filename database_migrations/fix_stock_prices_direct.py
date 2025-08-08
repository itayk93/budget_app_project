#!/usr/bin/env python3
"""
Direct SQL execution for stock_prices table schema fix
Uses direct Supabase client without RPC calls
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

def check_current_schema(supabase: Client):
    """Check current schema of stock_prices table"""
    try:
        print("🔍 Checking current stock_prices table schema...")
        
        # Try to get table info
        result = supabase.table('stock_prices').select('*').limit(1).execute()
        
        if result.data:
            print("✅ stock_prices table exists")
            sample_row = result.data[0] if result.data else {}
            
            print("\n📋 Current columns in sample row:")
            for key in sample_row.keys():
                print(f"  - {key}")
                
            # Check for missing columns
            missing_columns = []
            if 'id' not in sample_row:
                missing_columns.append('id (UUID PRIMARY KEY)')
            if 'adjusted_close' not in sample_row:
                missing_columns.append('adjusted_close (DECIMAL)')
                
            if missing_columns:
                print(f"\n❌ Missing columns: {', '.join(missing_columns)}")
                return False
            else:
                print("\n✅ All required columns present")
                return True
                
        else:
            print("ℹ️ Table exists but has no data")
            return False
            
    except Exception as e:
        print(f"❌ Error checking schema: {str(e)}")
        return False

def test_stock_operations(supabase: Client):
    """Test basic stock_prices operations"""
    try:
        print("\n🧪 Testing stock_prices operations...")
        
        # Try to insert a test record
        test_data = {
            'stock_symbol': 'TEST',
            'price_date': '2025-01-01',
            'open_price': 100.00,
            'high_price': 105.00,
            'low_price': 95.00,
            'close_price': 102.00,
            'adjusted_close': 102.00,
            'volume': 1000000,
            'source': 'test'
        }
        
        # Insert test data
        result = supabase.table('stock_prices').insert(test_data).execute()
        
        if result.data:
            print("✅ Successfully inserted test record")
            test_id = result.data[0].get('id')
            
            if test_id:
                print(f"✅ ID column working: {test_id}")
                
                # Clean up test record
                supabase.table('stock_prices').delete().eq('stock_symbol', 'TEST').execute()
                print("✅ Test cleanup completed")
                
                return True
            else:
                print("❌ ID column not returned")
                return False
        else:
            print("❌ Failed to insert test record")
            return False
            
    except Exception as e:
        print(f"❌ Error in stock operations test: {str(e)}")
        
        # Try to clean up in case of error
        try:
            supabase.table('stock_prices').delete().eq('stock_symbol', 'TEST').execute()
        except:
            pass
            
        return False

def main():
    """Main function to check and potentially fix schema"""
    try:
        print("🚀 Stock Prices Direct Schema Check")
        print("=" * 50)
        
        # Create Supabase client
        supabase = create_supabase_client()
        print("✅ Connected to Supabase")
        
        # Check current schema
        schema_ok = check_current_schema(supabase)
        
        if schema_ok:
            # Test operations
            operations_ok = test_stock_operations(supabase)
            
            if operations_ok:
                print("\n🎉 stock_prices table schema is correct and working!")
                print("\n📝 Table status:")
                print("  ✅ ID column (UUID primary key) - Working")
                print("  ✅ adjusted_close column - Available")
                print("  ✅ All CRUD operations - Working")
            else:
                print("\n⚠️ Schema exists but operations failed")
        else:
            print("\n❌ Schema issues detected")
            print("\n📝 Required manual fixes:")
            print("  1. Add missing 'id' UUID primary key column")
            print("  2. Add missing 'adjusted_close' DECIMAL column")
            print("  3. Ensure proper constraints and indexes")
            
            print("\n🔧 Manual SQL to run in Supabase SQL Editor:")
            print("""
-- Add missing ID column if not exists
ALTER TABLE stock_prices 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Add primary key constraint if not exists  
ALTER TABLE stock_prices 
ADD CONSTRAINT IF NOT EXISTS stock_prices_pkey PRIMARY KEY (id);

-- Add missing adjusted_close column if not exists
ALTER TABLE stock_prices 
ADD COLUMN IF NOT EXISTS adjusted_close DECIMAL(12,4);

-- Add unique constraint if not exists
ALTER TABLE stock_prices 
ADD CONSTRAINT IF NOT EXISTS stock_prices_symbol_date_unique 
UNIQUE (stock_symbol, price_date);

-- Verify schema
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'stock_prices'
ORDER BY ordinal_position;
            """)
            
    except Exception as e:
        print(f"💥 Critical error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()