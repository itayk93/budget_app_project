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

-- Keep stock market data tables unrestricted (public read for market data)
-- stocks and stock_prices remain without RLS as they're market data

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

-- ===== PUBLIC MARKET DATA POLICIES (No RLS) =====
-- Keep stocks and stock_prices without RLS for public market data access
-- These tables don't contain user-specific information

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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Security note: 
-- The application must call: SELECT set_config('app.current_user_id', 'user-uuid-here', true);
-- Before any database operations to set the user context for RLS policies