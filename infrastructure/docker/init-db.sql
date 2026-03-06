-- KrishiAI Database Initialization Script

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Note: PostGIS is not available in this TimescaleDB image
-- We'll use latitude/longitude columns instead of geography type

-- Create initial database schema
CREATE SCHEMA IF NOT EXISTS krishiai;

-- Set search path
SET search_path TO krishiai, public;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    name VARCHAR(100),
    language VARCHAR(5) DEFAULT 'hi',
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Create OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_expires ON otp_codes(phone, expires_at);

-- Create farms table
CREATE TABLE IF NOT EXISTS farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    size_hectares DECIMAL(10,2),
    soil_type VARCHAR(50),
    irrigation_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farms_user ON farms(user_id);
CREATE INDEX IF NOT EXISTS idx_farms_location ON farms(latitude, longitude);

-- Create crops table
CREATE TABLE IF NOT EXISTS crops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farms(id),
    crop_name VARCHAR(100),
    variety VARCHAR(100),
    sowing_date DATE,
    expected_harvest DATE,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crops_farm ON crops(farm_id);

-- Create disease detections table
CREATE TABLE IF NOT EXISTS disease_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_id UUID REFERENCES crops(id),
    image_url VARCHAR(500),
    disease_name VARCHAR(100),
    confidence DECIMAL(5,4),
    severity VARCHAR(20),
    detected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disease_crop ON disease_detections(crop_id);

-- Create market prices table (TimescaleDB hypertable)
CREATE TABLE IF NOT EXISTS market_prices (
    time TIMESTAMPTZ NOT NULL,
    crop_name VARCHAR(100),
    market_name VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    price_per_kg DECIMAL(10,2),
    quantity_traded DECIMAL(10,2)
);

-- Convert to hypertable
SELECT create_hypertable('market_prices', 'time', if_not_exists => TRUE);

-- Create weather forecasts table (TimescaleDB hypertable)
CREATE TABLE IF NOT EXISTS weather_forecasts (
    time TIMESTAMPTZ NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    temperature DECIMAL(5,2),
    rainfall DECIMAL(5,2),
    humidity DECIMAL(5,2),
    wind_speed DECIMAL(5,2),
    source VARCHAR(50)
);

-- Convert to hypertable
SELECT create_hypertable('weather_forecasts', 'time', if_not_exists => TRUE);

-- Create data retention policies
SELECT add_retention_policy('market_prices', INTERVAL '5 years', if_not_exists => TRUE);
SELECT add_retention_policy('weather_forecasts', INTERVAL '2 years', if_not_exists => TRUE);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'KrishiAI database initialized successfully!';
END $$;
