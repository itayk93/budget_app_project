-- Create table to store user's selected empty categories for display
-- This table will track which empty categories each user wants to display 
-- for each cash flow and month/year combination

CREATE TABLE IF NOT EXISTS user_empty_categories_display (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    cash_flow_id UUID NOT NULL REFERENCES cash_flows(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combination per user, cash flow, category, year, month
    UNIQUE(user_id, cash_flow_id, category_name, year, month)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_empty_categories_display_user_cash_flow 
    ON user_empty_categories_display(user_id, cash_flow_id);
    
CREATE INDEX IF NOT EXISTS idx_user_empty_categories_display_year_month 
    ON user_empty_categories_display(user_id, cash_flow_id, year, month);

-- Add RLS (Row Level Security) policies
ALTER TABLE user_empty_categories_display ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own empty category displays
CREATE POLICY user_empty_categories_display_policy ON user_empty_categories_display
    FOR ALL USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON user_empty_categories_display TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;