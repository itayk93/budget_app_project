-- Add weekly_display column to category_order table
-- This column will determine if a category should be displayed with weekly breakdown

ALTER TABLE category_order 
ADD COLUMN weekly_display BOOLEAN DEFAULT FALSE;

-- Update the updated_at timestamp when weekly_display is modified
-- (This assumes you have a trigger or will handle it in application code)

-- Optional: Add an index for better performance when querying categories with weekly display
CREATE INDEX idx_category_order_weekly_display ON category_order(weekly_display) WHERE weekly_display = true;

-- Optional: Add a comment to document the column purpose
COMMENT ON COLUMN category_order.weekly_display IS 'Whether this category should be displayed with weekly breakdown view instead of monthly view';