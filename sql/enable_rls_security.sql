-- Enable Row Level Security (RLS) for Budget App Tables
-- This script enables RLS and creates secure access policies

-- Enable RLS on critical user tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_budget ENABLE ROW LEVEL SECURITY;

-- Enable RLS on financial tables
ALTER TABLE cash_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE monthly_savings ENABLE ROW LEVEL SECURITY; -- Table may not exist

-- Enable RLS on stock tables
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices ENABLE ROW LEVEL SECURITY;

-- Enable RLS on category tables
ALTER TABLE category ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_order ENABLE ROW LEVEL SECURITY;

-- Enable RLS on bank scraper tables
ALTER TABLE bank_scraper_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_scraper_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_scraper_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_scraper_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for User Data Access
-- Users can only access their own data

-- Users table - users can only see their own record
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Transactions table - users can only access their own transactions
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- Monthly budgets table - users can only access their own budgets
CREATE POLICY "Users can view own budgets" ON monthly_budget FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON monthly_budget FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON monthly_budget FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON monthly_budget FOR DELETE USING (auth.uid() = user_id);

-- Cash flows table
CREATE POLICY "Users can view own cash flows" ON cash_flows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cash flows" ON cash_flows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cash flows" ON cash_flows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cash flows" ON cash_flows FOR DELETE USING (auth.uid() = user_id);

-- Monthly goals table
CREATE POLICY "Users can view own monthly goals" ON monthly_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monthly goals" ON monthly_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly goals" ON monthly_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monthly goals" ON monthly_goals FOR DELETE USING (auth.uid() = user_id);

-- Monthly savings table (commented out - table may not exist)
-- CREATE POLICY "Users can view own monthly savings" ON monthly_savings FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can insert own monthly savings" ON monthly_savings FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can update own monthly savings" ON monthly_savings FOR UPDATE USING (auth.uid() = user_id);
-- CREATE POLICY "Users can delete own monthly savings" ON monthly_savings FOR DELETE USING (auth.uid() = user_id);

-- Stock holdings table
CREATE POLICY "Users can view own stock holdings" ON stock_holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stock holdings" ON stock_holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stock holdings" ON stock_holdings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stock holdings" ON stock_holdings FOR DELETE USING (auth.uid() = user_id);

-- Categories table - users can only access their own categories (table name: category)
CREATE POLICY "Users can view own categories" ON category FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON category FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON category FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON category FOR DELETE USING (auth.uid() = user_id);

-- Category order table
CREATE POLICY "Users can view own category order" ON category_order FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own category order" ON category_order FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own category order" ON category_order FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own category order" ON category_order FOR DELETE USING (auth.uid() = user_id);

-- Bank scraper tables - users can only access their own data
CREATE POLICY "Users can view own bank accounts" ON bank_scraper_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bank accounts" ON bank_scraper_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bank accounts" ON bank_scraper_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bank accounts" ON bank_scraper_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own bank configs" ON bank_scraper_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bank configs" ON bank_scraper_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bank configs" ON bank_scraper_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bank configs" ON bank_scraper_configs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own bank logs" ON bank_scraper_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bank logs" ON bank_scraper_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own bank transactions" ON bank_scraper_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bank transactions" ON bank_scraper_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bank transactions" ON bank_scraper_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bank transactions" ON bank_scraper_transactions FOR DELETE USING (auth.uid() = user_id);

-- Stock prices and stocks tables can be public read (market data)
-- But we'll still enable RLS for better security
CREATE POLICY "Public can read stock prices" ON stock_prices FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Service role can manage stock prices" ON stock_prices FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public can read stocks" ON stocks FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Service role can manage stocks" ON stocks FOR ALL USING (auth.role() = 'service_role');