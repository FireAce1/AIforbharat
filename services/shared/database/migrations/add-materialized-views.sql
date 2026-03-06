-- Materialized Views for KrishiAI Platform
-- Purpose: Pre-compute expensive aggregations for analytics and reporting
-- Performance: Reduces query time from seconds to milliseconds

-- ============================================================================
-- 1. Daily Market Price Summary
-- ============================================================================
-- Aggregates market prices by crop and date for fast trend analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_market_prices AS
SELECT 
    DATE(time) as price_date,
    crop_name,
    market_name,
    location,
    AVG(price_per_kg) as avg_price,
    MIN(price_per_kg) as min_price,
    MAX(price_per_kg) as max_price,
    SUM(quantity_traded) as total_quantity,
    COUNT(*) as price_count
FROM market_prices
GROUP BY DATE(time), crop_name, market_name, location
ORDER BY price_date DESC, crop_name;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_mv_daily_prices_date_crop 
ON mv_daily_market_prices(price_date DESC, crop_name);

CREATE INDEX IF NOT EXISTS idx_mv_daily_prices_location 
ON mv_daily_market_prices USING GIST(location);

-- ============================================================================
-- 2. Weekly Weather Summary
-- ============================================================================
-- Aggregates weather data by week for historical analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_weekly_weather AS
SELECT 
    DATE_TRUNC('week', time) as week_start,
    location,
    AVG(temperature) as avg_temperature,
    MIN(temperature) as min_temperature,
    MAX(temperature) as max_temperature,
    SUM(rainfall) as total_rainfall,
    AVG(humidity) as avg_humidity,
    AVG(wind_speed) as avg_wind_speed,
    COUNT(*) as reading_count
FROM weather_forecasts
GROUP BY DATE_TRUNC('week', time), location
ORDER BY week_start DESC;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_mv_weekly_weather_week 
ON mv_weekly_weather(week_start DESC);

CREATE INDEX IF NOT EXISTS idx_mv_weekly_weather_location 
ON mv_weekly_weather USING GIST(location);

-- ============================================================================
-- 3. User Activity Summary
-- ============================================================================
-- Aggregates user activity for engagement metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_activity_summary AS
SELECT 
    u.id as user_id,
    u.phone,
    u.language,
    u.created_at as registration_date,
    COUNT(DISTINCT dd.id) as disease_detections_count,
    COUNT(DISTINCT c.id) as crops_count,
    COUNT(DISTINCT f.id) as farms_count,
    MAX(u.last_active) as last_active_date,
    DATE_PART('day', NOW() - u.last_active) as days_since_active
FROM users u
LEFT JOIN farms f ON f.user_id = u.id
LEFT JOIN crops c ON c.farm_id = f.id
LEFT JOIN disease_detections dd ON dd.crop_id = c.id
GROUP BY u.id, u.phone, u.language, u.created_at
ORDER BY last_active_date DESC;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_mv_user_activity_user 
ON mv_user_activity_summary(user_id);

CREATE INDEX IF NOT EXISTS idx_mv_user_activity_last_active 
ON mv_user_activity_summary(last_active_date DESC);

-- ============================================================================
-- 4. Crop Disease Statistics
-- ============================================================================
-- Aggregates disease detection data for ML model performance tracking
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_disease_statistics AS
SELECT 
    dd.disease_name,
    c.crop_name,
    COUNT(*) as detection_count,
    AVG(dd.confidence) as avg_confidence,
    MIN(dd.confidence) as min_confidence,
    MAX(dd.confidence) as max_confidence,
    COUNT(DISTINCT dd.crop_id) as affected_crops,
    DATE_TRUNC('month', dd.detected_at) as month
FROM disease_detections dd
JOIN crops c ON c.id = dd.crop_id
GROUP BY dd.disease_name, c.crop_name, DATE_TRUNC('month', dd.detected_at)
ORDER BY month DESC, detection_count DESC;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_mv_disease_stats_disease 
ON mv_disease_statistics(disease_name);

CREATE INDEX IF NOT EXISTS idx_mv_disease_stats_month 
ON mv_disease_statistics(month DESC);

-- ============================================================================
-- 5. Government Scheme Engagement
-- ============================================================================
-- Tracks scheme views and subscriptions for popularity analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_scheme_engagement AS
SELECT 
    gs.id as scheme_id,
    gs.scheme_name,
    gs.scheme_type,
    gs.state,
    COUNT(DISTINCT ss.user_id) as subscriber_count,
    gs.application_deadline,
    gs.is_active,
    DATE_PART('day', gs.application_deadline - NOW()) as days_until_deadline
FROM government_schemes gs
LEFT JOIN scheme_subscriptions ss ON ss.scheme_id = gs.id
WHERE gs.is_active = TRUE
GROUP BY gs.id, gs.scheme_name, gs.scheme_type, gs.state, gs.application_deadline, gs.is_active
ORDER BY subscriber_count DESC;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_mv_scheme_engagement_scheme 
ON mv_scheme_engagement(scheme_id);

CREATE INDEX IF NOT EXISTS idx_mv_scheme_engagement_state 
ON mv_scheme_engagement(state);

-- ============================================================================
-- 6. Water Savings Summary
-- ============================================================================
-- Aggregates water savings data for impact reporting
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_water_savings_summary AS
SELECT 
    f.id as farm_id,
    f.user_id,
    f.location,
    f.size_hectares,
    COUNT(ir.id) as recommendation_count,
    SUM(CASE WHEN ir.should_irrigate THEN ir.water_amount_mm ELSE 0 END) as total_water_used_mm,
    SUM(ir.water_saved_mm) as total_water_saved_mm,
    AVG(CASE WHEN ir.should_irrigate THEN ir.water_amount_mm ELSE NULL END) as avg_irrigation_amount,
    DATE_TRUNC('month', ir.recommendation_date) as month
FROM farms f
LEFT JOIN irrigation_recommendations ir ON ir.farm_id = f.id
GROUP BY f.id, f.user_id, f.location, f.size_hectares, DATE_TRUNC('month', ir.recommendation_date)
ORDER BY month DESC, total_water_saved_mm DESC;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_mv_water_savings_farm 
ON mv_water_savings_summary(farm_id);

CREATE INDEX IF NOT EXISTS idx_mv_water_savings_month 
ON mv_water_savings_summary(month DESC);

CREATE INDEX IF NOT EXISTS idx_mv_water_savings_location 
ON mv_water_savings_summary USING GIST(location);

-- ============================================================================
-- Refresh Functions
-- ============================================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_market_prices;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_weather;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_disease_statistics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_scheme_engagement;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_water_savings_summary;
    
    RAISE NOTICE 'All materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to refresh specific materialized view
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name text)
RETURNS void AS $$
BEGIN
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name);
    RAISE NOTICE 'Materialized view % refreshed successfully', view_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Scheduled Refresh (using pg_cron extension if available)
-- ============================================================================

-- Refresh market prices every hour
-- SELECT cron.schedule('refresh-market-prices', '0 * * * *', 
--   'SELECT refresh_materialized_view(''mv_daily_market_prices'')');

-- Refresh weather data every 6 hours
-- SELECT cron.schedule('refresh-weather', '0 */6 * * *', 
--   'SELECT refresh_materialized_view(''mv_weekly_weather'')');

-- Refresh user activity daily at 2 AM
-- SELECT cron.schedule('refresh-user-activity', '0 2 * * *', 
--   'SELECT refresh_materialized_view(''mv_user_activity_summary'')');

-- Refresh disease statistics daily at 3 AM
-- SELECT cron.schedule('refresh-disease-stats', '0 3 * * *', 
--   'SELECT refresh_materialized_view(''mv_disease_statistics'')');

-- Refresh scheme engagement daily at 4 AM
-- SELECT cron.schedule('refresh-scheme-engagement', '0 4 * * *', 
--   'SELECT refresh_materialized_view(''mv_scheme_engagement'')');

-- Refresh water savings daily at 5 AM
-- SELECT cron.schedule('refresh-water-savings', '0 5 * * *', 
--   'SELECT refresh_materialized_view(''mv_water_savings_summary'')');

-- ============================================================================
-- Performance Notes
-- ============================================================================

-- 1. CONCURRENTLY option allows queries to continue during refresh
-- 2. Materialized views require unique indexes for CONCURRENT refresh
-- 3. Refresh frequency should balance freshness vs. performance
-- 4. Monitor view size and refresh duration
-- 5. Consider partitioning for very large views

-- ============================================================================
-- Usage Examples
-- ============================================================================

-- Get daily market prices (fast query on materialized view)
-- SELECT * FROM mv_daily_market_prices 
-- WHERE crop_name = 'Tomato' 
-- AND price_date >= CURRENT_DATE - INTERVAL '30 days'
-- ORDER BY price_date DESC;

-- Get user activity summary
-- SELECT * FROM mv_user_activity_summary 
-- WHERE days_since_active <= 30
-- ORDER BY disease_detections_count DESC
-- LIMIT 100;

-- Get disease statistics for current month
-- SELECT * FROM mv_disease_statistics 
-- WHERE month = DATE_TRUNC('month', NOW())
-- ORDER BY detection_count DESC;

-- Manual refresh example
-- SELECT refresh_all_materialized_views();

-- ============================================================================
-- Rollback Script
-- ============================================================================

-- DROP MATERIALIZED VIEW IF EXISTS mv_daily_market_prices CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS mv_weekly_weather CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS mv_user_activity_summary CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS mv_disease_statistics CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS mv_scheme_engagement CASCADE;
-- DROP MATERIALIZED VIEW IF EXISTS mv_water_savings_summary CASCADE;
-- DROP FUNCTION IF EXISTS refresh_all_materialized_views();
-- DROP FUNCTION IF EXISTS refresh_materialized_view(text);
