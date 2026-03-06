-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create migrations tracking table
CREATE TABLE IF NOT EXISTS pgmigrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    run_on TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Check if migration already ran
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pgmigrations WHERE name = '1704067200000_initial-schema') THEN
        -- Users table
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            phone VARCHAR(15) UNIQUE NOT NULL,
            name VARCHAR(100),
            language VARCHAR(5) DEFAULT 'hi',
            created_at TIMESTAMP DEFAULT NOW(),
            last_active TIMESTAMP
        );
        CREATE INDEX idx_users_phone ON users(phone);

        -- OTP codes table
        CREATE TABLE otp_codes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            phone VARCHAR(15) NOT NULL,
            code VARCHAR(6) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            verified BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX idx_otp_phone_expires ON otp_codes(phone, expires_at);

        -- Farms table
        CREATE TABLE farms (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            latitude DECIMAL(10,8),
            longitude DECIMAL(11,8),
            size_hectares DECIMAL(10,2),
            soil_type VARCHAR(50),
            irrigation_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX idx_farms_user ON farms(user_id);
        CREATE INDEX idx_farms_location ON farms(latitude, longitude);

        -- Crops table
        CREATE TABLE crops (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
            crop_name VARCHAR(100),
            variety VARCHAR(100),
            sowing_date DATE,
            expected_harvest DATE,
            status VARCHAR(20),
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX idx_crops_farm ON crops(farm_id);

        -- Disease detections table
        CREATE TABLE disease_detections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
            image_url VARCHAR(500),
            disease_name VARCHAR(100),
            confidence DECIMAL(5,4),
            severity VARCHAR(20),
            detected_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX idx_disease_crop ON disease_detections(crop_id);
        CREATE INDEX idx_disease_time ON disease_detections(detected_at);

        -- Market prices table (TimescaleDB hypertable)
        CREATE TABLE market_prices (
            time TIMESTAMPTZ NOT NULL,
            crop_name VARCHAR(100),
            market_name VARCHAR(100),
            latitude DECIMAL(10,8),
            longitude DECIMAL(11,8),
            price_per_kg DECIMAL(10,2),
            quantity_traded DECIMAL(10,2)
        );
        SELECT create_hypertable('market_prices', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '1 week');
        CREATE INDEX idx_market_prices_time_crop ON market_prices(time, crop_name);
        CREATE INDEX idx_market_prices_location ON market_prices(latitude, longitude);
        CREATE INDEX idx_market_prices_trend ON market_prices(crop_name, market_name, time);

        -- Weather forecasts table (TimescaleDB hypertable)
        CREATE TABLE weather_forecasts (
            time TIMESTAMPTZ NOT NULL,
            latitude DECIMAL(10,8),
            longitude DECIMAL(11,8),
            temperature DECIMAL(5,2),
            rainfall DECIMAL(5,2),
            humidity DECIMAL(5,2),
            wind_speed DECIMAL(5,2),
            source VARCHAR(50)
        );
        SELECT create_hypertable('weather_forecasts', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '1 day');
        CREATE INDEX idx_weather_time ON weather_forecasts(time);
        CREATE INDEX idx_weather_location ON weather_forecasts(latitude, longitude);
        CREATE INDEX idx_weather_source_time ON weather_forecasts(source, time);

        -- Data retention policies
        SELECT add_retention_policy('market_prices', INTERVAL '5 years', if_not_exists => TRUE);
        SELECT add_retention_policy('weather_forecasts', INTERVAL '2 years', if_not_exists => TRUE);

        -- Add comments
        COMMENT ON TABLE users IS 'User accounts and profiles';
        COMMENT ON TABLE otp_codes IS 'OTP verification codes with 5-minute expiry';
        COMMENT ON TABLE farms IS 'Farm information with geospatial data';
        COMMENT ON TABLE crops IS 'Crop planting records';
        COMMENT ON TABLE disease_detections IS 'Disease detection history from AI model';
        COMMENT ON TABLE market_prices IS 'Historical market price data (TimescaleDB hypertable)';
        COMMENT ON TABLE weather_forecasts IS 'Weather forecast data (TimescaleDB hypertable)';

        -- Record migration
        INSERT INTO pgmigrations (name) VALUES ('1704067200000_initial-schema');
        
        RAISE NOTICE 'Migration 1704067200000_initial-schema completed successfully';
    ELSE
        RAISE NOTICE 'Migration 1704067200000_initial-schema already applied';
    END IF;
END $$;
