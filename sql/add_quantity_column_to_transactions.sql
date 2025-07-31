-- Add quantity column to transactions table for stock transactions
-- This column will store the number of shares/units for investment transactions

ALTER TABLE transactions 
ADD COLUMN quantity DECIMAL(12,6) NULL;

-- Add comment to document the column usage
COMMENT ON COLUMN transactions.quantity IS 'Number of shares or units for investment transactions (stocks, ETFs, etc.)';

-- Create index for better performance when filtering by quantity
CREATE INDEX idx_transactions_quantity ON transactions(quantity) WHERE quantity IS NOT NULL;