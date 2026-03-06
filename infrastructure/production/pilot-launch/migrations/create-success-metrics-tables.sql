-- Success Metrics Tracking Tables
-- Task 19.4: Measure success metrics

-- App installation tracking
CREATE TABLE IF NOT EXISTS app_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_model VARCHAR(100),
    android_version VARCHAR(20),
    app_version VARCHAR(20) NOT NULL,
    installation_source VARCHAR(50), -- 'coordinator', 'self', 'referral'
    installed_at TIMESTAMP DEFAULT NOW(),
    first_launch_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    uninstalled_at TIMESTAMP,
    INDEX idx_user_installation (user_id),
    INDEX idx_installed_at (installed_at),
    INDEX idx_is_active (is_active)
);

-- Monthly active users tracking
CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    session_count INTEGER DEFAULT 0,
    total_session_duration_seconds INTEGER DEFAULT 0,
    features_used JSONB DEFAULT '[]', -- Array of feature names used
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, activity_date),
    INDEX idx_user_activity_date (user_id, activity_date),
    INDEX idx_activity_date (activity_date)
);

-- Feature usage tracking
CREATE TABLE IF NOT EXISTS feature_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL, -- 'disease_detection', 'crop_recommendation', 'market_prices', etc.
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, feature_name),
    INDEX idx_user_feature (user_id, feature_name),
    INDEX idx_feature_name (feature_name)
);

-- Disease detection tracking (already exists, but adding aggregation view)
CREATE OR REPLACE VIEW disease_detection_metrics AS
SELECT 
    DATE(detected_at) as detection_date,
    COUNT(*) as total_detections,
    COUNT(DISTINCT crop_id) as unique_crops,
    AVG(confidence) as avg_confidence,
    COUNT(CASE WHEN severity = 'Severe' THEN 1 END) as severe_cases,
    COUNT(CASE WHEN severity = 'Moderate' THEN 1 END) as moderate_cases,
    COUNT(CASE WHEN severity = 'Early' THEN 1 END) as early_cases
FROM disease_detections
GROUP BY DATE(detected_at)
ORDER BY detection_date DESC;

-- Marketplace inquiries tracking (placeholder for Phase 2)
CREATE TABLE IF NOT EXISTS marketplace_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    crop_name VARCHAR(100) NOT NULL,
    inquiry_type VARCHAR(50), -- 'buy', 'sell', 'price_check'
    quantity_kg DECIMAL(10,2),
    target_price DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'contacted', 'completed', 'cancelled'
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_inquiry (user_id),
    INDEX idx_inquiry_date (created_at),
    INDEX idx_status (status)
);

-- NPS (Net Promoter Score) tracking
CREATE TABLE IF NOT EXISTS nps_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
    feedback_text TEXT,
    survey_date DATE NOT NULL,
    survey_type VARCHAR(50) DEFAULT 'monthly', -- 'monthly', 'post_harvest', 'feature_specific'
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_nps (user_id),
    INDEX idx_survey_date (survey_date),
    INDEX idx_score (score)
);

-- Session duration tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    screens_visited JSONB DEFAULT '[]', -- Array of screen names
    actions_performed JSONB DEFAULT '[]', -- Array of action names
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_session (user_id, start_time),
    INDEX idx_session_date (start_time)
);

-- Farmer outcome surveys (income, water usage, crop loss)
CREATE TABLE IF NOT EXISTS farmer_outcome_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    survey_period VARCHAR(50) NOT NULL, -- 'baseline', 'month_3', 'month_6', 'month_12'
    survey_date DATE NOT NULL,
    
    -- Income metrics
    monthly_income_inr DECIMAL(12,2),
    income_increase_percentage DECIMAL(5,2),
    income_sources JSONB, -- Array of income sources
    
    -- Water usage metrics
    water_usage_mm DECIMAL(10,2),
    water_reduction_percentage DECIMAL(5,2),
    irrigation_method VARCHAR(50),
    
    -- Crop loss metrics
    crop_loss_percentage DECIMAL(5,2),
    crop_loss_reduction_percentage DECIMAL(5,2),
    loss_reasons JSONB, -- Array of loss reasons
    
    -- Qualitative feedback
    satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
    challenges_faced TEXT,
    suggestions TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_survey (user_id, survey_period),
    INDEX idx_survey_date (survey_date)
);

-- Success metrics aggregation view
CREATE OR REPLACE VIEW success_metrics_summary AS
SELECT 
    -- App installations
    (SELECT COUNT(*) FROM app_installations WHERE is_active = TRUE) as total_active_installations,
    (SELECT COUNT(*) FROM app_installations WHERE installed_at >= CURRENT_DATE - INTERVAL '30 days') as installations_last_30_days,
    
    -- Monthly active users (last 30 days)
    (SELECT COUNT(DISTINCT user_id) FROM user_activity WHERE activity_date >= CURRENT_DATE - INTERVAL '30 days') as monthly_active_users,
    
    -- Retention rate (users active in last 30 days / total installations)
    ROUND(
        (SELECT COUNT(DISTINCT user_id) FROM user_activity WHERE activity_date >= CURRENT_DATE - INTERVAL '30 days')::DECIMAL / 
        NULLIF((SELECT COUNT(*) FROM app_installations WHERE is_active = TRUE), 0) * 100, 
        2
    ) as retention_rate_percentage,
    
    -- Disease detections
    (SELECT COUNT(*) FROM disease_detections) as total_disease_detections,
    (SELECT COUNT(*) FROM disease_detections WHERE detected_at >= CURRENT_DATE - INTERVAL '30 days') as detections_last_30_days,
    
    -- Marketplace inquiries
    (SELECT COUNT(*) FROM marketplace_inquiries) as total_marketplace_inquiries,
    (SELECT COUNT(*) FROM marketplace_inquiries WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as inquiries_last_30_days,
    
    -- NPS score (average of last 30 days)
    (SELECT ROUND(AVG(score), 2) FROM nps_surveys WHERE survey_date >= CURRENT_DATE - INTERVAL '30 days') as avg_nps_score,
    
    -- Average session duration (last 30 days)
    (SELECT ROUND(AVG(duration_seconds) / 60.0, 2) FROM user_sessions WHERE start_time >= CURRENT_DATE - INTERVAL '30 days') as avg_session_duration_minutes,
    
    -- Farmer outcomes (latest surveys)
    (SELECT ROUND(AVG(income_increase_percentage), 2) FROM farmer_outcome_surveys WHERE survey_period != 'baseline') as avg_income_increase_percentage,
    (SELECT ROUND(AVG(water_reduction_percentage), 2) FROM farmer_outcome_surveys WHERE survey_period != 'baseline') as avg_water_reduction_percentage,
    (SELECT ROUND(AVG(crop_loss_reduction_percentage), 2) FROM farmer_outcome_surveys WHERE survey_period != 'baseline') as avg_crop_loss_reduction_percentage;

-- Retention cohort analysis view
CREATE OR REPLACE VIEW retention_cohort_analysis AS
SELECT 
    DATE_TRUNC('month', ai.installed_at) as cohort_month,
    COUNT(DISTINCT ai.user_id) as cohort_size,
    COUNT(DISTINCT CASE WHEN ua.activity_date >= CURRENT_DATE - INTERVAL '30 days' THEN ua.user_id END) as active_users,
    ROUND(
        COUNT(DISTINCT CASE WHEN ua.activity_date >= CURRENT_DATE - INTERVAL '30 days' THEN ua.user_id END)::DECIMAL / 
        NULLIF(COUNT(DISTINCT ai.user_id), 0) * 100, 
        2
    ) as retention_rate_percentage
FROM app_installations ai
LEFT JOIN user_activity ua ON ai.user_id = ua.user_id
WHERE ai.is_active = TRUE
GROUP BY DATE_TRUNC('month', ai.installed_at)
ORDER BY cohort_month DESC;

-- Feature adoption metrics view
CREATE OR REPLACE VIEW feature_adoption_metrics AS
SELECT 
    feature_name,
    COUNT(DISTINCT user_id) as unique_users,
    SUM(usage_count) as total_usage,
    ROUND(AVG(usage_count), 2) as avg_usage_per_user,
    MAX(last_used_at) as last_used,
    ROUND(
        COUNT(DISTINCT user_id)::DECIMAL / 
        NULLIF((SELECT COUNT(*) FROM app_installations WHERE is_active = TRUE), 0) * 100, 
        2
    ) as adoption_rate_percentage
FROM feature_usage
GROUP BY feature_name
ORDER BY unique_users DESC;

-- Comments
COMMENT ON TABLE app_installations IS 'Tracks app installations and device information';
COMMENT ON TABLE user_activity IS 'Daily user activity tracking for MAU calculation';
COMMENT ON TABLE feature_usage IS 'Feature-level usage tracking';
COMMENT ON TABLE nps_surveys IS 'Net Promoter Score surveys';
COMMENT ON TABLE user_sessions IS 'Individual session tracking for duration metrics';
COMMENT ON TABLE farmer_outcome_surveys IS 'Farmer outcome surveys for impact measurement';
COMMENT ON VIEW success_metrics_summary IS 'Aggregated success metrics for dashboard';
COMMENT ON VIEW retention_cohort_analysis IS 'Cohort-based retention analysis';
COMMENT ON VIEW feature_adoption_metrics IS 'Feature adoption and usage metrics';
