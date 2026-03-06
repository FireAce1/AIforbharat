-- Initialize test database with all required tables

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    name VARCHAR(100),
    language VARCHAR(5) DEFAULT 'hi',
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_expires ON otp_codes(phone, expires_at);

-- Farms table
CREATE TABLE IF NOT EXISTS farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    location GEOGRAPHY(POINT),
    size_hectares DECIMAL(10,2),
    soil_type VARCHAR(50),
    irrigation_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farms_user ON farms(user_id);
CREATE INDEX IF NOT EXISTS idx_farms_location ON farms USING GIST(location);

-- Crops table
CREATE TABLE IF NOT EXISTS crops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
    crop_name VARCHAR(100),
    variety VARCHAR(100),
    sowing_date DATE,
    expected_harvest DATE,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crops_farm ON crops(farm_id);

-- Disease detections table
CREATE TABLE IF NOT EXISTS disease_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_id UUID REFERENCES crops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    image_url VARCHAR(500),
    disease_name VARCHAR(100),
    confidence DECIMAL(5,4),
    severity VARCHAR(20),
    detected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disease_crop ON disease_detections(crop_id);
CREATE INDEX IF NOT EXISTS idx_disease_user ON disease_detections(user_id);

-- Market prices table (TimescaleDB hypertable)
CREATE TABLE IF NOT EXISTS market_prices (
    time TIMESTAMPTZ NOT NULL,
    crop_name VARCHAR(100),
    market_name VARCHAR(100),
    location GEOGRAPHY(POINT),
    price_per_kg DECIMAL(10,2),
    quantity_traded DECIMAL(10,2)
);

-- Convert to hypertable
SELECT create_hypertable('market_prices', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_market_prices_crop ON market_prices(crop_name, time DESC);
CREATE INDEX IF NOT EXISTS idx_market_prices_location ON market_prices USING GIST(location);

-- Weather forecasts table (TimescaleDB hypertable)
CREATE TABLE IF NOT EXISTS weather_forecasts (
    time TIMESTAMPTZ NOT NULL,
    location GEOGRAPHY(POINT),
    temperature DECIMAL(5,2),
    rainfall DECIMAL(5,2),
    humidity DECIMAL(5,2),
    wind_speed DECIMAL(5,2),
    source VARCHAR(50)
);

-- Convert to hypertable
SELECT create_hypertable('weather_forecasts', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_weather_location ON weather_forecasts USING GIST(location);

-- Government schemes table
CREATE TABLE IF NOT EXISTS government_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_name VARCHAR(200) NOT NULL,
    scheme_name_hi VARCHAR(200),
    scheme_name_mr VARCHAR(200),
    description TEXT,
    description_hi TEXT,
    description_mr TEXT,
    benefits_amount DECIMAL(12,2),
    benefits_description TEXT,
    eligibility_criteria JSONB,
    required_documents JSONB,
    application_deadline DATE,
    application_link VARCHAR(500),
    scheme_type VARCHAR(50),
    state VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schemes_type ON government_schemes(scheme_type);
CREATE INDEX IF NOT EXISTS idx_schemes_state ON government_schemes(state);
CREATE INDEX IF NOT EXISTS idx_schemes_active ON government_schemes(is_active);

-- Insert test data
INSERT INTO users (phone, name, language) VALUES 
    ('+919876543210', 'Test Farmer', 'hi'),
    ('+919876543211', 'Test Farmer 2', 'mr')
ON CONFLICT (phone) DO NOTHING;

-- Insert test market prices
INSERT INTO market_prices (time, crop_name, market_name, location, price_per_kg, quantity_traded) VALUES
    (NOW() - INTERVAL '1 day', 'Tomato', 'Mumbai Mandi', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 25.50, 1000),
    (NOW() - INTERVAL '1 day', 'Onion', 'Mumbai Mandi', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 30.00, 800),
    (NOW(), 'Tomato', 'Mumbai Mandi', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 26.00, 1100),
    (NOW(), 'Onion', 'Mumbai Mandi', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 31.50, 850)
ON CONFLICT DO NOTHING;

-- Insert test weather forecasts
INSERT INTO weather_forecasts (time, location, temperature, rainfall, humidity, wind_speed, source) VALUES
    (NOW() + INTERVAL '1 day', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 32.5, 0, 65, 15, 'IMD'),
    (NOW() + INTERVAL '2 days', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 33.0, 5, 70, 12, 'IMD'),
    (NOW() + INTERVAL '3 days', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 31.5, 10, 75, 18, 'IMD')
ON CONFLICT DO NOTHING;

-- Insert test government schemes
INSERT INTO government_schemes (
    scheme_name, scheme_name_hi, scheme_name_mr, 
    description, benefits_amount, eligibility_criteria, 
    required_documents, application_deadline, scheme_type, state
) VALUES
    (
        'PM-KISAN', 'पीएम-किसान', 'पीएम-किसान',
        'Direct income support to farmers', 6000.00,
        '{"max_land_hectares": 2, "farmer_categories": ["small", "marginal"]}'::jsonb,
        '["Aadhaar", "Land Records", "Bank Account"]'::jsonb,
        NOW() + INTERVAL '30 days', 'subsidy', 'Maharashtra'
    ),
    (
        'PMFBY', 'प्रधानमंत्री फसल बीमा योजना', 'पीएमएफबीवाय',
        'Crop insurance scheme', 50000.00,
        '{"crop_types": ["rice", "wheat", "cotton"]}'::jsonb,
        '["Aadhaar", "Land Records", "Crop Details"]'::jsonb,
        NOW() + INTERVAL '15 days', 'insurance', 'Maharashtra'
    )
ON CONFLICT DO NOTHING;
