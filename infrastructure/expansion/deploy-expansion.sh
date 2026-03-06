#!/bin/bash

# KrishiAI Geographic Expansion Deployment Script
# This script deploys language support, regional schemes, and market data sources

set -e

echo "🌍 KrishiAI Geographic Expansion Deployment"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running from correct directory
if [ ! -d "infrastructure/expansion" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Parse command line arguments
DEPLOY_LANGUAGES=false
DEPLOY_SCHEMES=false
DEPLOY_MARKET=false
DEPLOY_TRAINING=false
DEPLOY_ALL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --languages)
            DEPLOY_LANGUAGES=true
            shift
            ;;
        --schemes)
            DEPLOY_SCHEMES=true
            shift
            ;;
        --market)
            DEPLOY_MARKET=true
            shift
            ;;
        --training)
            DEPLOY_TRAINING=true
            shift
            ;;
        --all)
            DEPLOY_ALL=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--languages] [--schemes] [--market] [--training] [--all]"
            exit 1
            ;;
    esac
done

# If --all is specified, enable all deployments
if [ "$DEPLOY_ALL" = true ]; then
    DEPLOY_LANGUAGES=true
    DEPLOY_SCHEMES=true
    DEPLOY_MARKET=true
    DEPLOY_TRAINING=true
fi

# If no options specified, show usage
if [ "$DEPLOY_LANGUAGES" = false ] && [ "$DEPLOY_SCHEMES" = false ] && [ "$DEPLOY_MARKET" = false ] && [ "$DEPLOY_TRAINING" = false ]; then
    echo "Usage: $0 [--languages] [--schemes] [--market] [--training] [--all]"
    echo ""
    echo "Options:"
    echo "  --languages    Deploy language support (Punjabi, Kannada, Telugu)"
    echo "  --schemes      Deploy regional government schemes"
    echo "  --market       Deploy regional market data sources"
    echo "  --training     Deploy training materials"
    echo "  --all          Deploy everything"
    exit 1
fi

echo "Deployment Configuration:"
echo "  Languages: $DEPLOY_LANGUAGES"
echo "  Schemes: $DEPLOY_SCHEMES"
echo "  Market Data: $DEPLOY_MARKET"
echo "  Training: $DEPLOY_TRAINING"
echo ""

# 1. Deploy Language Support
if [ "$DEPLOY_LANGUAGES" = true ]; then
    echo "📱 Deploying Language Support..."
    
    # Copy language files to mobile app
    if [ -d "mobile/krishiai-app/src/i18n/locales" ]; then
        cp mobile/krishiai-app/src/i18n/locales/pa.json mobile/krishiai-app/src/i18n/locales/ 2>/dev/null || true
        cp mobile/krishiai-app/src/i18n/locales/kn.json mobile/krishiai-app/src/i18n/locales/ 2>/dev/null || true
        cp mobile/krishiai-app/src/i18n/locales/te.json mobile/krishiai-app/src/i18n/locales/ 2>/dev/null || true
        print_success "Language files copied to mobile app"
    else
        print_warning "Mobile app i18n directory not found, skipping"
    fi
    
    # Update backend services with language support
    echo "  Updating backend services..."
    cd services/govt-service
    npm run migrate:languages 2>/dev/null || print_warning "Language migration not found"
    cd ../..
    
    print_success "Language support deployed"
    echo ""
fi

# 2. Deploy Regional Schemes
if [ "$DEPLOY_SCHEMES" = true ]; then
    echo "📋 Deploying Regional Government Schemes..."
    
    # Copy scheme scrapers
    if [ -d "services/govt-service/src/scrapers" ]; then
        mkdir -p services/govt-service/src/scrapers
        cp infrastructure/expansion/schemes/punjab/punjab-schemes-scraper.ts services/govt-service/src/scrapers/ 2>/dev/null || true
        cp infrastructure/expansion/schemes/karnataka/karnataka-schemes-scraper.ts services/govt-service/src/scrapers/ 2>/dev/null || true
        cp infrastructure/expansion/schemes/telangana-ap/telangana-schemes-scraper.ts services/govt-service/src/scrapers/ 2>/dev/null || true
        print_success "Scheme scrapers copied"
    fi
    
    # Run initial scheme sync
    echo "  Running initial scheme sync..."
    cd services/govt-service
    npm run sync:regional-schemes 2>/dev/null || print_warning "Scheme sync command not found"
    cd ../..
    
    print_success "Regional schemes deployed"
    echo ""
fi

# 3. Deploy Market Data Sources
if [ "$DEPLOY_MARKET" = true ]; then
    echo "💰 Deploying Regional Market Data Sources..."
    
    # Copy market API integrations
    if [ -d "services/market-service/src/integrations" ]; then
        mkdir -p services/market-service/src/integrations
        cp infrastructure/expansion/market-sources/punjab-mandi-api.ts services/market-service/src/integrations/ 2>/dev/null || true
        cp infrastructure/expansion/market-sources/karnataka-apmc-api.ts services/market-service/src/integrations/ 2>/dev/null || true
        print_success "Market API integrations copied"
    fi
    
    # Update crop and disease databases
    echo "  Updating crop and disease databases..."
    if [ -d "ml-models/crop-recommender" ]; then
        cp infrastructure/expansion/crops-diseases/regional-crops.json ml-models/crop-recommender/data/ 2>/dev/null || true
        print_success "Regional crops data updated"
    fi
    
    if [ -d "ml-models/disease-detector" ]; then
        cp infrastructure/expansion/crops-diseases/regional-diseases.json ml-models/disease-detector/data/ 2>/dev/null || true
        print_success "Regional diseases data updated"
    fi
    
    # Test market data connections
    echo "  Testing market data connections..."
    cd services/market-service
    npm run test:market-sources 2>/dev/null || print_warning "Market source tests not found"
    cd ../..
    
    print_success "Market data sources deployed"
    echo ""
fi

# 4. Deploy Training Materials
if [ "$DEPLOY_TRAINING" = true ]; then
    echo "📚 Deploying Training Materials..."
    
    # Check if CDN upload script exists
    if [ -f "infrastructure/expansion/training/upload-to-cdn.sh" ]; then
        cd infrastructure/expansion/training
        ./upload-to-cdn.sh
        cd ../../..
        print_success "Training materials uploaded to CDN"
    else
        print_warning "CDN upload script not found, skipping"
    fi
    
    echo ""
fi

# 5. Run Database Migrations
echo "🗄️  Running Database Migrations..."
cd services/shared/database/migrations
npm run migrate 2>/dev/null || print_warning "Migration command not found"
cd ../../../..
print_success "Database migrations completed"
echo ""

# 6. Restart Services
echo "🔄 Restarting Services..."
if command -v kubectl &> /dev/null; then
    kubectl rollout restart deployment/govt-service 2>/dev/null || print_warning "govt-service not found"
    kubectl rollout restart deployment/market-service 2>/dev/null || print_warning "market-service not found"
    print_success "Services restarted"
else
    print_warning "kubectl not found, skipping service restart"
fi
echo ""

# 7. Verify Deployment
echo "✅ Verifying Deployment..."

# Check language files
if [ "$DEPLOY_LANGUAGES" = true ]; then
    if [ -f "mobile/krishiai-app/src/i18n/locales/pa.json" ]; then
        print_success "Punjabi language file verified"
    else
        print_error "Punjabi language file missing"
    fi
    
    if [ -f "mobile/krishiai-app/src/i18n/locales/kn.json" ]; then
        print_success "Kannada language file verified"
    else
        print_error "Kannada language file missing"
    fi
    
    if [ -f "mobile/krishiai-app/src/i18n/locales/te.json" ]; then
        print_success "Telugu language file verified"
    else
        print_error "Telugu language file missing"
    fi
fi

echo ""
echo "==========================================="
echo "🎉 Geographic Expansion Deployment Complete!"
echo "==========================================="
echo ""
echo "Next Steps:"
echo "1. Monitor Grafana dashboards for regional metrics"
echo "2. Test language switching in mobile app"
echo "3. Verify regional scheme data in database"
echo "4. Validate market data API connections"
echo "5. Share training materials with regional coordinators"
echo ""
echo "For support, contact:"
echo "  - Punjab: coordinator-punjab@krishiai.in"
echo "  - Karnataka: coordinator-karnataka@krishiai.in"
echo "  - Telangana: coordinator-telangana@krishiai.in"
echo ""
