-- Add source_category column to transactions table
-- This column will store the "ענף" (branch/sector) information from CAL credit card files

ALTER TABLE transactions 
ADD COLUMN source_category TEXT;

-- Add index for better performance when filtering by source_category
CREATE INDEX IF NOT EXISTS idx_transactions_source_category 
ON transactions(source_category);

-- Add comment to explain the column
COMMENT ON COLUMN transactions.source_category IS 'Source category from credit card files (e.g., from CAL "ענף" column)';