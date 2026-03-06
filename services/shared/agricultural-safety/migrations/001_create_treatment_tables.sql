-- Agricultural Safety Standards - Database Schema
-- Implements treatment review system with agronomist approval workflow

-- Treatment Recommendations Table
CREATE TABLE IF NOT EXISTS treatment_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_id VARCHAR(100) NOT NULL,
    disease_name VARCHAR(200) NOT NULL,
    disease_name_local VARCHAR(200) NOT NULL,
    crop_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('EARLY', 'MODERATE', 'SEVERE')),
    
    -- Treatment details
    treatment_type VARCHAR(20) NOT NULL CHECK (treatment_type IN ('ORGANIC', 'CHEMICAL', 'BIOLOGICAL', 'CULTURAL')),
    treatment_name VARCHAR(200) NOT NULL,
    treatment_name_local VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    description_local TEXT NOT NULL,
    
    -- Priority and ordering
    priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 30),
    priority_category VARCHAR(20) NOT NULL CHECK (priority_category IN ('PRIMARY', 'SECONDARY', 'TERTIARY')),
    
    -- Application details
    dosage VARCHAR(200),
    dosage_local VARCHAR(200),
    application_method VARCHAR(200) NOT NULL,
    application_method_local VARCHAR(200) NOT NULL,
    frequency VARCHAR(200) NOT NULL,
    frequency_local VARCHAR(200) NOT NULL,
    duration VARCHAR(200) NOT NULL,
    duration_local VARCHAR(200) NOT NULL,
    
    -- Safety information
    safety_precautions JSONB NOT NULL DEFAULT '[]',
    safety_precautions_local JSONB NOT NULL DEFAULT '[]',
    waiting_period VARCHAR(100),
    waiting_period_local VARCHAR(100),
    
    -- Legal compliance (for chemical treatments)
    is_legally_approved BOOLEAN NOT NULL DEFAULT false,
    legal_usage_limit VARCHAR(500),
    legal_usage_limit_local VARCHAR(500),
    registration_number VARCHAR(100),
    
    -- Review status
    review_status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_disease_id (disease_id),
    INDEX idx_crop_name (crop_name),
    INDEX idx_treatment_type (treatment_type),
    INDEX idx_review_status (review_status),
    INDEX idx_priority (priority)
);

-- Agronomist Reviews Table
CREATE TABLE IF NOT EXISTS agronomist_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_id UUID NOT NULL REFERENCES treatment_recommendations(id) ON DELETE CASCADE,
    agronomist_id UUID NOT NULL REFERENCES users(id),
    agronomist_name VARCHAR(200) NOT NULL,
    agronomist_credentials TEXT NOT NULL,
    
    status VARCHAR(30) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED')),
    review_date TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Review details
    comments TEXT NOT NULL,
    comments_local TEXT NOT NULL,
    
    -- Approval criteria checks
    organic_priority_verified BOOLEAN NOT NULL DEFAULT false,
    legal_compliance_verified BOOLEAN NOT NULL DEFAULT false,
    dosage_verified BOOLEAN NOT NULL DEFAULT false,
    safety_verified BOOLEAN NOT NULL DEFAULT false,
    
    -- Revision requests
    revision_required BOOLEAN NOT NULL DEFAULT false,
    revision_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_treatment_id (treatment_id),
    INDEX idx_agronomist_id (agronomist_id),
    INDEX idx_status (status),
    INDEX idx_review_date (review_date DESC)
);

-- Pesticide Legal Limits Table
CREATE TABLE IF NOT EXISTS pesticide_legal_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pesticide_name VARCHAR(200) NOT NULL UNIQUE,
    pesticide_name_local VARCHAR(200) NOT NULL,
    registration_number VARCHAR(100) NOT NULL UNIQUE,
    
    -- Legal limits
    max_applications_per_season INTEGER NOT NULL,
    max_dosage_per_hectare VARCHAR(200) NOT NULL,
    min_days_between_applications INTEGER NOT NULL,
    pre_harvest_interval INTEGER NOT NULL,
    
    -- Approved crops
    approved_crops JSONB NOT NULL DEFAULT '[]',
    
    -- Restrictions
    restricted_states JSONB DEFAULT '[]',
    banned_for_organic_farming BOOLEAN NOT NULL DEFAULT false,
    requires_license BOOLEAN NOT NULL DEFAULT false,
    
    -- Safety classification
    toxicity_class VARCHAR(20) NOT NULL CHECK (toxicity_class IN ('LOW', 'MODERATE', 'HIGH', 'EXTREMELY_HIGH')),
    environmental_impact VARCHAR(20) NOT NULL CHECK (environmental_impact IN ('LOW', 'MODERATE', 'HIGH')),
    
    -- Metadata
    regulatory_authority VARCHAR(200) NOT NULL,
    last_updated TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_pesticide_name (pesticide_name),
    INDEX idx_registration_number (registration_number),
    INDEX idx_toxicity_class (toxicity_class)
);

-- Add agronomist role to users table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'FARMER' 
            CHECK (role IN ('FARMER', 'AGRONOMIST', 'ADMIN', 'COORDINATOR'));
    END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_treatment_recommendations_updated_at ON treatment_recommendations;
CREATE TRIGGER update_treatment_recommendations_updated_at
    BEFORE UPDATE ON treatment_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agronomist_reviews_updated_at ON agronomist_reviews;
CREATE TRIGGER update_agronomist_reviews_updated_at
    BEFORE UPDATE ON agronomist_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample pesticide legal limits (Common Indian pesticides)
INSERT INTO pesticide_legal_limits (
    pesticide_name,
    pesticide_name_local,
    registration_number,
    max_applications_per_season,
    max_dosage_per_hectare,
    min_days_between_applications,
    pre_harvest_interval,
    approved_crops,
    restricted_states,
    banned_for_organic_farming,
    requires_license,
    toxicity_class,
    environmental_impact,
    regulatory_authority
) VALUES
(
    'Chlorpyrifos 20% EC',
    'क्लोरपायरीफॉस 20% EC',
    'CIB-001-2020',
    2,
    '1.5 liters per hectare',
    15,
    21,
    '["Rice", "Cotton", "Wheat", "Sugarcane"]',
    '["Kerala"]',
    true,
    false,
    'MODERATE',
    'MODERATE',
    'Central Insecticides Board & Registration Committee'
),
(
    'Imidacloprid 17.8% SL',
    'इमिडाक्लोप्रिड 17.8% SL',
    'CIB-002-2020',
    2,
    '0.5 liters per hectare',
    14,
    14,
    '["Cotton", "Rice", "Wheat", "Tomato", "Chili"]',
    '[]',
    true,
    false,
    'MODERATE',
    'HIGH',
    'Central Insecticides Board & Registration Committee'
),
(
    'Mancozeb 75% WP',
    'मैनकोजेब 75% WP',
    'CIB-003-2020',
    3,
    '2.5 kg per hectare',
    10,
    7,
    '["Tomato", "Potato", "Onion", "Grapes", "Apple"]',
    '[]',
    true,
    false,
    'LOW',
    'LOW',
    'Central Insecticides Board & Registration Committee'
);

-- Create view for approved treatments with organic priority
CREATE OR REPLACE VIEW approved_treatments_view AS
SELECT 
    tr.*,
    ar.agronomist_name,
    ar.review_date,
    CASE 
        WHEN tr.treatment_type IN ('ORGANIC', 'BIOLOGICAL', 'CULTURAL') THEN 'Organic Alternative'
        ELSE 'Chemical Treatment'
    END as treatment_category
FROM treatment_recommendations tr
LEFT JOIN agronomist_reviews ar ON tr.id = ar.treatment_id AND ar.status = 'APPROVED'
WHERE tr.review_status = 'APPROVED'
ORDER BY tr.priority ASC, tr.treatment_type ASC;

COMMENT ON TABLE treatment_recommendations IS 'Stores disease treatment recommendations with organic/chemical separation and agronomist approval workflow';
COMMENT ON TABLE agronomist_reviews IS 'Tracks agronomist reviews and approval workflow for treatment recommendations';
COMMENT ON TABLE pesticide_legal_limits IS 'Maintains legal usage limits and restrictions for chemical pesticides';
COMMENT ON VIEW approved_treatments_view IS 'View of approved treatments sorted by priority (organic first)';
