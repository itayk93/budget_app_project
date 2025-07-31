-- Add email verification columns to users table
-- This migration adds email_verified and email_verified_at columns to support email verification functionality

-- Add email_verified column (boolean, defaults to false)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Add email_verified_at column (timestamp for when email was verified)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Update existing users to have email_verified set to false if null
UPDATE users 
SET email_verified = FALSE 
WHERE email_verified IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.email_verified IS 'Boolean flag indicating if user email has been verified';
COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when email was verified (null if not verified)';

-- Create index for faster queries on email verification status
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);