-- Feedback Collection Database Schema
-- Creates tables for NPS surveys, feature surveys, pain points, and coordinator interviews

-- NPS Surveys Table
CREATE TABLE IF NOT EXISTS nps_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
    reason TEXT,
    language VARCHAR(5) NOT NULL DEFAULT 'hi',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_nps_user (user_id),
    INDEX idx_nps_created (created_at DESC),
    INDEX idx_nps_score (score)
);

COMMENT ON TABLE nps_surveys IS 'Net Promoter Score surveys from users';
COMMENT ON COLUMN nps_surveys.score IS 'NPS score from 0-10 (0-6: detractor, 7-8: passive, 9-10: promoter)';

-- Feature Satisfaction Surveys Table
CREATE TABLE IF NOT EXISTS feature_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature VARCHAR(100) NOT NULL,
    satisfaction INTEGER NOT NULL CHECK (satisfaction >= 1 AND satisfaction <= 5),
    feedback TEXT,
    language VARCHAR(5) NOT NULL DEFAULT 'hi',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_feature_user (user_id),
    INDEX idx_feature_name (feature),
    INDEX idx_feature_created (created_at DESC),
    INDEX idx_feature_satisfaction (satisfaction)
);

COMMENT ON TABLE feature_surveys IS 'Feature-specific satisfaction surveys';
COMMENT ON COLUMN feature_surveys.feature IS 'Feature name (disease_detection, crop_recommendation, market_prices, etc.)';
COMMENT ON COLUMN feature_surveys.satisfaction IS 'Satisfaction rating from 1-5 (1: very dissatisfied, 5: very satisfied)';

-- Pain Points Table
CREATE TABLE IF NOT EXISTS pain_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    language VARCHAR(5) NOT NULL DEFAULT 'hi',
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wont_fix')),
    resolution_notes TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_pain_user (user_id),
    INDEX idx_pain_category (category),
    INDEX idx_pain_severity (severity),
    INDEX idx_pain_status (status),
    INDEX idx_pain_created (created_at DESC)
);

COMMENT ON TABLE pain_points IS 'User-reported pain points and usability issues';
COMMENT ON COLUMN pain_points.category IS 'Issue category (performance, usability, accuracy, connectivity, etc.)';
COMMENT ON COLUMN pain_points.severity IS 'Issue severity level';
COMMENT ON COLUMN pain_points.status IS 'Current status of the issue';

-- Coordinator Interviews Table
CREATE TABLE IF NOT EXISTS coordinator_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coordinator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interview_date DATE NOT NULL,
    farmers_feedback TEXT NOT NULL,
    common_issues JSONB NOT NULL DEFAULT '[]',
    suggestions JSONB NOT NULL DEFAULT '[]',
    overall_sentiment VARCHAR(20) NOT NULL CHECK (overall_sentiment IN ('positive', 'neutral', 'negative')),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_coordinator (coordinator_id),
    INDEX idx_interview_date (interview_date DESC),
    INDEX idx_sentiment (overall_sentiment)
);

COMMENT ON TABLE coordinator_interviews IS 'Structured interviews with village coordinators';
COMMENT ON COLUMN coordinator_interviews.farmers_feedback IS 'Summary of feedback collected from farmers';
COMMENT ON COLUMN coordinator_interviews.common_issues IS 'JSON array of common issues reported';
COMMENT ON COLUMN coordinator_interviews.suggestions IS 'JSON array of improvement suggestions';

-- Analytics Events Table (if not exists from analytics service)
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_name VARCHAR(100) NOT NULL,
    event_properties JSONB,
    event_time TIMESTAMP NOT NULL DEFAULT NOW(),
    session_id UUID,
    INDEX idx_analytics_user (user_id),
    INDEX idx_analytics_event (event_name),
    INDEX idx_analytics_time (event_time DESC),
    INDEX idx_analytics_session (session_id)
);

COMMENT ON TABLE analytics_events IS 'User analytics events for tracking feature usage';

-- Analytics Sessions Table (if not exists from analytics service)
CREATE TABLE IF NOT EXISTS analytics_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_start TIMESTAMP NOT NULL,
    session_end TIMESTAMP,
    session_duration_seconds INTEGER,
    device_info JSONB,
    INDEX idx_session_user (user_id),
    INDEX idx_session_start (session_start DESC)
);

COMMENT ON TABLE analytics_sessions IS 'User session tracking for retention and engagement metrics';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for pain_points table
DROP TRIGGER IF EXISTS update_pain_points_updated_at ON pain_points;
CREATE TRIGGER update_pain_points_updated_at
    BEFORE UPDATE ON pain_points
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for NPS calculation
CREATE OR REPLACE VIEW nps_score_view AS
WITH scores AS (
    SELECT 
        score,
        CASE 
            WHEN score >= 9 THEN 'promoter'
            WHEN score >= 7 THEN 'passive'
            ELSE 'detractor'
        END as category,
        created_at
    FROM nps_surveys
)
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) FILTER (WHERE category = 'promoter')::float / COUNT(*) * 100 as promoter_pct,
    COUNT(*) FILTER (WHERE category = 'passive')::float / COUNT(*) * 100 as passive_pct,
    COUNT(*) FILTER (WHERE category = 'detractor')::float / COUNT(*) * 100 as detractor_pct,
    (COUNT(*) FILTER (WHERE category = 'promoter')::float / COUNT(*) * 100) -
    (COUNT(*) FILTER (WHERE category = 'detractor')::float / COUNT(*) * 100) as nps_score,
    COUNT(*) as total_responses
FROM scores
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

COMMENT ON VIEW nps_score_view IS 'Daily NPS score calculation with promoter/passive/detractor breakdown';

-- Create view for feature satisfaction summary
CREATE OR REPLACE VIEW feature_satisfaction_view AS
SELECT 
    feature,
    AVG(satisfaction) as avg_satisfaction,
    COUNT(*) as total_responses,
    COUNT(*) FILTER (WHERE satisfaction >= 4) as satisfied_count,
    COUNT(*) FILTER (WHERE satisfaction <= 2) as dissatisfied_count,
    DATE_TRUNC('day', created_at) as date
FROM feature_surveys
GROUP BY feature, DATE_TRUNC('day', created_at)
ORDER BY date DESC, avg_satisfaction ASC;

COMMENT ON VIEW feature_satisfaction_view IS 'Daily feature satisfaction summary';

-- Create view for pain point summary
CREATE OR REPLACE VIEW pain_point_summary_view AS
SELECT 
    category,
    severity,
    status,
    COUNT(*) as count,
    DATE_TRUNC('day', created_at) as date
FROM pain_points
GROUP BY category, severity, status, DATE_TRUNC('day', created_at)
ORDER BY date DESC, count DESC;

COMMENT ON VIEW pain_point_summary_view IS 'Daily pain point summary by category, severity, and status';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON nps_surveys TO krishiai_app;
-- GRANT SELECT, INSERT, UPDATE ON feature_surveys TO krishiai_app;
-- GRANT SELECT, INSERT, UPDATE ON pain_points TO krishiai_app;
-- GRANT SELECT, INSERT, UPDATE ON coordinator_interviews TO krishiai_app;
-- GRANT SELECT ON nps_score_view TO krishiai_app;
-- GRANT SELECT ON feature_satisfaction_view TO krishiai_app;
-- GRANT SELECT ON pain_point_summary_view TO krishiai_app;
