-- DPDP Act 2023 Compliance Tables
-- Creates tables for consent management, audit logging, and data governance

-- User Consents Table
CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('granted', 'denied', 'withdrawn')),
    granted_at TIMESTAMP,
    withdrawn_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX idx_user_consents_type ON user_consents(consent_type);
CREATE INDEX idx_user_consents_status ON user_consents(status);
CREATE INDEX idx_user_consents_created ON user_consents(created_at DESC);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL, -- Can be 'deleted_user' after anonymization
    action VARCHAR(50) NOT NULL CHECK (action IN ('read', 'create', 'update', 'delete', 'export', 'consent_change')),
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN (details);

-- Data Deletion Requests Table (for tracking deletion requests)
CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    phone VARCHAR(15) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    requested_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    error_message TEXT
);

CREATE INDEX idx_deletion_requests_user_id ON data_deletion_requests(user_id);
CREATE INDEX idx_deletion_requests_status ON data_deletion_requests(status);
CREATE INDEX idx_deletion_requests_requested ON data_deletion_requests(requested_at DESC);

-- Data Export Requests Table (for tracking export requests)
CREATE TABLE IF NOT EXISTS data_export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    export_url TEXT,
    expires_at TIMESTAMP,
    requested_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    error_message TEXT
);

CREATE INDEX idx_export_requests_user_id ON data_export_requests(user_id);
CREATE INDEX idx_export_requests_status ON data_export_requests(status);
CREATE INDEX idx_export_requests_requested ON data_export_requests(requested_at DESC);

-- Privacy Policy Acceptance Table
CREATE TABLE IF NOT EXISTS privacy_policy_acceptance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_version VARCHAR(20) NOT NULL,
    language VARCHAR(5) NOT NULL,
    accepted_at TIMESTAMP DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE INDEX idx_privacy_acceptance_user_id ON privacy_policy_acceptance(user_id);
CREATE INDEX idx_privacy_acceptance_version ON privacy_policy_acceptance(policy_version);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_consents
CREATE TRIGGER update_user_consents_updated_at 
    BEFORE UPDATE ON user_consents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE user_consents IS 'Stores user consent records for DPDP Act 2023 compliance';
COMMENT ON TABLE audit_logs IS 'Audit trail for all data access and modifications';
COMMENT ON TABLE data_deletion_requests IS 'Tracks right to be forgotten requests';
COMMENT ON TABLE data_export_requests IS 'Tracks right to data portability requests';
COMMENT ON TABLE privacy_policy_acceptance IS 'Records privacy policy acceptance by users';
