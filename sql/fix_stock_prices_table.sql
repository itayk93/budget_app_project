-- Fix stock_prices table schema issues
-- This script adds missing columns and constraints

-- 1. Add missing ID column (UUID Primary Key)
DO $$ 
BEGIN 
  -- Check if id column exists, if not add it
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

-- 2. Add missing adjusted_close column
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

-- 4. Update column types and constraints to match schema
DO $$ 
BEGIN 
  -- Ensure stock_symbol has proper foreign key reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'stock_prices' 
    AND constraint_name = 'stock_prices_stock_symbol_fkey'
  ) THEN
    -- Check if stocks table exists first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocks') THEN
      ALTER TABLE stock_prices 
      ADD CONSTRAINT stock_prices_stock_symbol_fkey 
      FOREIGN KEY (stock_symbol) REFERENCES stocks(symbol);
      
      RAISE NOTICE 'Added foreign key constraint for stock_symbol';
    ELSE
      RAISE NOTICE 'Stocks table does not exist, skipping foreign key constraint';
    END IF;
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists on stock_symbol';
  END IF;
END $$;

-- 5. Set default values where needed
UPDATE stock_prices 
SET source = 'alpha_vantage' 
WHERE source IS NULL;

-- Verification query
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'stock_prices'
ORDER BY ordinal_position;