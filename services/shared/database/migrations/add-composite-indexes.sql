-- ============================================
-- Database Performance Optimization Migration
-- Task 12.2: Add composite indexes for common query patterns
-- ============================================

-- ============================================
-- Users Table Optimizations
-- ============================================

-- Composite index for user lookup with activity tracking
CREATE INDEX IF NOT EXISTS idx_users_phone_active 
ON users(phone, last_active DESC) 
WHERE last_active IS NOT NULL;

-- Index for active users queries
CREATE INDEX IF NOT EXISTS idx_users_last_active 
ON users(last_active DESC NULLS LAST);

-- ============================================
-- Farms Table Optimizations
-- ============================================

-- Composite index for user's farms with location
CREATE INDEX IF NOT EXISTS idx_farms_user_location 
ON farms(user_id, latitude, longitude);

-- Index for farms by soil type (for recommendations)
CREATE INDEX IF NOT EXISTS idx_farms_soil_type 
ON farms(soil_type) 
WHERE soil_type IS NOT NULL;

-- Index for farms by irrigation type
CREATE INDEX IF NOT EXISTS idx_farms_irrigation 
ON farms(irrigation_type) 
WHERE irrigation_type IS NOT NULL;

-- Composite index for geospatial + user queries
CREATE INDEX IF NOT EXISTS idx_farms_user_created 
ON farms(user_id, created_at DESC);

-- ============================================
-- Crops Table Optimizations
-- ============================================

-- Composite index for farm's active crops
CREATE INDEX IF NOT EXISTS idx_crops_farm_status 
ON crops(farm_id, status) 
WHERE status IS NOT NULL;

-- Index for crops by sowing date (for calendar queries)
CREATE INDEX IF NOT EXISTS idx_crops_sowing_date 
ON crops(sowing_date DESC NULLS LAST);

-- Index for crops by harvest date (for harvest planning)
CREATE INDEX IF NOT EXISTS idx_crops_harvest_date 
ON crops(expected_harvest ASC NULLS LAST);

-- Composite index for crop type queries
CREATE INDEX IF NOT EXISTS idx_crops_name_farm 
ON crops(crop_name, farm_id);

-- ============================================
-- Disease Detections Table Optimizations
-- ============================================

-- Composite index for crop's detection history
CREATE INDEX IF NOT EXISTS idx_disease_crop_time 
ON disease_detections(crop_id, detected_at DESC);

-- Index for disease type analysis
CREATE INDEX IF NOT EXISTS idx_disease_name_time 
ON disease_detections(disease_name, detected_at DESC) 
WHERE disease_name IS NOT NULL;

-- Index for high-confidence detections
CREATE INDEX IF NOT EXISTS idx_disease_confidence 
ON disease_detections(confidence DESC, detected_at DESC) 
WHERE confidence >= 0.90;

-- Composite index for severity tracking
CREATE INDEX IF NOT EXISTS idx_disease_severity_time 
ON disease_detections(severity, detected_at DESC) 
WHERE severity IS NOT NULL;

-- ============================================
-- Market Prices Table Optimizations (TimescaleDB)
-- ============================================

-- Composite index for crop price trends over time
CREATE INDEX IF NOT EXISTS idx_market_crop_market_time 
ON market_prices(crop_name, market_name, time DESC);

-- Index for recent prices (last 30 days)
CREATE INDEX IF NOT EXISTS idx_market_recent_prices 
ON market_prices(time DESC, crop_name) 
WHERE time >= NOW() - INTERVAL '30 days';

-- Composite index for location-based price queries
-- Note: This uses latitude/longitude columns for compatibility
CREATE INDEX IF NOT EXISTS idx_market_location_crop 
ON market_prices(latitude, longitude, crop_name, time DESC);

-- Index for price analysis by source
CREATE INDEX IF NOT EXISTS idx_market_source_time 
ON market_prices(source, time DESC) 
WHERE source IS NOT NULL;

-- ============================================
-- Weather Forecasts Table Optimizations (TimescaleDB)
-- ============================================

-- Composite index for location-based forecast queries
-- Note: Using latitude/longitude for compatibility
CREATE INDEX IF NOT EXISTS idx_weather_location_time 
ON weather_forecasts(latitude, longitude, time ASC);

-- Index for recent forecasts (next 7 days)
CREATE INDEX IF NOT EXISTS idx_weather_upcoming 
ON weather_forecasts(time ASC) 
WHERE time >= NOW() AND time <= NOW() + INTERVAL '7 days';

-- Index for critical weather detection
CREATE INDEX IF NOT EXISTS idx_weather_critical_temp 
ON weather_forecasts(temperature, time ASC) 
WHERE temperature > 45 OR temperature < 5;

-- Index for rainfall analysis
CREATE INDEX IF NOT EXISTS idx_weather_rainfall 
ON weather_forecasts(rainfall DESC, time ASC) 
WHERE rainfall > 0;

-- ============================================
-- OTP Codes Table Optimizations
-- ============================================

-- Composite index for OTP verification
CREATE INDEX IF NOT EXISTS idx_otp_phone_verified_expires 
ON otp_codes(phone, verified, expires_at DESC);

-- Index for cleanup of expired OTPs
CREATE INDEX IF NOT EXISTS idx_otp_expires_verified 
ON otp_codes(expires_at ASC) 
WHERE verified = FALSE;

-- ============================================
-- Government Schemes Table Optimizations
-- ============================================

-- Full-text search index for scheme names
CREATE INDEX IF NOT EXISTS idx_schemes_name_search 
ON government_schemes USING gin(to_tsvector('english', scheme_name));

-- Full-text search index for descriptions
CREATE INDEX IF NOT EXISTS idx_schemes_desc_search 
ON government_schemes USING gin(to_tsvector('english', description));

-- Composite index for active schemes by state
CREATE INDEX IF NOT EXISTS idx_schemes_state_active 
ON government_schemes(state, is_active, application_deadline ASC NULLS LAST);

-- Index for scheme type filtering
CREATE INDEX IF NOT EXISTS idx_schemes_type_active 
ON government_schemes(scheme_type, is_active) 
WHERE is_active = TRUE;

-- Index for upcoming deadlines
CREATE INDEX IF NOT EXISTS idx_schemes_deadline 
ON government_schemes(application_deadline ASC) 
WHERE application_deadline >= CURRENT_DATE AND is_active = TRUE;

-- Composite index for last updated schemes
CREATE INDEX IF NOT EXISTS idx_schemes_updated_active 
ON government_schemes(last_updated DESC, is_active);

-- ============================================
-- Scheme Subscriptions Table Optimizations
-- ============================================

-- Composite index for user's subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_scheme 
ON scheme_subscriptions(user_id, scheme_id, notification_sent);

-- Index for pending notifications
CREATE INDEX IF NOT EXISTS idx_subscriptions_pending 
ON scheme_subscriptions(notification_sent, subscribed_at DESC) 
WHERE notification_sent = FALSE;

-- ============================================
-- Irrigation Recommendations Table Optimizations
-- ============================================

-- Composite index for farm's irrigation history
CREATE INDEX IF NOT EXISTS idx_irrigation_farm_date 
ON irrigation_recommendations(farm_id, recommendation_date DESC);

-- Index for recent recommendations
CREATE INDEX IF NOT EXISTS idx_irrigation_recent 
ON irrigation_recommendations(recommendation_date DESC, should_irrigate);

-- Composite index for crop-specific recommendations
CREATE INDEX IF NOT EXISTS idx_irrigation_crop_date 
ON irrigation_recommendations(crop_id, recommendation_date DESC) 
WHERE crop_id IS NOT NULL;

-- ============================================
-- Water Savings Tracking Table Optimizations
-- ============================================

-- Composite index for farm's savings history
CREATE INDEX IF NOT EXISTS idx_water_savings_farm_period 
ON water_savings_tracking(farm_id, period_start DESC, period_end DESC);

-- Index for recent savings
CREATE INDEX IF NOT EXISTS idx_water_savings_recent 
ON water_savings_tracking(period_end DESC);

-- ============================================
-- Price Alerts Table Optimizations
-- ============================================

-- Composite index for user's active alerts
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_active 
ON price_alerts(user_id, is_active, created_at DESC) 
WHERE is_active = TRUE;

-- Composite index for alert matching
CREATE INDEX IF NOT EXISTS idx_price_alerts_crop_active 
ON price_alerts(crop_name, is_active) 
WHERE is_active = TRUE;

-- ============================================
-- Chatbot Conversations Table Optimizations
-- ============================================

-- Composite index for user's conversation history
CREATE INDEX IF NOT EXISTS idx_chatbot_user_time 
ON chatbot_conversations(user_id, created_at DESC);

-- Index for intent analysis
CREATE INDEX IF NOT EXISTS idx_chatbot_intent_time 
ON chatbot_conversations(intent, created_at DESC) 
WHERE intent IS NOT NULL;

-- Index for low-confidence queries (for improvement)
CREATE INDEX IF NOT EXISTS idx_chatbot_low_confidence 
ON chatbot_conversations(confidence ASC, created_at DESC) 
WHERE confidence < 0.85;

-- ============================================
-- Performance Statistics
-- ============================================

-- Analyze all tables to update statistics for query planner
ANALYZE users;
ANALYZE otp_codes;
ANALYZE farms;
ANALYZE crops;
ANALYZE disease_detections;
ANALYZE market_prices;
ANALYZE weather_forecasts;
ANALYZE government_schemes;
ANALYZE scheme_subscriptions;
ANALYZE irrigation_recommendations;
ANALYZE water_savings_tracking;
ANALYZE price_alerts;
ANALYZE chatbot_conversations;

-- ============================================
-- Index Usage Monitoring Query
-- ============================================

-- Use this query to monitor index usage and identify unused indexes:
-- 
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan ASC, tablename;

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON INDEX idx_users_phone_active IS 'Composite index for active user lookups';
COMMENT ON INDEX idx_farms_user_location IS 'Composite index for user farms with geospatial data';
COMMENT ON INDEX idx_crops_farm_status IS 'Composite index for active crops per farm';
COMMENT ON INDEX idx_disease_crop_time IS 'Composite index for crop disease history';
COMMENT ON INDEX idx_market_crop_market_time IS 'Composite index for price trend analysis';
COMMENT ON INDEX idx_weather_location_time IS 'Composite index for location-based forecasts';
COMMENT ON INDEX idx_schemes_state_active IS 'Composite index for active schemes by state';
COMMENT ON INDEX idx_irrigation_farm_date IS 'Composite index for irrigation history';
