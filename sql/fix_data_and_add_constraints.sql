-- Fix Data Issues and Add Constraints Safely
-- This script identifies and fixes data issues before adding constraints

-- ========================================
-- STEP 1: IDENTIFY DATA ISSUES
-- ========================================

-- Check for problematic dates in transactions
DO $$ 
DECLARE
    problem_count INTEGER;
    min_date DATE;
    max_date DATE;
    future_count INTEGER;
    old_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ANALYZING TRANSACTION DATES';
    RAISE NOTICE '========================================';
    
    -- Get date range in transactions
    SELECT MIN(payment_date), MAX(payment_date) INTO min_date, max_date
    FROM transactions 
    WHERE payment_date IS NOT NULL;
    
    RAISE NOTICE 'Date range in transactions: % to %', min_date, max_date;
    
    -- Count future dates (beyond tomorrow)
    SELECT COUNT(*) INTO future_count
    FROM transactions 
    WHERE payment_date > CURRENT_DATE + INTERVAL '1 day';
    
    -- Count very old dates (before 1900)
    SELECT COUNT(*) INTO old_count
    FROM transactions 
    WHERE payment_date < '1900-01-01';
    
    RAISE NOTICE 'Transactions with future dates (beyond tomorrow): %', future_count;
    RAISE NOTICE 'Transactions with very old dates (before 1900): %', old_count;
    
    -- Show some examples of problematic dates
    IF future_count > 0 THEN
        RAISE NOTICE 'Examples of future dates:';
        FOR problem_count IN 1..LEAST(5, future_count) LOOP
            SELECT payment_date INTO min_date
            FROM transactions 
            WHERE payment_date > CURRENT_DATE + INTERVAL '1 day'
            LIMIT 1 OFFSET (problem_count - 1);
            RAISE NOTICE '  - %', min_date;
        END LOOP;
    END IF;
    
    IF old_count > 0 THEN
        RAISE NOTICE 'Examples of very old dates:';
        FOR problem_count IN 1..LEAST(5, old_count) LOOP
            SELECT payment_date INTO min_date
            FROM transactions 
            WHERE payment_date < '1900-01-01'
            LIMIT 1 OFFSET (problem_count - 1);
            RAISE NOTICE '  - %', min_date;
        END LOOP;
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- ========================================
-- STEP 2: FIX DATA ISSUES (OPTIONAL)
-- ========================================

-- UNCOMMENT THE SECTIONS BELOW TO FIX THE DATA ISSUES
-- Only do this after reviewing the problematic dates above!

/*
-- Option 1: Set future dates to today
DO $$ 
DECLARE
    update_count INTEGER;
BEGIN
    UPDATE transactions 
    SET payment_date = CURRENT_DATE
    WHERE payment_date > CURRENT_DATE + INTERVAL '1 day';
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RAISE NOTICE 'Fixed % transactions with future dates (set to today)', update_count;
END $$;
*/

/*
-- Option 2: Set very old dates to a reasonable default (e.g., 2000-01-01)
DO $$ 
DECLARE
    update_count INTEGER;
BEGIN
    UPDATE transactions 
    SET payment_date = '2000-01-01'
    WHERE payment_date < '1900-01-01';
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RAISE NOTICE 'Fixed % transactions with very old dates (set to 2000-01-01)', update_count;
END $$;
*/

/*
-- Option 3: Set all problematic dates to NULL
DO $$ 
DECLARE
    update_count INTEGER;
BEGIN
    UPDATE transactions 
    SET payment_date = NULL
    WHERE payment_date < '1900-01-01' OR payment_date > CURRENT_DATE + INTERVAL '1 day';
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RAISE NOTICE 'Set % problematic transaction dates to NULL', update_count;
END $$;
*/

-- ========================================
-- STEP 3: ADD CONSTRAINTS WITH RELAXED DATE RANGE
-- ========================================

-- Add constraint for reasonable payment dates (more permissive)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transactions')
       AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'payment_date') THEN
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'transactions_reasonable_date' AND table_name = 'transactions'
        ) THEN
            -- More permissive date range: 1950 to 10 years in the future
            ALTER TABLE transactions 
            ADD CONSTRAINT transactions_reasonable_date 
            CHECK (
                payment_date IS NULL OR (
                    payment_date >= '1950-01-01' AND 
                    payment_date <= CURRENT_DATE + INTERVAL '10 years'
                )
            );
            RAISE NOTICE '✅ Added relaxed date range constraint to transactions table';
        ELSE
            RAISE NOTICE 'ℹ️  Date range constraint already exists on transactions table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  transactions table or payment_date column does not exist - skipping';
    END IF;
END $$;

-- ========================================
-- STEP 4: ADD OTHER SAFE CONSTRAINTS
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

-- Add foreign key constraints (safe)
DO $$ 
BEGIN
    -- transactions → cash_flows
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
    
    -- transactions → users
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
-- STEP 5: ADD POSITIVE AMOUNT CONSTRAINTS FOR OTHER TABLES
-- ========================================

-- Add constraint for positive amounts in monthly_goals
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

-- ========================================
-- STEP 6: VERIFICATION
-- ========================================

DO $$ 
DECLARE
    constraint_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CONSTRAINT SUMMARY';
    RAISE NOTICE '========================================';
    
    -- Count constraints
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'CHECK' 
    AND table_schema = 'public';
    
    RAISE NOTICE 'Total CHECK constraints in database: %', constraint_count;
    
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
    AND table_schema = 'public';
    
    RAISE NOTICE 'Total FOREIGN KEY constraints in database: %', constraint_count;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Constraint addition completed!';
    RAISE NOTICE 'Review the messages above for details';
    RAISE NOTICE '========================================';
END $$;

-- ========================================
-- MANUAL FIXES NEEDED
-- ========================================

/*
INSTRUCTIONS FOR FIXING DATA:

1. REVIEW THE DATE ANALYSIS ABOVE
   - Check which dates are problematic
   - Decide if they should be corrected or removed

2. CHOOSE A FIX STRATEGY:
   - Option A: Update future dates to today
   - Option B: Update old dates to reasonable default
   - Option C: Set problematic dates to NULL
   - Option D: Keep as-is and use relaxed constraints

3. UNCOMMENT THE APPROPRIATE FIX SECTION ABOVE

4. RE-RUN THIS SCRIPT

CURRENT STATUS:
- Script uses relaxed date constraints (1950 to +10 years)
- If you want stricter constraints, fix the data first
- All other constraints should be added successfully
*/