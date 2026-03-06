-- Iteration Management System Database Schema
-- Creates tables for issue tracking, performance monitoring, ML retraining, and documentation updates

-- ============================================================================
-- ISSUES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('bug', 'feature', 'performance', 'ml_accuracy', 'documentation')),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix')),
    source VARCHAR(50) NOT NULL, -- 'pain_point', 'nps_feedback', 'coordinator_interview', 'manual', 'performance_monitor'
    source_id UUID, -- Reference to source record (pain_point id, nps_survey id, etc.)
    affected_users INTEGER DEFAULT 1,
    impact_score INTEGER CHECK (impact_score >= 1 AND impact_score <= 10),
    assigned_to VARCHAR(100),
    resolution TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(type);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_priority_status ON issues(priority, status);

-- ============================================================================
-- PERFORMANCE BOTTLENECKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_bottlenecks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service VARCHAR(100) NOT NULL,
    endpoint VARCHAR(200) NOT NULL,
    metric VARCHAR(50) NOT NULL CHECK (metric IN ('response_time', 'error_rate', 'throughput')),
    current_value DECIMAL(10,2) NOT NULL,
    threshold DECIMAL(10,2) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    detected_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    UNIQUE(service, endpoint, metric)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bottlenecks_service ON performance_bottlenecks(service);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_severity ON performance_bottlenecks(severity);
CREATE INDEX IF NOT EXISTS idx_bottlenecks_resolved ON performance_bottlenecks(resolved_at);

-- ============================================================================
-- ML RETRAINING JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ml_retraining_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL CHECK (model_name IN ('disease_detector', 'crop_recommender', 'price_forecaster', 'chatbot')),
    reason TEXT NOT NULL,
    dataset_size INTEGER NOT NULL,
    current_accuracy DECIMAL(5,4), -- e.g., 0.9234 for 92.34%
    target_accuracy DECIMAL(5,4),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    new_accuracy DECIMAL(5,4),
    training_metrics JSONB, -- Store detailed training metrics
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_retraining_model ON ml_retraining_jobs(model_name);
CREATE INDEX IF NOT EXISTS idx_retraining_status ON ml_retraining_jobs(status);
CREATE INDEX IF NOT EXISTS idx_retraining_created ON ml_retraining_jobs(created_at DESC);

-- ============================================================================
-- DOCUMENTATION UPDATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS documentation_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL CHECK (category IN ('faq', 'troubleshooting', 'user_guide', 'api_docs')),
    question TEXT NOT NULL,
    answer TEXT,
    language VARCHAR(5) NOT NULL CHECK (language IN ('hi', 'mr', 'en')),
    frequency INTEGER DEFAULT 1, -- How often this question is asked
    source VARCHAR(50) NOT NULL, -- 'support_ticket', 'chatbot', 'coordinator_feedback', 'manual'
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'published')),
    approved_by VARCHAR(100),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(question, language)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_docs_category ON documentation_updates(category);
CREATE INDEX IF NOT EXISTS idx_docs_status ON documentation_updates(status);
CREATE INDEX IF NOT EXISTS idx_docs_language ON documentation_updates(language);
CREATE INDEX IF NOT EXISTS idx_docs_frequency ON documentation_updates(frequency DESC);

-- ============================================================================
-- ISSUE COMMENTS TABLE (for tracking discussion and updates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS issue_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    author VARCHAR(100) NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_issue ON issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON issue_comments(created_at DESC);

-- ============================================================================
-- ITERATION METRICS TABLE (for tracking iteration progress)
-- ============================================================================

CREATE TABLE IF NOT EXISTS iteration_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iteration_number INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    issues_opened INTEGER DEFAULT 0,
    issues_resolved INTEGER DEFAULT 0,
    bugs_fixed INTEGER DEFAULT 0,
    features_added INTEGER DEFAULT 0,
    performance_improvements INTEGER DEFAULT 0,
    ml_models_retrained INTEGER DEFAULT 0,
    docs_updated INTEGER DEFAULT 0,
    avg_resolution_time_hours DECIMAL(10,2),
    user_satisfaction_change DECIMAL(5,2), -- Change in NPS score
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(iteration_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_iteration_number ON iteration_metrics(iteration_number DESC);
CREATE INDEX IF NOT EXISTS idx_iteration_dates ON iteration_metrics(start_date, end_date);

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- View: Open issues by priority
CREATE OR REPLACE VIEW open_issues_by_priority AS
SELECT 
    priority,
    type,
    COUNT(*) as count,
    SUM(affected_users) as total_affected_users,
    AVG(impact_score) as avg_impact_score
FROM issues
WHERE status IN ('open', 'in_progress')
GROUP BY priority, type
ORDER BY 
    CASE priority
        WHEN 'P0' THEN 1
        WHEN 'P1' THEN 2
        WHEN 'P2' THEN 3
        WHEN 'P3' THEN 4
    END,
    count DESC;

-- View: Performance bottlenecks summary
CREATE OR REPLACE VIEW active_bottlenecks_summary AS
SELECT 
    service,
    metric,
    severity,
    COUNT(*) as count,
    AVG(current_value) as avg_value,
    MAX(current_value) as max_value
FROM performance_bottlenecks
WHERE resolved_at IS NULL
GROUP BY service, metric, severity
ORDER BY 
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END;

-- View: ML retraining progress
CREATE OR REPLACE VIEW ml_retraining_progress AS
SELECT 
    model_name,
    status,
    COUNT(*) as job_count,
    AVG(current_accuracy) as avg_current_accuracy,
    AVG(new_accuracy) as avg_new_accuracy,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/3600) as avg_training_hours
FROM ml_retraining_jobs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY model_name, status;

-- View: Documentation gaps (frequently asked questions without answers)
CREATE OR REPLACE VIEW documentation_gaps AS
SELECT 
    category,
    language,
    question,
    frequency,
    source
FROM documentation_updates
WHERE status = 'pending'
    AND frequency >= 5
ORDER BY frequency DESC, created_at DESC;

-- View: Iteration velocity (issues resolved per week)
CREATE OR REPLACE VIEW iteration_velocity AS
SELECT 
    DATE_TRUNC('week', resolved_at) as week,
    COUNT(*) as issues_resolved,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
FROM issues
WHERE resolved_at IS NOT NULL
    AND resolved_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', resolved_at)
ORDER BY week DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Auto-create issue from pain point
CREATE OR REPLACE FUNCTION create_issue_from_pain_point()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create issue for high/critical pain points
    IF NEW.severity IN ('high', 'critical') THEN
        INSERT INTO issues (
            title,
            description,
            type,
            priority,
            status,
            source,
            source_id,
            affected_users,
            impact_score,
            created_at,
            updated_at
        )
        VALUES (
            'Pain point: ' || NEW.category,
            NEW.description,
            'bug',
            CASE 
                WHEN NEW.severity = 'critical' THEN 'P0'
                WHEN NEW.severity = 'high' THEN 'P1'
                ELSE 'P2'
            END,
            'open',
            'pain_point',
            NEW.id,
            1,
            CASE 
                WHEN NEW.severity = 'critical' THEN 9
                WHEN NEW.severity = 'high' THEN 7
                ELSE 5
            END,
            NOW(),
            NOW()
        )
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Create issue from pain point
DROP TRIGGER IF EXISTS trigger_create_issue_from_pain_point ON pain_points;
CREATE TRIGGER trigger_create_issue_from_pain_point
    AFTER INSERT ON pain_points
    FOR EACH ROW
    EXECUTE FUNCTION create_issue_from_pain_point();

-- Function: Update iteration metrics
CREATE OR REPLACE FUNCTION update_iteration_metrics(
    p_iteration_number INTEGER,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS VOID AS $$
DECLARE
    v_issues_opened INTEGER;
    v_issues_resolved INTEGER;
    v_bugs_fixed INTEGER;
    v_features_added INTEGER;
    v_performance_improvements INTEGER;
    v_ml_models_retrained INTEGER;
    v_docs_updated INTEGER;
    v_avg_resolution_time DECIMAL(10,2);
    v_nps_change DECIMAL(5,2);
BEGIN
    -- Count issues opened
    SELECT COUNT(*) INTO v_issues_opened
    FROM issues
    WHERE created_at::DATE BETWEEN p_start_date AND p_end_date;
    
    -- Count issues resolved
    SELECT COUNT(*) INTO v_issues_resolved
    FROM issues
    WHERE resolved_at::DATE BETWEEN p_start_date AND p_end_date;
    
    -- Count bugs fixed
    SELECT COUNT(*) INTO v_bugs_fixed
    FROM issues
    WHERE type = 'bug'
        AND resolved_at::DATE BETWEEN p_start_date AND p_end_date;
    
    -- Count features added
    SELECT COUNT(*) INTO v_features_added
    FROM issues
    WHERE type = 'feature'
        AND resolved_at::DATE BETWEEN p_start_date AND p_end_date;
    
    -- Count performance improvements
    SELECT COUNT(*) INTO v_performance_improvements
    FROM issues
    WHERE type = 'performance'
        AND resolved_at::DATE BETWEEN p_start_date AND p_end_date;
    
    -- Count ML models retrained
    SELECT COUNT(*) INTO v_ml_models_retrained
    FROM ml_retraining_jobs
    WHERE status = 'completed'
        AND completed_at::DATE BETWEEN p_start_date AND p_end_date;
    
    -- Count docs updated
    SELECT COUNT(*) INTO v_docs_updated
    FROM documentation_updates
    WHERE status = 'published'
        AND published_at::DATE BETWEEN p_start_date AND p_end_date;
    
    -- Calculate average resolution time
    SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) INTO v_avg_resolution_time
    FROM issues
    WHERE resolved_at::DATE BETWEEN p_start_date AND p_end_date;
    
    -- Calculate NPS change (compare to previous period)
    WITH current_nps AS (
        SELECT AVG(score) as score
        FROM nps_surveys
        WHERE created_at::DATE BETWEEN p_start_date AND p_end_date
    ),
    previous_nps AS (
        SELECT AVG(score) as score
        FROM nps_surveys
        WHERE created_at::DATE BETWEEN 
            p_start_date - (p_end_date - p_start_date) AND 
            p_start_date - INTERVAL '1 day'
    )
    SELECT (c.score - p.score) INTO v_nps_change
    FROM current_nps c, previous_nps p;
    
    -- Insert or update iteration metrics
    INSERT INTO iteration_metrics (
        iteration_number,
        start_date,
        end_date,
        issues_opened,
        issues_resolved,
        bugs_fixed,
        features_added,
        performance_improvements,
        ml_models_retrained,
        docs_updated,
        avg_resolution_time_hours,
        user_satisfaction_change,
        created_at
    )
    VALUES (
        p_iteration_number,
        p_start_date,
        p_end_date,
        v_issues_opened,
        v_issues_resolved,
        v_bugs_fixed,
        v_features_added,
        v_performance_improvements,
        v_ml_models_retrained,
        v_docs_updated,
        v_avg_resolution_time,
        v_nps_change,
        NOW()
    )
    ON CONFLICT (iteration_number)
    DO UPDATE SET
        issues_opened = EXCLUDED.issues_opened,
        issues_resolved = EXCLUDED.issues_resolved,
        bugs_fixed = EXCLUDED.bugs_fixed,
        features_added = EXCLUDED.features_added,
        performance_improvements = EXCLUDED.performance_improvements,
        ml_models_retrained = EXCLUDED.ml_models_retrained,
        docs_updated = EXCLUDED.docs_updated,
        avg_resolution_time_hours = EXCLUDED.avg_resolution_time_hours,
        user_satisfaction_change = EXCLUDED.user_satisfaction_change;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Insert sample iteration metrics
INSERT INTO iteration_metrics (iteration_number, start_date, end_date)
VALUES (1, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO krishiai_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO krishiai_app;

COMMENT ON TABLE issues IS 'Tracks bugs, features, and improvements identified during pilot';
COMMENT ON TABLE performance_bottlenecks IS 'Tracks performance issues detected by monitoring';
COMMENT ON TABLE ml_retraining_jobs IS 'Tracks ML model retraining jobs based on real-world data';
COMMENT ON TABLE documentation_updates IS 'Tracks documentation gaps and suggested updates';
COMMENT ON TABLE iteration_metrics IS 'Tracks iteration progress and velocity metrics';
