-- Add Missing Database Constraints - FINAL FIXED VERSION
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
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'budgets') THEN
        RAISE NOTICE 'Columns in budgets table:';
        FOR col_record IN 
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'budgets' 
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  - %: %', col_record.column_name, col_record.data_type;
        END LOOP;
    ELSE
        RAISE NOTICE 'budgets table does not exist';
    END IF;
    
    -- Check stock_prices table structure
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_prices') THEN
        RAISE NOTICE 'Columns in stock_prices table:';
        FOR col_record IN 
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'stock_prices' 
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  - %: %', col_record.column_name, col_record.data_type;
        END LOOP;
    ELSE
        RAISE NOTICE 'stock_prices table does not exist';
    END IF;
    
    -- Check monthly_goals table structure
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'monthly_goals') THEN
        RAISE NOTICE 'Columns in monthly_goals table:';
        FOR col_record IN 
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'monthly_goals' 
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  - %: %', col_record.column_name, col_record.data_type;
        END LOOP;
    ELSE
        RAISE NOTICE 'monthly_goals table does not exist';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- ========================================
-- STEP 1: ADD CHECK CONSTRAINTS FOR POSITIVE AMOUNTS (DYNAMIC)
-- ========================================

-- Add constraint for positive amounts in budgets table (using correct column name)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'budgets') THEN
        -- Try different possible column names for budget amounts
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'amount') THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'budgets_positive_amount' AND table_name = 'budgets'
            ) THEN
                ALTER TABLE budgets ADD CONSTRAINT budgets_positive_amount CHECK (amount > 0);
                RAISE NOTICE '✅ Added positive amount constraint to budgets table (amount column)';
            ELSE
                RAISE NOTICE 'ℹ️  Positive amount constraint already exists on budgets table';
            END IF;
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'budget_amount') THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'budgets_positive_amount' AND table_name = 'budgets'
            ) THEN
                ALTER TABLE budgets ADD CONSTRAINT budgets_positive_amount CHECK (budget_amount > 0);
                RAISE NOTICE '✅ Added positive amount constraint to budgets table (budget_amount column)';
            ELSE
                RAISE NOTICE 'ℹ️  Positive amount constraint already exists on budgets table';
            END IF;
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'allocated_amount') THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'budgets_positive_amount' AND table_name = 'budgets'
            ) THEN
                ALTER TABLE budgets ADD CONSTRAINT budgets_positive_amount CHECK (allocated_amount > 0);
                RAISE NOTICE '✅ Added positive amount constraint to budgets table (allocated_amount column)';
            ELSE
                RAISE NOTICE 'ℹ️  Positive amount constraint already exists on budgets table';
            END IF;
        ELSE
            RAISE NOTICE '⚠️  Could not find amount column in budgets table - skipping constraint';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  budgets table does not exist - skipping';
    END IF;
END $$;

-- Add constraint for positive monthly goals amounts
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'monthly_goals') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_goals' AND column_name = 'amount') THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'monthly_goals_positive_amount' AND table_name = 'monthly_goals'
            ) THEN
                ALTER TABLE monthly_goals ADD CONSTRAINT monthly_goals_positive_amount CHECK (amount > 0);
                RAISE NOTICE '✅ Added positive amount constraint to monthly_goals table';
            ELSE
                RAISE NOTICE 'ℹ️  Positive amount constraint already exists on monthly_goals table';
            END IF;
        ELSE
            RAISE NOTICE '⚠️  Could not find amount column in monthly_goals table - skipping constraint';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  monthly_goals table does not exist - skipping';
    END IF;
END $$;

-- Add constraint for positive stock prices (dynamic column checking)
DO $$ 
DECLARE
    constraint_parts TEXT[] := ARRAY[]::TEXT[];
    constraint_sql TEXT;
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_prices') THEN
        -- Build constraint dynamically based on existing columns
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_prices' AND column_name = 'open_price') THEN
            constraint_parts := array_append(constraint_parts, '(open_price IS NULL OR open_price >= 0)');
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_prices' AND column_name = 'high_price') THEN
            constraint_parts := array_append(constraint_parts, '(high_price IS NULL OR high_price >= 0)');
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_prices' AND column_name = 'low_price') THEN
            constraint_parts := array_append(constraint_parts, '(low_price IS NULL OR low_price >= 0)');
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_prices' AND column_name = 'close_price') THEN
            constraint_parts := array_append(constraint_parts, '(close_price IS NULL OR close_price >= 0)');
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_prices' AND column_name = 'adjusted_close') THEN
            constraint_parts := array_append(constraint_parts, '(adjusted_close IS NULL OR adjusted_close >= 0)');
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_prices' AND column_name = 'volume') THEN
            constraint_parts := array_append(constraint_parts, '(volume IS NULL OR volume >= 0)');
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_prices' AND column_name = 'price') THEN
            constraint_parts := array_append(constraint_parts, '(price IS NULL OR price >= 0)');
        END IF;
        
        -- Only add constraint if we found some price columns
        IF array_length(constraint_parts, 1) > 0 THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'stock_prices_positive_prices' AND table_name = 'stock_prices'
            ) THEN
                constraint_sql := 'ALTER TABLE stock_prices ADD CONSTRAINT stock_prices_positive_prices CHECK (' || array_to_string(constraint_parts, ' AND ') || ')';
                EXECUTE constraint_sql;
                RAISE NOTICE '✅ Added positive prices constraint to stock_prices table (% columns)', array_length(constraint_parts, 1);
            ELSE
                RAISE NOTICE 'ℹ️  Positive prices constraint already exists on stock_prices table';
            END IF;
        ELSE
            RAISE NOTICE '⚠️  No price columns found in stock_prices table - skipping constraint';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  stock_prices table does not exist - skipping';
    END IF;
END $$;

-- Add constraint for positive stock holdings quantities (dynamic column checking)
DO $$ 
DECLARE
    constraint_parts TEXT[] := ARRAY[]::TEXT[];
    constraint_sql TEXT;
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_holdings') THEN
        -- Build constraint dynamically based on existing columns
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_holdings' AND column_name = 'quantity') THEN
            constraint_parts := array_append(constraint_parts, '(quantity IS NULL OR quantity >= 0)');
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_holdings' AND column_name = 'average_cost') THEN
            constraint_parts := array_append(constraint_parts, '(average_cost IS NULL OR average_cost >= 0)');
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_holdings' AND column_name = 'total_invested') THEN
            constraint_parts := array_append(constraint_parts, '(total_invested IS NULL OR total_invested >= 0)');
        END IF;
        
        -- Only add constraint if we found some relevant columns
        IF array_length(constraint_parts, 1) > 0 THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'stock_holdings_positive_values' AND table_name = 'stock_holdings'
            ) THEN
                constraint_sql := 'ALTER TABLE stock_holdings ADD CONSTRAINT stock_holdings_positive_values CHECK (' || array_to_string(constraint_parts, ' AND ') || ')';
                EXECUTE constraint_sql;
                RAISE NOTICE '✅ Added positive values constraint to stock_holdings table (% columns)', array_length(constraint_parts, 1);
            ELSE
                RAISE NOTICE 'ℹ️  Positive values constraint already exists on stock_holdings table';
            END IF;
        ELSE
            RAISE NOTICE '⚠️  No relevant columns found in stock_holdings table - skipping constraint';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  stock_holdings table does not exist - skipping';
    END IF;
END $$;

-- ========================================
-- STEP 2: ADD FOREIGN KEY CONSTRAINTS (SAFE)
-- ========================================

-- Add foreign key constraint from transactions to cash_flows (if not exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transactions') 
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cash_flows')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'cash_flow_id')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'cash_flows' AND column_name = 'id') THEN
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'transactions_cash_flow_id_fkey' AND table_name = 'transactions'
        ) THEN
            ALTER TABLE transactions 
            ADD CONSTRAINT transactions_cash_flow_id_fkey 
            FOREIGN KEY (cash_flow_id) REFERENCES cash_flows(id) ON DELETE SET NULL;
            RAISE NOTICE '✅ Added foreign key constraint: transactions → cash_flows';
        ELSE
            RAISE NOTICE 'ℹ️  Foreign key constraint already exists: transactions → cash_flows';
        END IF;
    ELSE
        RAISE NOTICE '⚠️  Cannot add FK constraint transactions → cash_flows (missing tables/columns)';
    END IF;
END $$;

-- Add foreign key constraint from transactions to users (if not exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transactions') 
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'user_id')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id') THEN
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'transactions_user_id_fkey' AND table_name = 'transactions'
        ) THEN
            ALTER TABLE transactions 
            ADD CONSTRAINT transactions_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            RAISE NOTICE '✅ Added foreign key constraint: transactions → users';
        ELSE
            RAISE NOTICE 'ℹ️  Foreign key constraint already exists: transactions → users';
        END IF;
    ELSE
        RAISE NOTICE '⚠️  Cannot add FK constraint transactions → users (missing tables/columns)';
    END IF;
END $$;

-- ========================================
-- STEP 3: ADD DATE RANGE CONSTRAINTS (SAFE)
-- ========================================

-- Add constraint for reasonable payment dates in transactions
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transactions')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'payment_date') THEN
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'transactions_reasonable_date' AND table_name = 'transactions'
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

-- ========================================
-- STEP 4: ADD DATA VALIDATION CONSTRAINTS (SAFE)
-- ========================================

-- Add constraint for valid currency codes in transactions
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transactions')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'currency') THEN
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'transactions_valid_currency' AND table_name = 'transactions'
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
            WHERE constraint_name = 'cash_flows_valid_currency' AND table_name = 'cash_flows'
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
    RAISE NOTICE '✅ Constraint additions completed successfully!';
    RAISE NOTICE 'All constraints were added safely based on actual table structure';
    RAISE NOTICE '========================================';
END $$;