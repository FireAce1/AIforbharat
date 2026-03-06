-- Migration: Add encrypted columns for PII data
-- Requirements: 15.2
-- 
-- This migration adds encrypted columns for sensitive PII fields:
-- - phone_encrypted (replaces phone in users table)
-- - name_encrypted (replaces name in users table)
-- - location_encrypted (replaces location GEOGRAPHY in farms table)
--
-- Strategy:
-- 1. Add new encrypted columns
-- 2. Keep original columns temporarily for data migration
-- 3. After migration, drop original columns (in separate migration)

-- ============================================
-- Users Table: Add encrypted phone and name
-- ============================================

-- Add encrypted phone column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_encrypted TEXT;

-- Add encrypted name column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS name_encrypted TEXT;

-- Add index on encrypted phone for lookups (even though encrypted, we still need to search)
-- Note: This will be a full table scan, but necessary for authentication
CREATE INDEX IF NOT EXISTS idx_users_phone_encrypted ON users(phone_encrypted);

-- Add comment to document encryption
COMMENT ON COLUMN users.phone_encrypted IS 'AES-256-GCM encrypted phone number. Format: version:iv:authTag:ciphertext';
COMMENT ON COLUMN users.name_encrypted IS 'AES-256-GCM encrypted user name. Format: version:iv:authTag:ciphertext';

-- ============================================
-- Farms Table: Add encrypted location
-- ============================================

-- Add encrypted latitude column
ALTER TABLE farms 
ADD COLUMN IF NOT EXISTS latitude_encrypted TEXT;

-- Add encrypted longitude column
ALTER TABLE farms 
ADD COLUMN IF NOT EXISTS longitude_encrypted TEXT;

-- Add comment to document encryption
COMMENT ON COLUMN farms.latitude_encrypted IS 'AES-256-GCM encrypted latitude. Format: version:iv:authTag:ciphertext';
COMMENT ON COLUMN farms.longitude_encrypted IS 'AES-256-GCM encrypted longitude. Format: version:iv:authTag:ciphertext';

-- ============================================
-- Key Rotation Tracking Table
-- ============================================

-- Create table to track encryption key versions and rotation
CREATE TABLE IF NOT EXISTS encryption_keys (
    version INTEGER PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    rotated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT
);

-- Insert initial key version
INSERT INTO encryption_keys (version, is_active, notes)
VALUES (1, TRUE, 'Initial encryption key')
ON CONFLICT (version) DO NOTHING;

-- Create index for active key lookup
CREATE INDEX IF NOT EXISTS idx_encryption_keys_active ON encryption_keys(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE encryption_keys IS 'Tracks encryption key versions for key rotation policy (every 90 days)';

-- ============================================
-- Audit Log for Encryption Operations
-- ============================================

-- Create table to audit encryption/decryption operations
CREATE TABLE IF NOT EXISTS encryption_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation VARCHAR(20) NOT NULL, -- 'encrypt', 'decrypt', 'reencrypt'
    table_name VARCHAR(50) NOT NULL,
    column_name VARCHAR(50) NOT NULL,
    key_version INTEGER NOT NULL,
    performed_at TIMESTAMP DEFAULT NOW(),
    performed_by VARCHAR(100), -- service name or user
    record_count INTEGER DEFAULT 1,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- Create index for audit queries
CREATE INDEX IF NOT EXISTS idx_encryption_audit_log_performed_at ON encryption_audit_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_encryption_audit_log_table ON encryption_audit_log(table_name, column_name);

COMMENT ON TABLE encryption_audit_log IS 'Audit log for all encryption operations for security compliance';

-- ============================================
-- Migration Status Tracking
-- ============================================

-- Create table to track migration progress
CREATE TABLE IF NOT EXISTS encryption_migration_status (
    table_name VARCHAR(50) PRIMARY KEY,
    total_records INTEGER NOT NULL DEFAULT 0,
    encrypted_records INTEGER NOT NULL DEFAULT 0,
    failed_records INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    error_message TEXT
);

-- Insert status for tables that need migration
INSERT INTO encryption_migration_status (table_name, status)
VALUES 
    ('users', 'pending'),
    ('farms', 'pending')
ON CONFLICT (table_name) DO NOTHING;

COMMENT ON TABLE encryption_migration_status IS 'Tracks progress of encrypting existing data';

-- ============================================
-- Verification Views
-- ============================================

-- Create view to check encryption status
CREATE OR REPLACE VIEW encryption_status AS
SELECT 
    'users' AS table_name,
    COUNT(*) AS total_records,
    COUNT(phone_encrypted) AS encrypted_phone,
    COUNT(name_encrypted) AS encrypted_name,
    COUNT(*) - COUNT(phone_encrypted) AS unencrypted_phone,
    COUNT(*) - COUNT(name_encrypted) AS unencrypted_name
FROM users
UNION ALL
SELECT 
    'farms' AS table_name,
    COUNT(*) AS total_records,
    COUNT(latitude_encrypted) AS encrypted_latitude,
    COUNT(longitude_encrypted) AS encrypted_longitude,
    COUNT(*) - COUNT(latitude_encrypted) AS unencrypted_latitude,
    COUNT(*) - COUNT(longitude_encrypted) AS unencrypted_longitude
FROM farms;

COMMENT ON VIEW encryption_status IS 'Shows encryption status for all tables with PII data';

-- ============================================
-- Success Message
-- ============================================

DO $$
BEGIN
    RAISE NOTICE 'Encryption columns added successfully';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run data migration script to encrypt existing data';
    RAISE NOTICE '2. Verify encryption with: SELECT * FROM encryption_status;';
    RAISE NOTICE '3. After verification, run cleanup script to drop original columns';
END $$;
