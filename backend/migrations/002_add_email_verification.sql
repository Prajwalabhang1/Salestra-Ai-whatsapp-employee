-- Migration: Add email verification fields
-- Description: Adds email verification token and status tracking to tenants table
-- Date: 2026-01-26

ALTER TABLE tenants
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN email_verification_token VARCHAR(255),
ADD COLUMN email_verification_expires TIMESTAMP;

-- Index for fast token lookup
CREATE INDEX idx_email_verification_token ON tenants(email_verification_token)
WHERE email_verification_token IS NOT NULL;

-- Index for verified status queries
CREATE INDEX idx_email_verified ON tenants(email_verified);

-- Update existing users to have verified=true (grandfather clause)
UPDATE tenants SET email_verified = TRUE WHERE email_verified IS NULL;

COMMENT ON COLUMN tenants.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN tenants.email_verification_token IS 'Token sent in verification email, expires after 24 hours';
COMMENT ON COLUMN tenants.email_verification_expires IS 'Timestamp when verification token expires';
