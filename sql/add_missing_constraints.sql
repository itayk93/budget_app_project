-- Add Missing Database Constraints
-- This script adds important data validation constraints that are currently missing
-- Execute after backing up your database!

-- ========================================
-- STEP 1: ADD CHECK CONSTRAINTS FOR POSITIVE AMOUNTS
-- ========================================

-- Add constraint for positive budget amounts
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'budgets_positive_amount' 
        AND table_name = 'budgets'
    ) THEN
        ALTER TABLE budgets 
        ADD CONSTRAINT budgets_positive_amount 
        CHECK (budget_amount > 0);
        RAISE NOTICE '✅ Added positive amount constraint to budgets table';
    ELSE
        RAISE NOTICE 'ℹ️  Positive amount constraint already exists on budgets table';
    END IF;
END $$;

-- Add constraint for positive monthly goals amounts
DO $$ 
BEGIN
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
END $$;

-- Add constraint for positive stock prices
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stock_prices_positive_prices' 
        AND table_name = 'stock_prices'
    ) THEN
        ALTER TABLE stock_prices 
        ADD CONSTRAINT stock_prices_positive_prices 
        CHECK (
            open_price >= 0 AND 
            high_price >= 0 AND 
            low_price >= 0 AND 
            close_price >= 0 AND 
            adjusted_close >= 0 AND
            volume >= 0
        );
        RAISE NOTICE '✅ Added positive prices constraint to stock_prices table';
    ELSE
        RAISE NOTICE 'ℹ️  Positive prices constraint already exists on stock_prices table';
    END IF;
END $$;

-- Add constraint for positive stock holdings quantities
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stock_holdings_positive_values' 
        AND table_name = 'stock_holdings'
    ) THEN
        ALTER TABLE stock_holdings 
        ADD CONSTRAINT stock_holdings_positive_values 
        CHECK (
            quantity >= 0 AND 
            average_cost >= 0 AND 
            total_invested >= 0
        );
        RAISE NOTICE '✅ Added positive values constraint to stock_holdings table';
    ELSE
        RAISE NOTICE 'ℹ️  Positive values constraint already exists on stock_holdings table';
    END IF;
END $$;

-- Add constraint for shared category targets
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'shared_category_targets_positive_amount' 
        AND table_name = 'shared_category_targets'
    ) THEN
        ALTER TABLE shared_category_targets 
        ADD CONSTRAINT shared_category_targets_positive_amount 
        CHECK (monthly_target >= 0);
        RAISE NOTICE '✅ Added positive amount constraint to shared_category_targets table';
    ELSE
        RAISE NOTICE 'ℹ️  Positive amount constraint already exists on shared_category_targets table';
    END IF;
END $$;

-- Add constraint for category_order monthly targets
DO $$ 
BEGIN
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
        ALTER TABLE transactions 
        ADD CONSTRAINT transactions_cash_flow_id_fkey 
        FOREIGN KEY (cash_flow_id) REFERENCES cash_flows(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added foreign key constraint: transactions → cash_flows';
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
        ALTER TABLE transactions 
        ADD CONSTRAINT transactions_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added foreign key constraint: transactions → users';
    ELSE
        RAISE NOTICE 'ℹ️  Foreign key constraint already exists: transactions → users';
    END IF;
END $$;

-- Add foreign key constraint from stock_holdings to stocks (if not exists)
DO $$ 
BEGIN
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
END $$;

-- Add foreign key constraint from stock_prices to stocks (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stock_prices_stock_symbol_fkey' 
        AND table_name = 'stock_prices'
    ) THEN
        ALTER TABLE stock_prices 
        ADD CONSTRAINT stock_prices_stock_symbol_fkey 
        FOREIGN KEY (stock_symbol) REFERENCES stocks(symbol) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added foreign key constraint: stock_prices → stocks';
    ELSE
        RAISE NOTICE 'ℹ️  Foreign key constraint already exists: stock_prices → stocks';
    END IF;
END $$;

-- ========================================
-- STEP 3: ADD DATE RANGE CONSTRAINTS
-- ========================================

-- Add constraint for reasonable payment dates in transactions (no future dates beyond tomorrow)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'transactions_reasonable_date' 
        AND table_name = 'transactions'
    ) THEN
        ALTER TABLE transactions 
        ADD CONSTRAINT transactions_reasonable_date 
        CHECK (
            payment_date >= '1900-01-01' AND 
            payment_date <= CURRENT_DATE + INTERVAL '1 day'
        );
        RAISE NOTICE '✅ Added date range constraint to transactions table';
    ELSE
        RAISE NOTICE 'ℹ️  Date range constraint already exists on transactions table';
    END IF;
END $$;

-- Add constraint for reasonable stock price dates (no future dates)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stock_prices_reasonable_date' 
        AND table_name = 'stock_prices'
    ) THEN
        ALTER TABLE stock_prices 
        ADD CONSTRAINT stock_prices_reasonable_date 
        CHECK (
            price_date >= '1900-01-01' AND 
            price_date <= CURRENT_DATE
        );
        RAISE NOTICE '✅ Added date range constraint to stock_prices table';
    ELSE
        RAISE NOTICE 'ℹ️  Date range constraint already exists on stock_prices table';
    END IF;
END $$;

-- Add constraint for reasonable dates in stock_holdings
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stock_holdings_reasonable_dates' 
        AND table_name = 'stock_holdings'
    ) THEN
        ALTER TABLE stock_holdings 
        ADD CONSTRAINT stock_holdings_reasonable_dates 
        CHECK (
            (first_purchase_date IS NULL OR first_purchase_date >= '1900-01-01') AND
            (last_transaction_date IS NULL OR last_transaction_date >= '1900-01-01') AND
            (first_purchase_date IS NULL OR last_transaction_date IS NULL OR 
             first_purchase_date <= last_transaction_date)
        );
        RAISE NOTICE '✅ Added date range constraints to stock_holdings table';
    ELSE
        RAISE NOTICE 'ℹ️  Date range constraints already exist on stock_holdings table';
    END IF;
END $$;

-- Add constraint for valid month/year in budgets
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'budgets_valid_month_year' 
        AND table_name = 'budgets'
    ) THEN
        ALTER TABLE budgets 
        ADD CONSTRAINT budgets_valid_month_year 
        CHECK (
            month >= 1 AND month <= 12 AND
            year >= 1900 AND year <= 2100
        );
        RAISE NOTICE '✅ Added month/year constraints to budgets table';
    ELSE
        RAISE NOTICE 'ℹ️  Month/year constraints already exist on budgets table';
    END IF;
END $$;

-- Add constraint for valid month/year in monthly_goals (if columns exist)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'monthly_goals' AND column_name = 'month'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'monthly_goals_valid_month_year' 
            AND table_name = 'monthly_goals'
        ) THEN
            ALTER TABLE monthly_goals 
            ADD CONSTRAINT monthly_goals_valid_month_year 
            CHECK (
                month >= 1 AND month <= 12 AND
                year >= 1900 AND year <= 2100 AND
                (specific_month IS NULL OR (specific_month >= 1 AND specific_month <= 12)) AND
                (specific_year IS NULL OR (specific_year >= 1900 AND specific_year <= 2100))
            );
            RAISE NOTICE '✅ Added month/year constraints to monthly_goals table';
        ELSE
            RAISE NOTICE 'ℹ️  Month/year constraints already exist on monthly_goals table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  Monthly_goals table does not have month/year columns - skipping';
    END IF;
END $$;

-- ========================================
-- STEP 4: ADD DATA VALIDATION CONSTRAINTS
-- ========================================

-- Add constraint for valid currency codes (ISO 4217)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'transactions_valid_currency' 
        AND table_name = 'transactions'
    ) THEN
        ALTER TABLE transactions 
        ADD CONSTRAINT transactions_valid_currency 
        CHECK (currency IN ('ILS', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NOK', 'DKK'));
        RAISE NOTICE '✅ Added currency validation to transactions table';
    ELSE
        RAISE NOTICE 'ℹ️  Currency validation already exists on transactions table';
    END IF;
END $$;

-- Add constraint for valid currency codes in cash_flows
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'cash_flows_valid_currency' 
        AND table_name = 'cash_flows'
    ) THEN
        ALTER TABLE cash_flows 
        ADD CONSTRAINT cash_flows_valid_currency 
        CHECK (currency IN ('ILS', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NOK', 'DKK'));
        RAISE NOTICE '✅ Added currency validation to cash_flows table';
    ELSE
        RAISE NOTICE 'ℹ️  Currency validation already exists on cash_flows table';
    END IF;
END $$;

-- Add constraint for valid stock symbols (basic format validation)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stocks_valid_symbol' 
        AND table_name = 'stocks'
    ) THEN
        ALTER TABLE stocks 
        ADD CONSTRAINT stocks_valid_symbol 
        CHECK (
            symbol ~ '^[A-Z0-9.-]{1,10}$' AND 
            LENGTH(symbol) >= 1 AND 
            LENGTH(symbol) <= 10
        );
        RAISE NOTICE '✅ Added symbol format validation to stocks table';
    ELSE
        RAISE NOTICE 'ℹ️  Symbol format validation already exists on stocks table';
    END IF;
END $$;

-- Add constraint for valid email format in users table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_valid_email' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT users_valid_email 
        CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
        RAISE NOTICE '✅ Added email format validation to users table';
    ELSE
        RAISE NOTICE 'ℹ️  Email format validation already exists on users table';
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
    AND constraint_name LIKE '%positive%'
       OR constraint_name LIKE '%reasonable%'
       OR constraint_name LIKE '%valid%';
    
    RAISE NOTICE 'Total CHECK constraints added: %', constraint_count;
    
    -- Count foreign key constraints
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
    AND table_schema = 'public';
    
    RAISE NOTICE 'Total FOREIGN KEY constraints: %', constraint_count;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ All constraint additions completed!';
    RAISE NOTICE '========================================';
END $$;

-- ========================================
-- CONSTRAINT SUMMARY
-- ========================================

/*
CONSTRAINTS ADDED:

✅ CHECK CONSTRAINTS (Positive Values):
- budgets: budget_amount > 0
- monthly_goals: amount > 0
- stock_prices: all prices >= 0
- stock_holdings: quantity, average_cost, total_invested >= 0
- shared_category_targets: monthly_target >= 0
- category_order: monthly_target >= 0 (if not null)

✅ FOREIGN KEY CONSTRAINTS:
- transactions → cash_flows (cash_flow_id)
- transactions → users (user_id)
- stock_holdings → stocks (stock_symbol)
- stock_prices → stocks (stock_symbol)

✅ DATE RANGE CONSTRAINTS:
- transactions: payment_date between 1900-01-01 and tomorrow
- stock_prices: price_date between 1900-01-01 and today
- stock_holdings: logical date ordering
- budgets/monthly_goals: valid month (1-12) and year (1900-2100)

✅ DATA VALIDATION CONSTRAINTS:
- transactions/cash_flows: valid ISO currency codes
- stocks: valid symbol format (1-10 chars, A-Z0-9.-)
- users: valid email format

BENEFITS:
- Data integrity enforcement at database level
- Prevention of invalid data entry
- Improved data quality and consistency
- Better error messages for invalid operations
- Reduced need for application-level validation

NEXT STEPS:
1. Test application functionality with new constraints
2. Update application error handling for constraint violations
3. Consider adding indexes on foreign key columns for performance
*/