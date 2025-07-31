-- Complete Stock Management System Tables
-- Run this script in Supabase SQL Editor
-- This replaces and extends the existing stock tables

-- Drop existing tables if they exist (in dependency order)
DROP TABLE IF EXISTS daily_portfolio_performance CASCADE;
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS stock_alert_history CASCADE;
DROP TABLE IF EXISTS stock_alerts CASCADE;
DROP TABLE IF EXISTS stock_transactions_summary CASCADE;
DROP TABLE IF EXISTS stock_holdings CASCADE;
DROP TABLE IF EXISTS stock_prices CASCADE;
DROP TABLE IF EXISTS stocks CASCADE;

-- 1. Stocks table - Basic stock information
CREATE TABLE stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) UNIQUE NOT NULL,
    company_name VARCHAR(255),
    sector VARCHAR(100),
    exchange VARCHAR(50) DEFAULT 'NASDAQ',
    currency VARCHAR(3) DEFAULT 'USD',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Stock holdings - Current user holdings
CREATE TABLE stock_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_symbol VARCHAR(10) REFERENCES stocks(symbol),
    quantity DECIMAL(12,6) NOT NULL DEFAULT 0,
    average_cost DECIMAL(12,4),
    total_invested DECIMAL(15,2),
    cash_flow_id UUID REFERENCES cash_flows(id),
    first_purchase_date DATE,
    last_transaction_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, stock_symbol, cash_flow_id)
);

-- 3. Stock prices - Historical and current prices
CREATE TABLE stock_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_symbol VARCHAR(10) REFERENCES stocks(symbol),
    price_date DATE NOT NULL,
    open_price DECIMAL(12,4),
    high_price DECIMAL(12,4),
    low_price DECIMAL(12,4),
    close_price DECIMAL(12,4),
    adjusted_close DECIMAL(12,4),
    volume BIGINT,
    source VARCHAR(50) DEFAULT 'alpha_vantage',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stock_symbol, price_date)
);

-- 4. Stock transactions summary - Clean version of stock transactions
CREATE TABLE stock_transactions_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_symbol VARCHAR(10) REFERENCES stocks(symbol),
    transaction_type VARCHAR(20) NOT NULL, -- 'buy', 'sell', 'dividend'
    quantity DECIMAL(12,6),
    price_per_share DECIMAL(12,4),
    total_amount DECIMAL(15,2),
    transaction_date DATE NOT NULL,
    original_transaction_id UUID REFERENCES transactions(id),
    cash_flow_id UUID REFERENCES cash_flows(id),
    fees DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Stock alerts - User alert preferences
CREATE TABLE stock_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_symbol VARCHAR(10) REFERENCES stocks(symbol),
    alert_type VARCHAR(30) NOT NULL, -- 'price_above', 'price_below', 'change_percent', 'volume_high', etc.
    target_value DECIMAL(12,4),
    comparison_operator VARCHAR(10) DEFAULT '>', -- '>', '<', '>=', '<=', '='
    is_active BOOLEAN DEFAULT true,
    notification_method VARCHAR(20) DEFAULT 'browser', -- 'browser', 'email', 'sms', 'all'
    message_template TEXT,
    notes TEXT,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Stock alert history - Log of triggered alerts
CREATE TABLE stock_alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES stock_alerts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    trigger_value DECIMAL(12,4),
    message TEXT,
    was_sent BOOLEAN DEFAULT false,
    notification_method VARCHAR(20)
);

-- 7. Daily portfolio performance - Daily snapshots
CREATE TABLE daily_portfolio_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cash_flow_id UUID REFERENCES cash_flows(id),
    performance_date DATE NOT NULL,
    total_invested DECIMAL(15,2),
    total_market_value DECIMAL(15,2),
    unrealized_gain_loss DECIMAL(15,2),
    realized_gain_loss DECIMAL(15,2),
    total_gain_loss DECIMAL(15,2),
    return_percentage DECIMAL(8,4),
    number_of_holdings INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, cash_flow_id, performance_date)
);

-- 8. Watchlist - Stocks user wants to track (without holding)
CREATE TABLE watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_symbol VARCHAR(10) REFERENCES stocks(symbol),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    target_price DECIMAL(12,4),
    UNIQUE(user_id, stock_symbol)
);

-- Create indexes for better performance
CREATE INDEX idx_stock_prices_symbol_date ON stock_prices(stock_symbol, price_date DESC);
CREATE INDEX idx_stock_holdings_user ON stock_holdings(user_id);
CREATE INDEX idx_stock_holdings_user_cash_flow ON stock_holdings(user_id, cash_flow_id);
CREATE INDEX idx_stock_transactions_user_symbol ON stock_transactions_summary(user_id, stock_symbol);
CREATE INDEX idx_stock_transactions_user_cash_flow ON stock_transactions_summary(user_id, cash_flow_id);
CREATE INDEX idx_stock_alerts_user_active ON stock_alerts(user_id, is_active);
CREATE INDEX idx_daily_performance_user_date ON daily_portfolio_performance(user_id, performance_date DESC);
CREATE INDEX idx_watchlist_user ON watchlist(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_portfolio_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Stocks table - Everyone can read
CREATE POLICY "stocks_select_policy" ON stocks FOR SELECT USING (true);
CREATE POLICY "stocks_insert_policy" ON stocks FOR INSERT WITH CHECK (true);
CREATE POLICY "stocks_update_policy" ON stocks FOR UPDATE USING (true);

-- Stock prices - Everyone can read, service can insert
CREATE POLICY "stock_prices_select_policy" ON stock_prices FOR SELECT USING (true);
CREATE POLICY "stock_prices_insert_policy" ON stock_prices FOR INSERT WITH CHECK (true);
CREATE POLICY "stock_prices_update_policy" ON stock_prices FOR UPDATE USING (true);

-- Stock holdings - Users can only see their own
CREATE POLICY "stock_holdings_select_policy" ON stock_holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "stock_holdings_insert_policy" ON stock_holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stock_holdings_update_policy" ON stock_holdings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "stock_holdings_delete_policy" ON stock_holdings FOR DELETE USING (auth.uid() = user_id);

-- Stock transactions - Users can only see their own
CREATE POLICY "stock_transactions_select_policy" ON stock_transactions_summary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "stock_transactions_insert_policy" ON stock_transactions_summary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stock_transactions_update_policy" ON stock_transactions_summary FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "stock_transactions_delete_policy" ON stock_transactions_summary FOR DELETE USING (auth.uid() = user_id);

-- Stock alerts - Users can only see their own
CREATE POLICY "stock_alerts_select_policy" ON stock_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "stock_alerts_insert_policy" ON stock_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stock_alerts_update_policy" ON stock_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "stock_alerts_delete_policy" ON stock_alerts FOR DELETE USING (auth.uid() = user_id);

-- Stock alert history - Users can only see their own
CREATE POLICY "stock_alert_history_select_policy" ON stock_alert_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "stock_alert_history_insert_policy" ON stock_alert_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Daily performance - Users can only see their own
CREATE POLICY "daily_performance_select_policy" ON daily_portfolio_performance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_performance_insert_policy" ON daily_portfolio_performance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "daily_performance_update_policy" ON daily_portfolio_performance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "daily_performance_delete_policy" ON daily_portfolio_performance FOR DELETE USING (auth.uid() = user_id);

-- Watchlist - Users can only see their own
CREATE POLICY "watchlist_select_policy" ON watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watchlist_insert_policy" ON watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watchlist_update_policy" ON watchlist FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "watchlist_delete_policy" ON watchlist FOR DELETE USING (auth.uid() = user_id);

-- Insert basic stock symbols (the ones from the old project)
INSERT INTO stocks (symbol, company_name, sector, exchange) VALUES
('LLY', 'Eli Lilly and Company', 'Healthcare', 'NYSE'),
('AMD', 'Advanced Micro Devices', 'Technology', 'NASDAQ'),
('META', 'Meta Platforms Inc', 'Technology', 'NASDAQ'),
('AAPL', 'Apple Inc', 'Technology', 'NASDAQ'),
('GOOGL', 'Alphabet Inc', 'Technology', 'NASDAQ'),
('MSFT', 'Microsoft Corporation', 'Technology', 'NASDAQ'),
('TSLA', 'Tesla Inc', 'Automotive', 'NASDAQ'),
('NVDA', 'NVIDIA Corporation', 'Technology', 'NASDAQ'),
('AMZN', 'Amazon.com Inc', 'Technology', 'NASDAQ'),
('JPM', 'JPMorgan Chase & Co', 'Financial', 'NYSE'),
('PLTR', 'Palantir Technologies Inc', 'Technology', 'NYSE'),
('ANF', 'Abercrombie & Fitch Co', 'Consumer Discretionary', 'NYSE'),
('MSTR', 'MicroStrategy Incorporated', 'Technology', 'NASDAQ'),
('IBIT', 'iShares Bitcoin Trust', 'Cryptocurrency ETF', 'NASDAQ'),
('ETHA', 'VanEck Ethereum Strategy ETF', 'Cryptocurrency ETF', 'BATS'),
('EZBC', 'Franklin Bitcoin ETF', 'Cryptocurrency ETF', 'NASDAQ'),
('QQQ', 'Invesco QQQ Trust', 'ETF', 'NASDAQ'),
('TQQQ', 'ProShares UltraPro QQQ', 'ETF', 'NASDAQ')
ON CONFLICT (symbol) DO NOTHING;

-- Create trigger functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_stock_holdings_updated_at
    BEFORE UPDATE ON stock_holdings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_stock_alerts_updated_at
    BEFORE UPDATE ON stock_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_stock_transactions_updated_at
    BEFORE UPDATE ON stock_transactions_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add comment about system
COMMENT ON TABLE stocks IS 'Basic stock information and metadata';
COMMENT ON TABLE stock_holdings IS 'Current user stock holdings with quantities and investment amounts';
COMMENT ON TABLE stock_prices IS 'Historical and current stock prices from various sources';
COMMENT ON TABLE stock_transactions_summary IS 'Clean stock transactions derived from main transactions table';
COMMENT ON TABLE stock_alerts IS 'User-defined price and volume alerts for stocks';
COMMENT ON TABLE stock_alert_history IS 'History of triggered alerts for auditing';
COMMENT ON TABLE daily_portfolio_performance IS 'Daily snapshots of portfolio performance for tracking';
COMMENT ON TABLE watchlist IS 'Stocks user wants to track without holding them';