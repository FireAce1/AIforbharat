#!/bin/bash
# Setup Monitoring Stack for KrishiAI Platform
# Deploys Prometheus, Grafana, and Alertmanager

set -e

echo "========================================"
echo "KrishiAI Monitoring Stack Setup"
echo "========================================"
echo ""

# Check if Docker is running
echo "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker."
    exit 1
fi
echo "✓ Docker is running"
echo ""

# Create necessary directories
echo "Creating directories..."
mkdir -p alerts
mkdir -p dashboards
mkdir -p grafana/provisioning/datasources
mkdir -p grafana/provisioning/dashboards
echo "✓ Directories created"
echo ""

# Check if krishiai-network exists, create if not
echo "Checking Docker network..."
if ! docker network ls | grep -q krishiai-network; then
    echo "  Creating krishiai-network..."
    docker network create krishiai-network
    echo "✓ Network created"
else
    echo "✓ Network already exists"
fi
echo ""

# Set environment variables
echo "Setting environment variables..."
export SMTP_PASSWORD="your_smtp_password_here"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
echo "✓ Environment variables set (update with real values)"
echo ""

# Start monitoring stack
echo "Starting monitoring stack..."
docker-compose -f docker-compose.monitoring.yml up -d
echo "✓ Monitoring stack started successfully"
echo ""

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Check service health
echo "Checking service health..."

check_service() {
    local name=$1
    local port=$2
    local path=$3
    
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}${path}" | grep -q "200\|302"; then
        echo "  ✓ ${name} is healthy (port ${port})"
    else
        echo "  ✗ ${name} is not responding (port ${port})"
    fi
}

check_service "Prometheus" 9090 "/"
check_service "Grafana" 3000 "/api/health"
check_service "Alertmanager" 9093 "/"
echo ""

# Display access information
echo "========================================"
echo "Monitoring Stack is Ready!"
echo "========================================"
echo ""
echo "Access URLs:"
echo "  Prometheus:    http://localhost:9090"
echo "  Grafana:       http://localhost:3000"
echo "    Username:    admin"
echo "    Password:    krishiai_admin_2024"
echo "  Alertmanager:  http://localhost:9093"
echo ""
echo "Dashboards:"
echo "  - API Performance"
echo "  - ML Model Performance"
echo "  - Business Metrics"
echo "  - Infrastructure"
echo ""
echo "Next Steps:"
echo "  1. Open Grafana at http://localhost:3000"
echo "  2. Navigate to Dashboards > KrishiAI"
echo "  3. Update Alertmanager config with real SMTP and Slack credentials"
echo "  4. Ensure all services expose /metrics endpoints"
echo ""
echo "To stop the monitoring stack:"
echo "  docker-compose -f docker-compose.monitoring.yml down"
echo ""
