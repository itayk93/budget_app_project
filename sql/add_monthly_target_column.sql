-- Add monthly_target column to category_order table
-- This column will store the monthly spending target for each category

ALTER TABLE category_order 
ADD COLUMN monthly_target DECIMAL(10,2) DEFAULT NULL;

-- Add index for better performance when querying categories with targets
CREATE INDEX idx_category_order_monthly_target ON category_order(monthly_target) WHERE monthly_target IS NOT NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN category_order.monthly_target IS 'Monthly spending target for the category in the default currency. Calculated automatically from 3-month average or set manually by user.';

-- Optional: Add a trigger to update the updated_at timestamp when monthly_target is modified
-- This ensures the updated_at field is always accurate when the target changes
CREATE OR REPLACE FUNCTION update_category_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger that fires on any update to category_order
DROP TRIGGER IF EXISTS update_category_order_updated_at_trigger ON category_order;
CREATE TRIGGER update_category_order_updated_at_trigger
    BEFORE UPDATE ON category_order
    FOR EACH ROW
    EXECUTE FUNCTION update_category_order_updated_at();