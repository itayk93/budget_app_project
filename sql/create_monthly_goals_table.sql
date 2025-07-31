-- Create monthly_goals table to store user monthly savings goals
CREATE TABLE IF NOT EXISTS monthly_goals (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    cash_flow_id UUID NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    include_in_next_month BOOLEAN DEFAULT FALSE,
    include_in_specific_month BOOLEAN DEFAULT FALSE,
    specific_year INTEGER,
    specific_month INTEGER CHECK (specific_month IS NULL OR (specific_month >= 1 AND specific_month <= 12)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique constraint for user, cash flow, year, month combination
    UNIQUE(user_id, cash_flow_id, year, month),
    
    -- Ensure specific_year and specific_month are provided together if include_in_specific_month is true
    CHECK (
        (include_in_specific_month = FALSE) OR 
        (include_in_specific_month = TRUE AND specific_year IS NOT NULL AND specific_month IS NOT NULL)
    ),
    
    -- Ensure only one of include_in_next_month or include_in_specific_month can be true
    CHECK (
        NOT (include_in_next_month = TRUE AND include_in_specific_month = TRUE)
    )
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_monthly_goals_user_cash_flow_date 
ON monthly_goals(user_id, cash_flow_id, year, month);

CREATE INDEX IF NOT EXISTS idx_monthly_goals_specific_date 
ON monthly_goals(specific_year, specific_month) 
WHERE include_in_specific_month = TRUE;

-- Add foreign key constraints (assuming these tables exist)
-- Note: Uncomment these if the referenced tables exist in your schema
-- ALTER TABLE monthly_goals 
-- ADD CONSTRAINT fk_monthly_goals_user_id 
-- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ALTER TABLE monthly_goals 
-- ADD CONSTRAINT fk_monthly_goals_cash_flow_id 
-- FOREIGN KEY (cash_flow_id) REFERENCES cash_flows(id) ON DELETE CASCADE;

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_monthly_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER monthly_goals_updated_at_trigger
    BEFORE UPDATE ON monthly_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_monthly_goals_updated_at();