-- Temporarily disable RLS to test current functionality
-- Run this script if RLS causes issues with current app functionality

-- Disable RLS on all tables temporarily
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flows DISABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE category DISABLE ROW LEVEL SECURITY;
ALTER TABLE category_order DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_holdings DISABLE ROW LEVEL SECURITY;
ALTER TABLE category_order_backup DISABLE ROW LEVEL SECURITY;
ALTER TABLE stocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices_backup DISABLE ROW LEVEL SECURITY;

-- Drop all RLS policies
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "transactions_all_own" ON transactions;
DROP POLICY IF EXISTS "budgets_all_own" ON budgets;
DROP POLICY IF EXISTS "cash_flows_all_own" ON cash_flows;
DROP POLICY IF EXISTS "monthly_goals_all_own" ON monthly_goals;
DROP POLICY IF EXISTS "category_all_own" ON category;
DROP POLICY IF EXISTS "category_order_all_own" ON category_order;
DROP POLICY IF EXISTS "category_order_backup_all_own" ON category_order_backup;
DROP POLICY IF EXISTS "stock_holdings_all_own" ON stock_holdings;

-- Drop service role bypass policies
DROP POLICY IF EXISTS "service_role_bypass_users" ON users;
DROP POLICY IF EXISTS "service_role_bypass_transactions" ON transactions;
DROP POLICY IF EXISTS "service_role_bypass_budgets" ON budgets;
DROP POLICY IF EXISTS "service_role_bypass_cash_flows" ON cash_flows;
DROP POLICY IF EXISTS "service_role_bypass_monthly_goals" ON monthly_goals;
DROP POLICY IF EXISTS "service_role_bypass_category" ON category;
DROP POLICY IF EXISTS "service_role_bypass_category_order" ON category_order;
DROP POLICY IF EXISTS "service_role_bypass_category_order_backup" ON category_order_backup;
DROP POLICY IF EXISTS "service_role_bypass_stock_holdings" ON stock_holdings;

-- Drop stock market data policies
DROP POLICY IF EXISTS "stocks_public_read" ON stocks;
DROP POLICY IF EXISTS "stock_prices_public_read" ON stock_prices;
DROP POLICY IF EXISTS "stock_prices_backup_public_read" ON stock_prices_backup;
DROP POLICY IF EXISTS "service_role_bypass_stocks" ON stocks;
DROP POLICY IF EXISTS "service_role_bypass_stock_prices" ON stock_prices;
DROP POLICY IF EXISTS "service_role_bypass_stock_prices_backup" ON stock_prices_backup;

-- Drop additional table policies (if they exist)
DO $$ 
BEGIN
    -- Drop policies for all possible additional tables
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_alerts') THEN
        EXECUTE 'ALTER TABLE stock_alerts DISABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "stock_alerts_all_own" ON stock_alerts';
        EXECUTE 'DROP POLICY IF EXISTS "service_role_bypass_stock_alerts" ON stock_alerts';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'watchlist') THEN
        EXECUTE 'ALTER TABLE watchlist DISABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "watchlist_all_own" ON watchlist';
        EXECUTE 'DROP POLICY IF EXISTS "service_role_bypass_watchlist" ON watchlist';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
        EXECUTE 'ALTER TABLE user_preferences DISABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "user_preferences_all_own" ON user_preferences';
        EXECUTE 'DROP POLICY IF EXISTS "service_role_bypass_user_preferences" ON user_preferences';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_portfolio_performance') THEN
        EXECUTE 'ALTER TABLE daily_portfolio_performance DISABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "daily_portfolio_performance_all_own" ON daily_portfolio_performance';
        EXECUTE 'DROP POLICY IF EXISTS "service_role_bypass_daily_portfolio_performance" ON daily_portfolio_performance';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories') THEN
        EXECUTE 'ALTER TABLE categories DISABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "categories_all_own" ON categories';
        EXECUTE 'DROP POLICY IF EXISTS "service_role_bypass_categories" ON categories';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_system_settings') THEN
        EXECUTE 'ALTER TABLE stock_system_settings DISABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "stock_system_settings_public_read" ON stock_system_settings';
        EXECUTE 'DROP POLICY IF EXISTS "service_role_bypass_stock_system_settings" ON stock_system_settings';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_transactions_summary') THEN
        EXECUTE 'ALTER TABLE stock_transactions_summary DISABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "stock_transactions_summary_all_own" ON stock_transactions_summary';
        EXECUTE 'DROP POLICY IF EXISTS "service_role_bypass_stock_transactions_summary" ON stock_transactions_summary';
    END IF;
END $$;

-- Drop the helper function
DROP FUNCTION IF EXISTS get_user_id_from_context();

-- Note: This restores the original state where the application uses service key
-- with application-level user ID filtering in queries