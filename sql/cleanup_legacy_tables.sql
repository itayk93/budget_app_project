-- Cleanup Legacy and Unnecessary Tables
-- This script removes deprecated tables that are no longer used
-- Execute with caution - backup your database first!

-- ========================================
-- STEP 1: VERIFY TABLES EXIST AND CHECK USAGE
-- ========================================

-- Check if legacy tables exist and their current state
DO $$ 
BEGIN
    -- Check monthly_budget table (legacy)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'monthly_budget') THEN
        RAISE NOTICE 'Found monthly_budget table - will be dropped (superseded by budgets table)';
        
        -- Show row count for reference
        PERFORM count(*) FROM monthly_budget;
        GET DIAGNOSTICS ROW_COUNT = ROW_COUNT;
        RAISE NOTICE 'monthly_budget contains % rows', ROW_COUNT;
    ELSE
        RAISE NOTICE 'monthly_budget table does not exist - skipping';
    END IF;
    
    -- Check monthly_savings table (legacy)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'monthly_savings') THEN
        RAISE NOTICE 'Found monthly_savings table - will be dropped (superseded by monthly_goals table)';
        
        -- Show row count for reference
        PERFORM count(*) FROM monthly_savings;
        GET DIAGNOSTICS ROW_COUNT = ROW_COUNT;
        RAISE NOTICE 'monthly_savings contains % rows', ROW_COUNT;
    ELSE
        RAISE NOTICE 'monthly_savings table does not exist - skipping';
    END IF;
    
    -- Check backup tables
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'category_order_backup') THEN
        RAISE NOTICE 'Found category_order_backup table - will be dropped if confirmed';
        
        -- Show row count and creation date for reference
        PERFORM count(*) FROM category_order_backup;
        GET DIAGNOSTICS ROW_COUNT = ROW_COUNT;
        RAISE NOTICE 'category_order_backup contains % rows', ROW_COUNT;
    ELSE
        RAISE NOTICE 'category_order_backup table does not exist - skipping';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_prices_backup') THEN
        RAISE NOTICE 'Found stock_prices_backup table - will be dropped if confirmed';
        
        -- Show row count for reference
        PERFORM count(*) FROM stock_prices_backup;
        GET DIAGNOSTICS ROW_COUNT = ROW_COUNT;
        RAISE NOTICE 'stock_prices_backup contains % rows', ROW_COUNT;
    ELSE
        RAISE NOTICE 'stock_prices_backup table does not exist - skipping';
    END IF;
END $$;

-- ========================================
-- STEP 2: DROP LEGACY TABLES (SAFE TO REMOVE)
-- ========================================

-- Drop monthly_budget table (superseded by budgets table)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'monthly_budget') THEN
        RAISE NOTICE 'Dropping monthly_budget table (legacy)...';
        
        -- First drop any policies if RLS was enabled
        DROP POLICY IF EXISTS "Users can view own budgets" ON monthly_budget;
        DROP POLICY IF EXISTS "Users can insert own budgets" ON monthly_budget;
        DROP POLICY IF EXISTS "Users can update own budgets" ON monthly_budget;
        DROP POLICY IF EXISTS "Users can delete own budgets" ON monthly_budget;
        DROP POLICY IF EXISTS "service_role_bypass_monthly_budget" ON monthly_budget;
        
        -- Drop the table
        DROP TABLE monthly_budget CASCADE;
        RAISE NOTICE '✅ monthly_budget table dropped successfully';
    ELSE
        RAISE NOTICE 'monthly_budget table does not exist - skipping';
    END IF;
END $$;

-- Drop monthly_savings table (superseded by monthly_goals table)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'monthly_savings') THEN
        RAISE NOTICE 'Dropping monthly_savings table (legacy)...';
        
        -- First drop any policies if RLS was enabled
        DROP POLICY IF EXISTS "Users can view own savings" ON monthly_savings;
        DROP POLICY IF EXISTS "Users can insert own savings" ON monthly_savings;
        DROP POLICY IF EXISTS "Users can update own savings" ON monthly_savings;
        DROP POLICY IF EXISTS "Users can delete own savings" ON monthly_savings;
        DROP POLICY IF EXISTS "service_role_bypass_monthly_savings" ON monthly_savings;
        
        -- Drop the table
        DROP TABLE monthly_savings CASCADE;
        RAISE NOTICE '✅ monthly_savings table dropped successfully';
    ELSE
        RAISE NOTICE 'monthly_savings table does not exist - skipping';
    END IF;
END $$;

-- ========================================
-- STEP 3: DROP BACKUP TABLES (CONDITIONAL)
-- ========================================
-- UNCOMMENT THESE SECTIONS ONLY AFTER CONFIRMING THE BACKUPS ARE NO LONGER NEEDED

/*
-- Drop category_order_backup table
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'category_order_backup') THEN
        RAISE NOTICE 'Dropping category_order_backup table...';
        
        -- First drop any policies if RLS was enabled
        DROP POLICY IF EXISTS "category_order_backup_all_own" ON category_order_backup;
        DROP POLICY IF EXISTS "service_role_bypass_category_order_backup" ON category_order_backup;
        
        -- Drop the table
        DROP TABLE category_order_backup CASCADE;
        RAISE NOTICE '✅ category_order_backup table dropped successfully';
    ELSE
        RAISE NOTICE 'category_order_backup table does not exist - skipping';
    END IF;
END $$;
*/

/*
-- Drop stock_prices_backup table
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_prices_backup') THEN
        RAISE NOTICE 'Dropping stock_prices_backup table...';
        
        -- First drop any policies if RLS was enabled
        DROP POLICY IF EXISTS "stock_prices_backup_public_read" ON stock_prices_backup;
        DROP POLICY IF EXISTS "service_role_bypass_stock_prices_backup" ON stock_prices_backup;
        
        -- Drop the table
        DROP TABLE stock_prices_backup CASCADE;
        RAISE NOTICE '✅ stock_prices_backup table dropped successfully';
    ELSE
        RAISE NOTICE 'stock_prices_backup table does not exist - skipping';
    END IF;
END $$;
*/

-- ========================================
-- STEP 4: VERIFY CLEANUP
-- ========================================

-- Verify that legacy tables have been removed
DO $$ 
DECLARE
    tables_found INTEGER := 0;
BEGIN
    -- Check if any legacy tables still exist
    SELECT COUNT(*) INTO tables_found
    FROM information_schema.tables 
    WHERE table_name IN ('monthly_budget', 'monthly_savings');
    
    IF tables_found = 0 THEN
        RAISE NOTICE '✅ All legacy tables have been successfully removed';
    ELSE
        RAISE NOTICE '⚠️  Some legacy tables still exist - check for errors above';
    END IF;
    
    -- Show remaining backup tables
    SELECT COUNT(*) INTO tables_found
    FROM information_schema.tables 
    WHERE table_name IN ('category_order_backup', 'stock_prices_backup');
    
    IF tables_found > 0 THEN
        RAISE NOTICE 'ℹ️  % backup table(s) still exist (uncomment sections above to remove)', tables_found;
    ELSE
        RAISE NOTICE '✅ No backup tables remain';
    END IF;
END $$;

-- ========================================
-- CLEANUP SUMMARY
-- ========================================

/*
TABLES REMOVED:
✅ monthly_budget (legacy) - superseded by budgets table
✅ monthly_savings (legacy) - superseded by monthly_goals table

TABLES CONDITIONALLY REMOVED (uncomment to execute):
⚠️  category_order_backup - backup table (verify not needed)
⚠️  stock_prices_backup - backup table (verify not needed)

BENEFITS:
- Reduced database size
- Eliminated confusion from duplicate table names
- Improved security by removing unused RLS policies
- Cleaner schema for better maintainability

NEXT STEPS:
1. Monitor application for any errors
2. Update any remaining code references to legacy tables
3. Consider uncommenting backup table removal after verification
*/