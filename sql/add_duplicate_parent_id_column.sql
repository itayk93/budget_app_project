-- Add duplicate_parent_id column to transactions table
-- This enables proper tracking of duplicate transactions in a parent-child chain

-- Step 1: Add the new column
ALTER TABLE transactions 
ADD COLUMN duplicate_parent_id UUID REFERENCES transactions(id);

-- Step 2: Create an index on the new column for performance
CREATE INDEX IF NOT EXISTS idx_transactions_duplicate_parent_id 
ON transactions(duplicate_parent_id);

-- Step 3: Add a comment to document the column purpose
COMMENT ON COLUMN transactions.duplicate_parent_id IS 'References the parent transaction ID for duplicate transactions. NULL for original transactions, contains ID of immediate parent for duplicates in a chain.';

-- Step 4: Create a view to easily find duplicate chains (optional for debugging)
CREATE OR REPLACE VIEW duplicate_transaction_chains AS
WITH RECURSIVE duplicate_chain AS (
  -- Base case: original transactions (no parent)
  SELECT 
    id,
    business_name,
    amount,
    payment_date,
    duplicate_parent_id,
    0 as level,
    ARRAY[id] as chain_path
  FROM transactions
  WHERE duplicate_parent_id IS NULL
  
  UNION ALL
  
  -- Recursive case: find children
  SELECT 
    t.id,
    t.business_name,
    t.amount,
    t.payment_date,
    t.duplicate_parent_id,
    dc.level + 1 as level,
    dc.chain_path || t.id as chain_path
  FROM transactions t
  INNER JOIN duplicate_chain dc ON t.duplicate_parent_id = dc.id
)
SELECT 
  id,
  business_name,
  amount,
  payment_date,
  duplicate_parent_id,
  level,
  chain_path,
  -- Helper to identify if this is part of a duplicate chain
  CASE 
    WHEN level = 0 AND EXISTS(SELECT 1 FROM transactions WHERE duplicate_parent_id = duplicate_chain.id) THEN 'Original with duplicates'
    WHEN level = 0 THEN 'Original without duplicates'
    ELSE 'Duplicate (level ' || level || ')'
  END as chain_status
FROM duplicate_chain
ORDER BY chain_path, level;

-- Optional: Create function to find the root parent of any transaction
CREATE OR REPLACE FUNCTION get_root_parent(transaction_id UUID)
RETURNS UUID AS $$
DECLARE
    current_id UUID := transaction_id;
    parent_id UUID;
BEGIN
    LOOP
        SELECT duplicate_parent_id INTO parent_id
        FROM transactions
        WHERE id = current_id;
        
        IF parent_id IS NULL THEN
            RETURN current_id;
        END IF;
        
        current_id := parent_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create function to count duplicates in a chain
CREATE OR REPLACE FUNCTION count_duplicate_chain(root_transaction_id UUID)
RETURNS INTEGER AS $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    WITH RECURSIVE duplicate_chain AS (
        SELECT id FROM transactions WHERE id = root_transaction_id
        UNION ALL
        SELECT t.id 
        FROM transactions t
        INNER JOIN duplicate_chain dc ON t.duplicate_parent_id = dc.id
    )
    SELECT COUNT(*) - 1 INTO duplicate_count FROM duplicate_chain;
    
    RETURN duplicate_count;
END;
$$ LANGUAGE plpgsql;