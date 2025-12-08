-- Fix hidden business user ID issue
-- Run this in Supabase Dashboard -> SQL Editor

-- Temporarily disable foreign key constraint
ALTER TABLE hidden_business_names DROP CONSTRAINT IF EXISTS hidden_business_names_user_id_fkey;

-- Update existing record to use current user ID
UPDATE hidden_business_names 
SET user_id = 'e3f6919b-d83b-4456-8325-676550a4382d'
WHERE business_name = 'מקס איט פיננסים';

-- Verify the update
SELECT * FROM hidden_business_names WHERE business_name = 'מקס איט פיננסים';

-- Re-enable foreign key constraint (optional - may fail but that's OK)
-- ALTER TABLE hidden_business_names ADD CONSTRAINT hidden_business_names_user_id_fkey 
-- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;