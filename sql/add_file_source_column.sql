-- Add file_source column to transactions table for tracking upload source
-- This column will store the source of the transaction upload (e.g., 'excel', 'csv', 'manual', 'api')

ALTER TABLE transactions 
ADD COLUMN file_source VARCHAR(255) NULL;

-- Add comment to document the column usage
COMMENT ON COLUMN transactions.file_source IS 'Source of transaction upload: excel, csv, manual, api, bank_export, etc.';

-- Create index for better performance when filtering by file source
CREATE INDEX idx_transactions_file_source ON transactions(file_source) WHERE file_source IS NOT NULL;

-- Set default value for existing transactions
UPDATE transactions 
SET file_source = 'legacy' 
WHERE file_source IS NULL;