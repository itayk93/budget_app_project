-- ======================================
-- 🔧 SETUP HIDDEN BUSINESS NAMES TABLE
-- ======================================
-- Copy this SQL and run it in Supabase Dashboard -> SQL Editor

-- 1. Create the table
CREATE TABLE IF NOT EXISTS hidden_business_names (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    business_name TEXT NOT NULL,
    reason TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hidden_business_names_user_id 
ON hidden_business_names(user_id);

CREATE INDEX IF NOT EXISTS idx_hidden_business_names_business_name 
ON hidden_business_names(business_name);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE hidden_business_names ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
CREATE POLICY IF NOT EXISTS "Users can only see their own hidden business names" 
ON hidden_business_names FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can only insert their own hidden business names" 
ON hidden_business_names FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can only update their own hidden business names" 
ON hidden_business_names FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can only delete their own hidden business names" 
ON hidden_business_names FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Insert sample data (מקס איט פיננסים)
INSERT INTO hidden_business_names (user_id, business_name, reason, is_active)
SELECT 
    id as user_id,
    'מקס איט פיננסים' as business_name,
    'חיוב חודשי חברת אשראי - כפילות לעסקאות קיימות' as reason,
    true as is_active
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 1
ON CONFLICT DO NOTHING;

-- 6. Verify the setup
SELECT 
    'hidden_business_names' as table_name,
    COUNT(*) as record_count
FROM hidden_business_names;

-- 7. Show all hidden business names
SELECT 
    business_name,
    reason,
    is_active,
    created_at,
    (SELECT email FROM auth.users WHERE id = user_id) as user_email
FROM hidden_business_names
ORDER BY created_at DESC;