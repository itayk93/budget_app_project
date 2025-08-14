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

-- Drop the helper function
DROP FUNCTION IF EXISTS get_user_id_from_context();

-- Note: This restores the original state where the application uses service key
-- with application-level user ID filtering in queries