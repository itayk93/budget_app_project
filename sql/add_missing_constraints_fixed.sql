-- Add Missing Database Constraints - FIXED VERSION
-- This script adds important data validation constraints that are currently missing
-- Execute after backing up your database!

-- ========================================
-- STEP 0: DISCOVER ACTUAL COLUMN NAMES
-- ========================================

-- First, let's check what columns actually exist in our tables
DO $$ 
DECLARE
    col_record RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DISCOVERING ACTUAL TABLE STRUCTURES';
    RAISE NOTICE '========================================';
    
    -- Check budgets table structure
    RAISE NOTICE 'Columns in budgets table:';
    FOR col_record IN 
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'budgets' 
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  - %: %', col_record.column_name, col_record.data_type;
    END LOOP;
    
    -- Check monthly_goals table structure
    RAISE NOTICE 'Columns in monthly_goals table:';
    FOR col_record IN 
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'monthly_goals' 
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  - %: %', col_record.column_name, col_record.data_type;
    END LOOP;
    
    RAISE NOTICE '========================================';
END $$;

-- ========================================
-- STEP 1: ADD CHECK CONSTRAINTS FOR POSITIVE AMOUNTS (CORRECTED)
-- ========================================

-- Add constraint for positive amounts in budgets table (using correct column name)
DO $$ 
BEGIN
    -- First check if table and typical budget amount columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'amount') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'budgets_positive_amount' 
            AND table_name = 'budgets'
        ) THEN
            ALTER TABLE budgets 
            ADD CONSTRAINT budgets_positive_amount 
            CHECK (amount > 0);
            RAISE NOTICE '✅ Added positive amount constraint to budgets table (amount column)';
        ELSE
            RAISE NOTICE 'ℹ️  Positive amount constraint already exists on budgets table';
        END IF;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'budget_amount') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'budgets_positive_amount' 
            AND table_name = 'budgets'
        ) THEN
            ALTER TABLE budgets 
            ADD CONSTRAINT budgets_positive_amount 
            CHECK (budget_amount > 0);
            RAISE NOTICE '✅ Added positive amount constraint to budgets table (budget_amount column)';
        ELSE
            RAISE NOTICE 'ℹ️  Positive amount constraint already exists on budgets table';
        END IF;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'allocated_amount') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'budgets_positive_amount' 
            AND table_name = 'budgets'
        ) THEN
            ALTER TABLE budgets 
            ADD CONSTRAINT budgets_positive_amount 
            CHECK (allocated_amount > 0);
            RAISE NOTICE '✅ Added positive amount constraint to budgets table (allocated_amount column)';
        ELSE
            RAISE NOTICE 'ℹ️  Positive amount constraint already exists on budgets table';
        END IF;
    ELSE
        RAISE NOTICE '⚠️  Could not find amount column in budgets table - skipping constraint';
    END IF;
END $$;

-- Add constraint for positive monthly goals amounts
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_goals' AND column_name = 'amount') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'monthly_goals_positive_amount' 
            AND table_name = 'monthly_goals'
        ) THEN
            ALTER TABLE monthly_goals 
            ADD CONSTRAINT monthly_goals_positive_amount 
            CHECK (amount > 0);
            RAISE NOTICE '✅ Added positive amount constraint to monthly_goals table';
        ELSE
            RAISE NOTICE 'ℹ️  Positive amount constraint already exists on monthly_goals table';
        END IF;
    ELSE
        RAISE NOTICE '⚠️  Could not find amount column in monthly_goals table - skipping constraint';
    END IF;
END $$;

-- Add constraint for positive stock prices (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_prices') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'stock_prices_positive_prices' 
            AND table_name = 'stock_prices'
        ) THEN
            ALTER TABLE stock_prices 
            ADD CONSTRAINT stock_prices_positive_prices 
            CHECK (
                (open_price IS NULL OR open_price >= 0) AND 
                (high_price IS NULL OR high_price >= 0) AND 
                (low_price IS NULL OR low_price >= 0) AND 
                (close_price IS NULL OR close_price >= 0) AND 
                (adjusted_close IS NULL OR adjusted_close >= 0) AND
                (volume IS NULL OR volume >= 0)
            );
            RAISE NOTICE '✅ Added positive prices constraint to stock_prices table';
        ELSE
            RAISE NOTICE 'ℹ️  Positive prices constraint already exists on stock_prices table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  stock_prices table does not exist - skipping';
    END IF;
END $$;

-- Add constraint for positive stock holdings quantities (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_holdings') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'stock_holdings_positive_values' 
            AND table_name = 'stock_holdings'
        ) THEN
            ALTER TABLE stock_holdings 
            ADD CONSTRAINT stock_holdings_positive_values 
            CHECK (
                (quantity IS NULL OR quantity >= 0) AND 
                (average_cost IS NULL OR average_cost >= 0) AND 
                (total_invested IS NULL OR total_invested >= 0)
            );
            RAISE NOTICE '✅ Added positive values constraint to stock_holdings table';
        ELSE
            RAISE NOTICE 'ℹ️  Positive values constraint already exists on stock_holdings table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  stock_holdings table does not exist - skipping';
    END IF;
END $$;

-- Add constraint for shared category targets (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shared_category_targets') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'shared_category_targets_positive_amount' 
            AND table_name = 'shared_category_targets'
        ) THEN
            ALTER TABLE shared_category_targets 
            ADD CONSTRAINT shared_category_targets_positive_amount 
            CHECK (monthly_target IS NULL OR monthly_target >= 0);
            RAISE NOTICE '✅ Added positive amount constraint to shared_category_targets table';
        ELSE
            RAISE NOTICE 'ℹ️  Positive amount constraint already exists on shared_category_targets table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  shared_category_targets table does not exist - skipping';
    END IF;
END $$;

-- Add constraint for category_order monthly targets
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'category_order') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'category_order_positive_target' 
            AND table_name = 'category_order'
        ) THEN
            ALTER TABLE category_order 
            ADD CONSTRAINT category_order_positive_target 
            CHECK (monthly_target IS NULL OR monthly_target >= 0);
            RAISE NOTICE '✅ Added positive target constraint to category_order table';
        ELSE
            RAISE NOTICE 'ℹ️  Positive target constraint already exists on category_order table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  category_order table does not exist - skipping';
    END IF;
END $$;

-- ========================================
-- STEP 2: ADD FOREIGN KEY CONSTRAINTS
-- ========================================

-- Add foreign key constraint from transactions to cash_flows (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'transactions_cash_flow_id_fkey' 
        AND table_name = 'transactions'
    ) THEN
        -- Check if both tables and columns exist
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transactions') 
           AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cash_flows')
           AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'cash_flow_id')
           AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'cash_flows' AND column_name = 'id') THEN
            ALTER TABLE transactions 
            ADD CONSTRAINT transactions_cash_flow_id_fkey 
            FOREIGN KEY (cash_flow_id) REFERENCES cash_flows(id) ON DELETE SET NULL;
            RAISE NOTICE '✅ Added foreign key constraint: transactions → cash_flows';
        ELSE
            RAISE NOTICE '⚠️  Cannot add FK constraint transactions → cash_flows (missing tables/columns)';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  Foreign key constraint already exists: transactions → cash_flows';
    END IF;
END $$;

-- Add foreign key constraint from transactions to users (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'transactions_user_id_fkey' 
        AND table_name = 'transactions'
    ) THEN
        -- Check if both tables and columns exist
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transactions') 
           AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')
           AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'user_id')
           AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id') THEN
            ALTER TABLE transactions 
            ADD CONSTRAINT transactions_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            RAISE NOTICE '✅ Added foreign key constraint: transactions → users';
        ELSE
            RAISE NOTICE '⚠️  Cannot add FK constraint transactions → users (missing tables/columns)';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  Foreign key constraint already exists: transactions → users';
    END IF;
END $$;

-- Add foreign key constraint from stock_holdings to stocks (if tables exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_holdings') 
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stocks') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'stock_holdings_stock_symbol_fkey' 
            AND table_name = 'stock_holdings'
        ) THEN
            ALTER TABLE stock_holdings 
            ADD CONSTRAINT stock_holdings_stock_symbol_fkey 
            FOREIGN KEY (stock_symbol) REFERENCES stocks(symbol) ON DELETE CASCADE;
            RAISE NOTICE '✅ Added foreign key constraint: stock_holdings → stocks';
        ELSE
            RAISE NOTICE 'ℹ️  Foreign key constraint already exists: stock_holdings → stocks';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  stock_holdings or stocks table does not exist - skipping FK constraint';
    END IF;
END $$;

-- ========================================
-- STEP 3: ADD DATE RANGE CONSTRAINTS
-- ========================================

-- Add constraint for reasonable payment dates in transactions
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transactions')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'payment_date') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'transactions_reasonable_date' 
            AND table_name = 'transactions'
        ) THEN
            ALTER TABLE transactions 
            ADD CONSTRAINT transactions_reasonable_date 
            CHECK (
                payment_date IS NULL OR (
                    payment_date >= '1900-01-01' AND 
                    payment_date <= CURRENT_DATE + INTERVAL '1 day'
                )
            );
            RAISE NOTICE '✅ Added date range constraint to transactions table';
        ELSE
            RAISE NOTICE 'ℹ️  Date range constraint already exists on transactions table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  transactions table or payment_date column does not exist - skipping';
    END IF;
END $$;

-- Add constraint for reasonable stock price dates
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_prices')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'stock_prices' AND column_name = 'price_date') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'stock_prices_reasonable_date' 
            AND table_name = 'stock_prices'
        ) THEN
            ALTER TABLE stock_prices 
            ADD CONSTRAINT stock_prices_reasonable_date 
            CHECK (
                price_date IS NULL OR (
                    price_date >= '1900-01-01' AND 
                    price_date <= CURRENT_DATE
                )
            );
            RAISE NOTICE '✅ Added date range constraint to stock_prices table';
        ELSE
            RAISE NOTICE 'ℹ️  Date range constraint already exists on stock_prices table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  stock_prices table or price_date column does not exist - skipping';
    END IF;
END $$;

-- ========================================
-- STEP 4: ADD DATA VALIDATION CONSTRAINTS
-- ========================================

-- Add constraint for valid currency codes (ISO 4217)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transactions')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'currency') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'transactions_valid_currency' 
            AND table_name = 'transactions'
        ) THEN
            ALTER TABLE transactions 
            ADD CONSTRAINT transactions_valid_currency 
            CHECK (currency IS NULL OR currency IN ('ILS', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NOK', 'DKK'));
            RAISE NOTICE '✅ Added currency validation to transactions table';
        ELSE
            RAISE NOTICE 'ℹ️  Currency validation already exists on transactions table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  transactions table or currency column does not exist - skipping';
    END IF;
END $$;

-- Add constraint for valid currency codes in cash_flows
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cash_flows')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'cash_flows' AND column_name = 'currency') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'cash_flows_valid_currency' 
            AND table_name = 'cash_flows'
        ) THEN
            ALTER TABLE cash_flows 
            ADD CONSTRAINT cash_flows_valid_currency 
            CHECK (currency IS NULL OR currency IN ('ILS', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NOK', 'DKK'));
            RAISE NOTICE '✅ Added currency validation to cash_flows table';
        ELSE
            RAISE NOTICE 'ℹ️  Currency validation already exists on cash_flows table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  cash_flows table or currency column does not exist - skipping';
    END IF;
END $$;

-- Add constraint for valid stock symbols (if stocks table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stocks')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'stocks' AND column_name = 'symbol') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'stocks_valid_symbol' 
            AND table_name = 'stocks'
        ) THEN
            ALTER TABLE stocks 
            ADD CONSTRAINT stocks_valid_symbol 
            CHECK (
                symbol IS NOT NULL AND
                symbol ~ '^[A-Z0-9.-]{1,10}$' AND 
                LENGTH(symbol) >= 1 AND 
                LENGTH(symbol) <= 10
            );
            RAISE NOTICE '✅ Added symbol format validation to stocks table';
        ELSE
            RAISE NOTICE 'ℹ️  Symbol format validation already exists on stocks table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  stocks table or symbol column does not exist - skipping';
    END IF;
END $$;

-- Add constraint for valid email format in users table
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'users_valid_email' 
            AND table_name = 'users'
        ) THEN
            ALTER TABLE users 
            ADD CONSTRAINT users_valid_email 
            CHECK (email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
            RAISE NOTICE '✅ Added email format validation to users table';
        ELSE
            RAISE NOTICE 'ℹ️  Email format validation already exists on users table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  users table or email column does not exist - skipping';
    END IF;
END $$;

-- ========================================
-- STEP 5: VERIFY ALL CONSTRAINTS
-- ========================================

-- Show summary of added constraints
DO $$ 
DECLARE
    constraint_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CONSTRAINT VERIFICATION SUMMARY';
    RAISE NOTICE '========================================';
    
    -- Count check constraints
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'CHECK' 
    AND table_schema = 'public'
    AND (constraint_name LIKE '%positive%'
       OR constraint_name LIKE '%reasonable%'
       OR constraint_name LIKE '%valid%');
    
    RAISE NOTICE 'Total CHECK constraints: %', constraint_count;
    
    -- Count foreign key constraints
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
    AND table_schema = 'public';
    
    RAISE NOTICE 'Total FOREIGN KEY constraints: %', constraint_count;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Constraint additions completed!';
    RAISE NOTICE 'Check the messages above to see which constraints were added';
    RAISE NOTICE '========================================';
END $$;

-- ========================================
-- CONSTRAINT SUMMARY
-- ========================================

/*
CONSTRAINTS THAT SHOULD BE ADDED (if tables/columns exist):

✅ CHECK CONSTRAINTS (Positive Values):
- budgets: amount/budget_amount/allocated_amount > 0 (depending on actual column)
- monthly_goals: amount > 0
- stock_prices: all prices >= 0 (allowing NULL)
- stock_holdings: quantity, average_cost, total_invested >= 0 (allowing NULL)
- shared_category_targets: monthly_target >= 0 (allowing NULL)
- category_order: monthly_target >= 0 (allowing NULL)

✅ FOREIGN KEY CONSTRAINTS:
- transactions → cash_flows (cash_flow_id)
- transactions → users (user_id)
- stock_holdings → stocks (stock_symbol)

✅ DATE RANGE CONSTRAINTS:
- transactions: payment_date between 1900-01-01 and tomorrow (allowing NULL)
- stock_prices: price_date between 1900-01-01 and today (allowing NULL)

✅ DATA VALIDATION CONSTRAINTS:
- transactions/cash_flows: valid ISO currency codes (allowing NULL)
- stocks: valid symbol format (1-10 chars, A-Z0-9.-, NOT NULL)
- users: valid email format (allowing NULL)

BENEFITS:
- Data integrity enforcement at database level
- Prevention of invalid data entry
- Improved data quality and consistency
- Better error messages for invalid operations
- Graceful handling of missing tables/columns

NOTE: This script safely checks for table and column existence before adding constraints.
*/