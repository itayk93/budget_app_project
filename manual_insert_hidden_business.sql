-- Insert sample hidden business name
-- Replace the UUID with your actual user ID from auth.users table

INSERT INTO hidden_business_names (user_id, business_name, reason, is_active)
VALUES (
  (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1),
  'מקס איט פיננסים',
  'חיוב חודשי חברת אשראי - כפילות לעסקאות קיימות',
  true
);

-- Verify the insert
SELECT * FROM hidden_business_names;