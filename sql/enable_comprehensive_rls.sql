-- Comprehensive RLS Implementation for Budget App
-- This script enables RLS with proper user context for all user tables
-- Works with custom JWT authentication system

-- First, create a function to extract user_id from JWT token context
-- This will be set by the application layer when making database calls
CREATE OR REPLACE FUNCTION get_user_id_from_context()
RETURNS UUID AS $$
BEGIN
  -- Try to get user_id from current_setting (will be set by application)
  RETURN current_setting('app.current_user_id', true)::UUID;
EXCEPTION WHEN OTHERS THEN
  -- Return NULL if not set (will block access)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all user-specific tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE category ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_holdings ENABLE ROW LEVEL SECURITY;

-- Also enable on backup tables to prevent leaks
ALTER TABLE category_order_backup ENABLE ROW LEVEL SECURITY;

-- Enable RLS on additional system tables if they exist
DO $$ 
BEGIN
    -- Check if tables exist before enabling RLS
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_system_settings') THEN
        ALTER TABLE stock_system_settings ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_transactions_summary') THEN
        ALTER TABLE stock_transactions_summary ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_portfolio_performance') THEN
        ALTER TABLE daily_portfolio_performance ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
        ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'watchlist') THEN
        ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories') THEN
        ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_alerts') THEN
        ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Enable RLS on stock market data tables for consistency
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices_backup ENABLE ROW LEVEL SECURITY;

-- ===== USER TABLE POLICIES =====
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;

CREATE POLICY "users_select_own" ON users FOR SELECT 
  USING (id = get_user_id_from_context());

CREATE POLICY "users_update_own" ON users FOR UPDATE 
  USING (id = get_user_id_from_context());

-- ===== TRANSACTIONS TABLE POLICIES =====
DROP POLICY IF EXISTS "transactions_all_own" ON transactions;

CREATE POLICY "transactions_all_own" ON transactions FOR ALL 
  USING (user_id = get_user_id_from_context())
  WITH CHECK (user_id = get_user_id_from_context());

-- ===== BUDGETS TABLE POLICIES =====
DROP POLICY IF EXISTS "budgets_all_own" ON budgets;

CREATE POLICY "budgets_all_own" ON budgets FOR ALL 
  USING (user_id = get_user_id_from_context())
  WITH CHECK (user_id = get_user_id_from_context());

-- ===== CASH FLOWS TABLE POLICIES =====
DROP POLICY IF EXISTS "cash_flows_all_own" ON cash_flows;

CREATE POLICY "cash_flows_all_own" ON cash_flows FOR ALL 
  USING (user_id = get_user_id_from_context())
  WITH CHECK (user_id = get_user_id_from_context());

-- ===== MONTHLY GOALS TABLE POLICIES =====
DROP POLICY IF EXISTS "monthly_goals_all_own" ON monthly_goals;

CREATE POLICY "monthly_goals_all_own" ON monthly_goals FOR ALL 
  USING (user_id = get_user_id_from_context())
  WITH CHECK (user_id = get_user_id_from_context());

-- ===== CATEGORY TABLE POLICIES =====
DROP POLICY IF EXISTS "category_all_own" ON category;

CREATE POLICY "category_all_own" ON category FOR ALL 
  USING (user_id = get_user_id_from_context())
  WITH CHECK (user_id = get_user_id_from_context());

-- ===== CATEGORY ORDER TABLE POLICIES =====
DROP POLICY IF EXISTS "category_order_all_own" ON category_order;

CREATE POLICY "category_order_all_own" ON category_order FOR ALL 
  USING (user_id = get_user_id_from_context())
  WITH CHECK (user_id = get_user_id_from_context());

-- ===== CATEGORY ORDER BACKUP TABLE POLICIES =====
DROP POLICY IF EXISTS "category_order_backup_all_own" ON category_order_backup;

CREATE POLICY "category_order_backup_all_own" ON category_order_backup FOR ALL 
  USING (user_id = get_user_id_from_context())
  WITH CHECK (user_id = get_user_id_from_context());

-- ===== STOCK HOLDINGS TABLE POLICIES =====
DROP POLICY IF EXISTS "stock_holdings_all_own" ON stock_holdings;

CREATE POLICY "stock_holdings_all_own" ON stock_holdings FOR ALL 
  USING (user_id = get_user_id_from_context())
  WITH CHECK (user_id = get_user_id_from_context());

-- ===== STOCK MARKET DATA POLICIES =====
-- These tables are public market data, allow read access to all authenticated users
-- But still use RLS for consistency and future user-specific stock data

DROP POLICY IF EXISTS "stocks_public_read" ON stocks;
DROP POLICY IF EXISTS "stock_prices_public_read" ON stock_prices;
DROP POLICY IF EXISTS "stock_prices_backup_public_read" ON stock_prices_backup;

-- Allow all authenticated users to read stock market data
CREATE POLICY "stocks_public_read" ON stocks FOR SELECT 
  TO authenticated USING (true);

CREATE POLICY "stock_prices_public_read" ON stock_prices FOR SELECT 
  TO authenticated USING (true);

CREATE POLICY "stock_prices_backup_public_read" ON stock_prices_backup FOR SELECT 
  TO authenticated USING (true);

-- Service role bypass policies for admin operations
CREATE POLICY "service_role_bypass_users" ON users FOR ALL 
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_transactions" ON transactions FOR ALL 
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_budgets" ON budgets FOR ALL 
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_cash_flows" ON cash_flows FOR ALL 
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_monthly_goals" ON monthly_goals FOR ALL 
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_category" ON category FOR ALL 
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_category_order" ON category_order FOR ALL 
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_category_order_backup" ON category_order_backup FOR ALL 
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_stock_holdings" ON stock_holdings FOR ALL 
  TO service_role USING (true) WITH CHECK (true);

-- Service role policies for stock market data
CREATE POLICY "service_role_bypass_stocks" ON stocks FOR ALL 
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_stock_prices" ON stock_prices FOR ALL 
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_stock_prices_backup" ON stock_prices_backup FOR ALL 
  TO service_role USING (true) WITH CHECK (true);

-- Additional table policies (if tables exist)
DO $$ 
BEGIN
    -- Stock alerts policies (user-specific)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_alerts') THEN
        EXECUTE 'DROP POLICY IF EXISTS "stock_alerts_all_own" ON stock_alerts';
        EXECUTE 'CREATE POLICY "stock_alerts_all_own" ON stock_alerts FOR ALL 
                 USING (user_id = get_user_id_from_context())
                 WITH CHECK (user_id = get_user_id_from_context())';
        EXECUTE 'CREATE POLICY "service_role_bypass_stock_alerts" ON stock_alerts FOR ALL 
                 TO service_role USING (true) WITH CHECK (true)';
    END IF;
    
    -- Watchlist policies (user-specific)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'watchlist') THEN
        EXECUTE 'DROP POLICY IF EXISTS "watchlist_all_own" ON watchlist';
        EXECUTE 'CREATE POLICY "watchlist_all_own" ON watchlist FOR ALL 
                 USING (user_id = get_user_id_from_context())
                 WITH CHECK (user_id = get_user_id_from_context())';
        EXECUTE 'CREATE POLICY "service_role_bypass_watchlist" ON watchlist FOR ALL 
                 TO service_role USING (true) WITH CHECK (true)';
    END IF;
    
    -- User preferences policies (user-specific)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
        EXECUTE 'DROP POLICY IF EXISTS "user_preferences_all_own" ON user_preferences';
        EXECUTE 'CREATE POLICY "user_preferences_all_own" ON user_preferences FOR ALL 
                 USING (user_id = get_user_id_from_context())
                 WITH CHECK (user_id = get_user_id_from_context())';
        EXECUTE 'CREATE POLICY "service_role_bypass_user_preferences" ON user_preferences FOR ALL 
                 TO service_role USING (true) WITH CHECK (true)';
    END IF;
    
    -- Daily portfolio performance policies (user-specific)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_portfolio_performance') THEN
        EXECUTE 'DROP POLICY IF EXISTS "daily_portfolio_performance_all_own" ON daily_portfolio_performance';
        EXECUTE 'CREATE POLICY "daily_portfolio_performance_all_own" ON daily_portfolio_performance FOR ALL 
                 USING (user_id = get_user_id_from_context())
                 WITH CHECK (user_id = get_user_id_from_context())';
        EXECUTE 'CREATE POLICY "service_role_bypass_daily_portfolio_performance" ON daily_portfolio_performance FOR ALL 
                 TO service_role USING (true) WITH CHECK (true)';
    END IF;
    
    -- Categories policies (user-specific - alternative table name)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories') THEN
        EXECUTE 'DROP POLICY IF EXISTS "categories_all_own" ON categories';
        EXECUTE 'CREATE POLICY "categories_all_own" ON categories FOR ALL 
                 USING (user_id = get_user_id_from_context())
                 WITH CHECK (user_id = get_user_id_from_context())';
        EXECUTE 'CREATE POLICY "service_role_bypass_categories" ON categories FOR ALL 
                 TO service_role USING (true) WITH CHECK (true)';
    END IF;
    
    -- System settings policies (public read for all authenticated users)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_system_settings') THEN
        EXECUTE 'DROP POLICY IF EXISTS "stock_system_settings_public_read" ON stock_system_settings';
        EXECUTE 'CREATE POLICY "stock_system_settings_public_read" ON stock_system_settings FOR SELECT 
                 TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "service_role_bypass_stock_system_settings" ON stock_system_settings FOR ALL 
                 TO service_role USING (true) WITH CHECK (true)';
    END IF;
    
    -- Stock transactions summary policies (user-specific)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_transactions_summary') THEN
        EXECUTE 'DROP POLICY IF EXISTS "stock_transactions_summary_all_own" ON stock_transactions_summary';
        EXECUTE 'CREATE POLICY "stock_transactions_summary_all_own" ON stock_transactions_summary FOR ALL 
                 USING (user_id = get_user_id_from_context())
                 WITH CHECK (user_id = get_user_id_from_context())';
        EXECUTE 'CREATE POLICY "service_role_bypass_stock_transactions_summary" ON stock_transactions_summary FOR ALL 
                 TO service_role USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Security note: 
-- The application must call: SELECT set_config('app.current_user_id', 'user-uuid-here', true);
-- Before any database operations to set the user context for RLS policies