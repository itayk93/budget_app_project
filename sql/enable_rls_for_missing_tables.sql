-- Enable RLS for Missing Tables
-- This script enables RLS for the tables that are still showing as "Unrestricted"

-- ========================================
-- ENABLE RLS ON MISSING TABLES
-- ========================================

-- Enable RLS on stock tables that are still unrestricted
DO $$ 
BEGIN
    -- Enable RLS on stocks table
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stocks') THEN
        ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ Enabled RLS on stocks table';
        
        -- Add public read policy for stocks (market data)
        DROP POLICY IF EXISTS "stocks_public_read" ON stocks;
        CREATE POLICY "stocks_public_read" ON stocks FOR SELECT 
          TO authenticated USING (true);
        RAISE NOTICE '✅ Added public read policy for stocks table';
        
        -- Add service role bypass policy
        DROP POLICY IF EXISTS "service_role_bypass_stocks" ON stocks;
        CREATE POLICY "service_role_bypass_stocks" ON stocks FOR ALL 
          TO service_role USING (true) WITH CHECK (true);
        RAISE NOTICE '✅ Added service role bypass policy for stocks table';
    ELSE
        RAISE NOTICE 'ℹ️  stocks table does not exist - skipping';
    END IF;
    
    -- Enable RLS on stock_prices table
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_prices') THEN
        ALTER TABLE stock_prices ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ Enabled RLS on stock_prices table';
        
        -- Add public read policy for stock_prices (market data)
        DROP POLICY IF EXISTS "stock_prices_public_read" ON stock_prices;
        CREATE POLICY "stock_prices_public_read" ON stock_prices FOR SELECT 
          TO authenticated USING (true);
        RAISE NOTICE '✅ Added public read policy for stock_prices table';
        
        -- Add service role bypass policy
        DROP POLICY IF EXISTS "service_role_bypass_stock_prices" ON stock_prices;
        CREATE POLICY "service_role_bypass_stock_prices" ON stock_prices FOR ALL 
          TO service_role USING (true) WITH CHECK (true);
        RAISE NOTICE '✅ Added service role bypass policy for stock_prices table';
    ELSE
        RAISE NOTICE 'ℹ️  stock_prices table does not exist - skipping';
    END IF;
    
    -- Enable RLS on stock_prices_backup table
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_prices_backup') THEN
        ALTER TABLE stock_prices_backup ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ Enabled RLS on stock_prices_backup table';
        
        -- Add public read policy for stock_prices_backup
        DROP POLICY IF EXISTS "stock_prices_backup_public_read" ON stock_prices_backup;
        CREATE POLICY "stock_prices_backup_public_read" ON stock_prices_backup FOR SELECT 
          TO authenticated USING (true);
        RAISE NOTICE '✅ Added public read policy for stock_prices_backup table';
        
        -- Add service role bypass policy
        DROP POLICY IF EXISTS "service_role_bypass_stock_prices_backup" ON stock_prices_backup;
        CREATE POLICY "service_role_bypass_stock_prices_backup" ON stock_prices_backup FOR ALL 
          TO service_role USING (true) WITH CHECK (true);
        RAISE NOTICE '✅ Added service role bypass policy for stock_prices_backup table';
    ELSE
        RAISE NOTICE 'ℹ️  stock_prices_backup table does not exist - skipping';
    END IF;
    
    -- Enable RLS on stock_holdings table (user-specific)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_holdings') THEN
        ALTER TABLE stock_holdings ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ Enabled RLS on stock_holdings table';
        
        -- Add user-specific policy for stock_holdings
        DROP POLICY IF EXISTS "stock_holdings_all_own" ON stock_holdings;
        CREATE POLICY "stock_holdings_all_own" ON stock_holdings FOR ALL 
          USING (user_id = (current_setting('app.current_user_id', true))::UUID)
          WITH CHECK (user_id = (current_setting('app.current_user_id', true))::UUID);
        RAISE NOTICE '✅ Added user-specific policy for stock_holdings table';
        
        -- Add service role bypass policy
        DROP POLICY IF EXISTS "service_role_bypass_stock_holdings" ON stock_holdings;
        CREATE POLICY "service_role_bypass_stock_holdings" ON stock_holdings FOR ALL 
          TO service_role USING (true) WITH CHECK (true);
        RAISE NOTICE '✅ Added service role bypass policy for stock_holdings table';
    ELSE
        RAISE NOTICE 'ℹ️  stock_holdings table does not exist - skipping';
    END IF;
    
    -- Enable RLS on other system tables if they exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_system_settings') THEN
        ALTER TABLE stock_system_settings ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ Enabled RLS on stock_system_settings table';
        
        -- Add public read policy for system settings
        DROP POLICY IF EXISTS "stock_system_settings_public_read" ON stock_system_settings;
        CREATE POLICY "stock_system_settings_public_read" ON stock_system_settings FOR SELECT 
          TO authenticated USING (true);
        RAISE NOTICE '✅ Added public read policy for stock_system_settings table';
        
        -- Add service role bypass policy
        DROP POLICY IF EXISTS "service_role_bypass_stock_system_settings" ON stock_system_settings;
        CREATE POLICY "service_role_bypass_stock_system_settings" ON stock_system_settings FOR ALL 
          TO service_role USING (true) WITH CHECK (true);
        RAISE NOTICE '✅ Added service role bypass policy for stock_system_settings table';
    ELSE
        RAISE NOTICE 'ℹ️  stock_system_settings table does not exist - skipping';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_transactions_summary') THEN
        ALTER TABLE stock_transactions_summary ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ Enabled RLS on stock_transactions_summary table';
        
        -- Add user-specific policy for stock_transactions_summary
        DROP POLICY IF EXISTS "stock_transactions_summary_all_own" ON stock_transactions_summary;
        CREATE POLICY "stock_transactions_summary_all_own" ON stock_transactions_summary FOR ALL 
          USING (user_id = (current_setting('app.current_user_id', true))::UUID)
          WITH CHECK (user_id = (current_setting('app.current_user_id', true))::UUID);
        RAISE NOTICE '✅ Added user-specific policy for stock_transactions_summary table';
        
        -- Add service role bypass policy
        DROP POLICY IF EXISTS "service_role_bypass_stock_transactions_summary" ON stock_transactions_summary;
        CREATE POLICY "service_role_bypass_stock_transactions_summary" ON stock_transactions_summary FOR ALL 
          TO service_role USING (true) WITH CHECK (true);
        RAISE NOTICE '✅ Added service role bypass policy for stock_transactions_summary table';
    ELSE
        RAISE NOTICE 'ℹ️  stock_transactions_summary table does not exist - skipping';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
        ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ Enabled RLS on user_preferences table';
        
        -- Add user-specific policy for user_preferences
        DROP POLICY IF EXISTS "user_preferences_all_own" ON user_preferences;
        CREATE POLICY "user_preferences_all_own" ON user_preferences FOR ALL 
          USING (user_id = (current_setting('app.current_user_id', true))::UUID)
          WITH CHECK (user_id = (current_setting('app.current_user_id', true))::UUID);
        RAISE NOTICE '✅ Added user-specific policy for user_preferences table';
        
        -- Add service role bypass policy
        DROP POLICY IF EXISTS "service_role_bypass_user_preferences" ON user_preferences;
        CREATE POLICY "service_role_bypass_user_preferences" ON user_preferences FOR ALL 
          TO service_role USING (true) WITH CHECK (true);
        RAISE NOTICE '✅ Added service role bypass policy for user_preferences table';
    ELSE
        RAISE NOTICE 'ℹ️  user_preferences table does not exist - skipping';
    END IF;
    
    -- Enable RLS on transactions table if not already enabled
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transactions') THEN
        -- Check if RLS is already enabled
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE c.relname = 'transactions' 
            AND n.nspname = 'public'
            AND c.relrowsecurity = true
        ) THEN
            ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
            RAISE NOTICE '✅ Enabled RLS on transactions table';
            
            -- Add user-specific policy for transactions
            DROP POLICY IF EXISTS "transactions_all_own" ON transactions;
            CREATE POLICY "transactions_all_own" ON transactions FOR ALL 
              USING (user_id = (current_setting('app.current_user_id', true))::UUID)
              WITH CHECK (user_id = (current_setting('app.current_user_id', true))::UUID);
            RAISE NOTICE '✅ Added user-specific policy for transactions table';
            
            -- Add service role bypass policy
            DROP POLICY IF EXISTS "service_role_bypass_transactions" ON transactions;
            CREATE POLICY "service_role_bypass_transactions" ON transactions FOR ALL 
              TO service_role USING (true) WITH CHECK (true);
            RAISE NOTICE '✅ Added service role bypass policy for transactions table';
        ELSE
            RAISE NOTICE 'ℹ️  RLS already enabled on transactions table';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  transactions table does not exist - skipping';
    END IF;
    
END $$;

-- ========================================
-- CREATE USER CONTEXT FUNCTION IF NOT EXISTS
-- ========================================

-- Create the user context function if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'get_user_id_from_context'
        AND n.nspname = 'public'
    ) THEN
        CREATE OR REPLACE FUNCTION get_user_id_from_context()
        RETURNS UUID AS $func$
        BEGIN
          -- Try to get user_id from current_setting (will be set by application)
          RETURN current_setting('app.current_user_id', true)::UUID;
        EXCEPTION WHEN OTHERS THEN
          -- Return NULL if not set (will block access)
          RETURN NULL;
        END;
        $func$ LANGUAGE plpgsql SECURITY DEFINER;
        
        RAISE NOTICE '✅ Created get_user_id_from_context() function';
    ELSE
        RAISE NOTICE 'ℹ️  get_user_id_from_context() function already exists';
    END IF;
END $$;

-- ========================================
-- VERIFICATION
-- ========================================

DO $$ 
DECLARE
    unrestricted_count INTEGER;
    restricted_count INTEGER;
    table_name TEXT;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS STATUS VERIFICATION';
    RAISE NOTICE '========================================';
    
    -- Count tables with RLS enabled
    SELECT COUNT(*) INTO restricted_count
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND c.relrowsecurity = true;
    
    -- Count tables without RLS
    SELECT COUNT(*) INTO unrestricted_count
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND c.relrowsecurity = false;
    
    RAISE NOTICE 'Tables with RLS enabled: %', restricted_count;
    RAISE NOTICE 'Tables without RLS: %', unrestricted_count;
    
    -- List unrestricted tables
    IF unrestricted_count > 0 THEN
        RAISE NOTICE 'Tables still without RLS:';
        FOR table_name IN
            SELECT c.relname
            FROM pg_class c
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE c.relkind = 'r'
            AND n.nspname = 'public'
            AND c.relrowsecurity = false
            ORDER BY c.relname
        LOOP
            RAISE NOTICE '  - %', table_name;
        END LOOP;
    ELSE
        RAISE NOTICE '✅ All tables now have RLS enabled!';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- ========================================
-- SUMMARY
-- ========================================

/*
WHAT THIS SCRIPT DOES:

✅ ENABLES RLS ON ALL MISSING TABLES:
- stocks (public market data)
- stock_prices (public market data)  
- stock_prices_backup (public market data)
- stock_holdings (user-specific)
- stock_system_settings (public system data)
- stock_transactions_summary (user-specific)
- user_preferences (user-specific)
- transactions (user-specific, if not already enabled)

✅ ADDS APPROPRIATE POLICIES:
- Public read access for market data tables
- User-specific access for user data tables
- Service role bypass for all tables

✅ CREATES HELPER FUNCTION:
- get_user_id_from_context() for RLS policies

✅ VERIFIES RESULTS:
- Shows count of restricted vs unrestricted tables
- Lists any tables still without RLS

AFTER RUNNING THIS SCRIPT:
All tables should show as "Restricted" in Supabase dashboard!
*/