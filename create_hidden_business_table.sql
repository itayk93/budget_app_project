-- Create table for hidden business names
CREATE TABLE hidden_business_names (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    business_name TEXT NOT NULL,
    reason TEXT, -- Optional field to note why this business is hidden (e.g., "credit card recurring charge")
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX idx_hidden_business_names_user_id ON hidden_business_names(user_id);
CREATE INDEX idx_hidden_business_names_business_name ON hidden_business_names(business_name);

-- Enable RLS
ALTER TABLE hidden_business_names ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only see their own hidden business names" 
ON hidden_business_names FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own hidden business names" 
ON hidden_business_names FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own hidden business names" 
ON hidden_business_names FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own hidden business names" 
ON hidden_business_names FOR DELETE 
USING (auth.uid() = user_id);

-- Insert example data (you can remove this after testing)
-- INSERT INTO hidden_business_names (user_id, business_name, reason)
-- VALUES (
--     (SELECT id FROM auth.users LIMIT 1), 
--     'מקס איט פיננסים', 
--     'חיוב חודשי חברת אשראי - כפילות לעסקאות קיימות'
-- );