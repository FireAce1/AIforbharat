#!/bin/bash

set -e

echo "🌾 KrishiAI Platform - Development Environment Setup"
echo "===================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo "📦 Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18+ required. Current version: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v) detected${NC}"

# Check if Docker is installed
echo ""
echo "🐳 Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker $(docker --version) detected${NC}"

# Check if Docker Compose is installed
echo ""
echo "🐳 Checking Docker Compose installation..."
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose $(docker-compose --version) detected${NC}"

# Check if Python is installed
echo ""
echo "🐍 Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}⚠️  Python 3 is not installed. ML services will require Python 3.9+${NC}"
else
    echo -e "${GREEN}✅ Python $(python3 --version) detected${NC}"
fi

# Create directory structure
echo ""
echo "📁 Creating directory structure..."
mkdir -p services/auth-service
mkdir -p services/crop-service
mkdir -p services/market-service
mkdir -p services/climate-service
mkdir -p services/govt-service
mkdir -p mobile/krishiai-app
mkdir -p ml-models/crop-recommender
mkdir -p ml-models/disease-detector
mkdir -p ml-models/price-forecaster
mkdir -p ml-models/chatbot-nlp
mkdir -p infrastructure/k8s
mkdir -p infrastructure/terraform
mkdir -p infrastructure/docker
mkdir -p data-pipelines/ingestion
mkdir -p data-pipelines/processing
mkdir -p data-pipelines/training
mkdir -p docs/api
mkdir -p docs/architecture
mkdir -p docs/guides
echo -e "${GREEN}✅ Directory structure created${NC}"

# Create placeholder README files
echo ""
echo "📝 Creating placeholder README files..."
cat > services/README.md << 'EOF'
# KrishiAI Services

This directory contains all backend microservices for the KrishiAI platform.

## Services

- **auth-service**: User authentication and authorization (Node.js + Express)
- **crop-service**: Crop recommendations and disease detection (Python + FastAPI)
- **market-service**: Market price intelligence and forecasting (Node.js + Express)
- **climate-service**: Weather forecasts and water advisory (Node.js + Express)
- **govt-service**: Government schemes and chatbot (Node.js + Express)

## Development

Each service is independently deployable and has its own package.json/requirements.txt.

```bash
# Run all services in development mode
npm run dev

# Run specific service
cd services/auth-service && npm run dev
```
EOF

cat > mobile/README.md << 'EOF'
# KrishiAI Mobile App

React Native mobile application for Android devices.

## Features

- Offline-first architecture with WatermelonDB
- On-device AI with TensorFlow Lite
- Voice input/output in Hindi and Marathi
- Optimized for low-end devices (2GB RAM)

## Development

```bash
cd mobile/krishiai-app
npm install
npm run android
```
EOF

cat > ml-models/README.md << 'EOF'
# KrishiAI ML Models

Machine learning models for agricultural intelligence.

## Models

- **crop-recommender**: XGBoost model for crop recommendations
- **disease-detector**: MobileNetV3 for plant disease detection
- **price-forecaster**: ARIMA + LSTM for price forecasting
- **chatbot-nlp**: IndicBERT for multilingual chatbot

## Training

```bash
cd ml-models/crop-recommender
python train.py --epochs 100
```
EOF

cat > infrastructure/README.md << 'EOF'
# KrishiAI Infrastructure

Infrastructure as Code and deployment configurations.

## Contents

- **k8s**: Kubernetes manifests
- **terraform**: Cloud infrastructure provisioning
- **docker**: Dockerfiles and build scripts

## Deployment

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Provision infrastructure
cd terraform && terraform apply
```
EOF

echo -e "${GREEN}✅ README files created${NC}"

# Create database initialization script
echo ""
echo "🗄️  Creating database initialization script..."
mkdir -p infrastructure/docker
cat > infrastructure/docker/init-db.sql << 'EOF'
-- KrishiAI Database Initialization Script

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

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
    location GEOGRAPHY(POINT),
    size_hectares DECIMAL(10,2),
    soil_type VARCHAR(50),
    irrigation_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farms_user ON farms(user_id);
CREATE INDEX IF NOT EXISTS idx_farms_location ON farms USING GIST(location);

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
    location GEOGRAPHY(POINT),
    price_per_kg DECIMAL(10,2),
    quantity_traded DECIMAL(10,2)
);

-- Convert to hypertable
SELECT create_hypertable('market_prices', 'time', if_not_exists => TRUE);

-- Create weather forecasts table (TimescaleDB hypertable)
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

-- Create data retention policies
SELECT add_retention_policy('market_prices', INTERVAL '5 years', if_not_exists => TRUE);
SELECT add_retention_policy('weather_forecasts', INTERVAL '2 years', if_not_exists => TRUE);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'KrishiAI database initialized successfully!';
END $$;
EOF

echo -e "${GREEN}✅ Database initialization script created${NC}"

# Install root dependencies
echo ""
echo "📦 Installing root dependencies..."
npm install
echo -e "${GREEN}✅ Root dependencies installed${NC}"

# Start Docker containers
echo ""
echo "🐳 Starting Docker containers..."
docker-compose up -d

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo ""
echo "🏥 Checking service health..."
if docker-compose ps | grep -q "Up (healthy)"; then
    echo -e "${GREEN}✅ All services are healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Some services may still be starting. Run 'docker-compose ps' to check status.${NC}"
fi

# Display connection information
echo ""
echo "🎉 Setup complete!"
echo ""
echo "📊 Service Connection Information:"
echo "=================================="
echo "PostgreSQL (TimescaleDB):"
echo "  Host: localhost:5432"
echo "  Database: krishiai_db"
echo "  User: krishiai"
echo "  Password: krishiai_dev_password"
echo ""
echo "Redis:"
echo "  Host: localhost:6379"
echo "  Password: krishiai_redis_password"
echo ""
echo "MongoDB:"
echo "  Host: localhost:27017"
echo "  User: krishiai"
echo "  Password: krishiai_mongo_password"
echo ""
echo "RabbitMQ:"
echo "  Host: localhost:5672"
echo "  Management UI: http://localhost:15672"
echo "  User: krishiai"
echo "  Password: krishiai_rabbitmq_password"
echo ""
echo "🚀 Next Steps:"
echo "=============="
echo "1. Initialize individual services:"
echo "   cd services/auth-service && npm init -y"
echo ""
echo "2. Start development:"
echo "   npm run dev"
echo ""
echo "3. View logs:"
echo "   npm run docker:logs"
echo ""
echo "4. Stop services:"
echo "   npm run docker:down"
echo ""
echo -e "${GREEN}Happy coding! 🌾${NC}"
