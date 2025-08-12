-- Add recipient_name column to transactions table
-- This column will store the name of the recipient for transfer transactions (PAYBOX, bank transfers, etc.)

ALTER TABLE transactions 
ADD COLUMN recipient_name TEXT DEFAULT NULL;

-- Add comment to explain the column purpose
COMMENT ON COLUMN transactions.recipient_name IS 'Name of the recipient for transfer transactions (e.g., PAYBOX transfers, bank transfers)';

-- Create index for faster searches
CREATE INDEX idx_transactions_recipient_name ON transactions(recipient_name) WHERE recipient_name IS NOT NULL;