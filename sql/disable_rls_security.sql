-- Disable Row Level Security (RLS) for Budget App Tables
-- This script disables RLS since the app uses custom JWT authentication with service key access

-- Disable RLS on user tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
-- Handle both budget table names (budgets is the actual table name)
ALTER TABLE budgets DISABLE ROW LEVEL SECURITY;

-- Disable RLS on financial tables
ALTER TABLE cash_flows DISABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_goals DISABLE ROW LEVEL SECURITY;

-- Disable RLS on stock tables
ALTER TABLE stocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_holdings DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices DISABLE ROW LEVEL SECURITY;

-- Disable RLS on category tables
ALTER TABLE category DISABLE ROW LEVEL SECURITY;
ALTER TABLE category_order DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies to clean up
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

DROP POLICY IF EXISTS "Users can view own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON budgets;

DROP POLICY IF EXISTS "Users can view own cash flows" ON cash_flows;
DROP POLICY IF EXISTS "Users can insert own cash flows" ON cash_flows;
DROP POLICY IF EXISTS "Users can update own cash flows" ON cash_flows;
DROP POLICY IF EXISTS "Users can delete own cash flows" ON cash_flows;

DROP POLICY IF EXISTS "Users can view own monthly goals" ON monthly_goals;
DROP POLICY IF EXISTS "Users can insert own monthly goals" ON monthly_goals;
DROP POLICY IF EXISTS "Users can update own monthly goals" ON monthly_goals;
DROP POLICY IF EXISTS "Users can delete own monthly goals" ON monthly_goals;

DROP POLICY IF EXISTS "Users can view own stock holdings" ON stock_holdings;
DROP POLICY IF EXISTS "Users can insert own stock holdings" ON stock_holdings;
DROP POLICY IF EXISTS "Users can update own stock holdings" ON stock_holdings;
DROP POLICY IF EXISTS "Users can delete own stock holdings" ON stock_holdings;

DROP POLICY IF EXISTS "Users can view own categories" ON category;
DROP POLICY IF EXISTS "Users can insert own categories" ON category;
DROP POLICY IF EXISTS "Users can update own categories" ON category;
DROP POLICY IF EXISTS "Users can delete own categories" ON category;

DROP POLICY IF EXISTS "Users can view own category order" ON category_order;
DROP POLICY IF EXISTS "Users can insert own category order" ON category_order;
DROP POLICY IF EXISTS "Users can update own category order" ON category_order;
DROP POLICY IF EXISTS "Users can delete own category order" ON category_order;

DROP POLICY IF EXISTS "Public can read stock prices" ON stock_prices;
DROP POLICY IF EXISTS "Service role can manage stock prices" ON stock_prices;

DROP POLICY IF EXISTS "Public can read stocks" ON stocks;
DROP POLICY IF EXISTS "Service role can manage stocks" ON stocks;

-- Note: This application uses custom JWT authentication with service key access
-- Security is handled at the application level with user_id validation in all queries
-- RLS is not needed as the service key provides admin access with proper user scoping