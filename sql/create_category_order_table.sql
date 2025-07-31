-- Create category_order table
CREATE TABLE category_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL,
    shared_category VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for performance
CREATE INDEX idx_category_order_user_id ON category_order(user_id);
CREATE INDEX idx_category_order_user_display ON category_order(user_id, display_order);
CREATE UNIQUE INDEX idx_category_order_user_category ON category_order(user_id, category_name);

-- Add comments for clarity
COMMENT ON TABLE category_order IS 'Stores user-defined ordering for categories';
COMMENT ON COLUMN category_order.category_name IS 'The name of the category (matches transactions.category_name)';
COMMENT ON COLUMN category_order.display_order IS 'The display order (0-based index)';
COMMENT ON COLUMN category_order.shared_category IS 'Optional shared category grouping';