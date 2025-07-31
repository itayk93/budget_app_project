-- Add monthly_targets_last_update column to users table
-- This column will track when monthly targets were last refreshed for each user

ALTER TABLE users 
ADD COLUMN monthly_targets_last_update DATE DEFAULT NULL;

-- Add index for better performance when checking refresh status
CREATE INDEX idx_users_monthly_targets_last_update ON users(monthly_targets_last_update);

-- Add comment to document the column purpose
COMMENT ON COLUMN users.monthly_targets_last_update IS 'Date when monthly targets were last automatically refreshed for the user. Used to prevent duplicate refreshes in the same month.';

-- Optional: Initialize existing users with NULL (they will get refreshed on next login)
-- This is already the default, but explicit for clarity
UPDATE users 
SET monthly_targets_last_update = NULL 
WHERE monthly_targets_last_update IS NULL;