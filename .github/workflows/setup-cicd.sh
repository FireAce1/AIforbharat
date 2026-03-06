#!/bin/bash

# Setup CI/CD Pipeline for KrishiAI
# This script configures GitHub repository secrets and validates the CI/CD setup

set -e

echo "🚀 Setting up CI/CD Pipeline for KrishiAI"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with GitHub CLI${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo -e "${GREEN}✅ GitHub CLI is installed and authenticated${NC}"

# Get repository information
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo -e "${GREEN}📦 Repository: $REPO${NC}"

# Function to set secret
set_secret() {
    local secret_name=$1
    local secret_description=$2
    local secret_value=$3
    
    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}⏭️  Skipping $secret_name (no value provided)${NC}"
        return
    fi
    
    echo -e "${GREEN}🔐 Setting secret: $secret_name${NC}"
    echo "$secret_value" | gh secret set "$secret_name"
}

# Function to prompt for secret
prompt_secret() {
    local secret_name=$1
    local secret_description=$2
    local is_required=$3
    
    echo ""
    echo -e "${YELLOW}$secret_description${NC}"
    read -sp "Enter value for $secret_name (or press Enter to skip): " secret_value
    echo ""
    
    if [ -z "$secret_value" ] && [ "$is_required" = "true" ]; then
        echo -e "${RED}❌ $secret_name is required${NC}"
        exit 1
    fi
    
    if [ -n "$secret_value" ]; then
        set_secret "$secret_name" "$secret_description" "$secret_value"
    fi
}

echo ""
echo "📝 Configuring Secrets"
echo "====================="

# Staging secrets
echo ""
echo -e "${GREEN}🔧 Staging Environment Secrets${NC}"
prompt_secret "KUBE_CONFIG_STAGING" "Kubernetes config for staging cluster (base64 encoded)" "false"
prompt_secret "STAGING_DATABASE_URL" "PostgreSQL connection string for staging" "false"
prompt_secret "STAGING_REDIS_URL" "Redis connection string for staging" "false"
prompt_secret "STAGING_JWT_SECRET" "JWT signing secret for staging" "false"
prompt_secret "STAGING_SMS_API_KEY" "SMS gateway API key for staging" "false"
prompt_secret "STAGING_IMD_API_KEY" "IMD weather API key for staging" "false"
prompt_secret "STAGING_SENTRY_DSN" "Sentry DSN for staging" "false"

# Production secrets
echo ""
echo -e "${GREEN}🔧 Production Environment Secrets${NC}"
prompt_secret "KUBE_CONFIG_PRODUCTION" "Kubernetes config for production cluster (base64 encoded)" "false"
prompt_secret "PRODUCTION_DATABASE_URL" "PostgreSQL connection string for production" "false"
prompt_secret "PRODUCTION_REDIS_URL" "Redis connection string for production" "false"
prompt_secret "PRODUCTION_JWT_SECRET" "JWT signing secret for production" "false"
prompt_secret "PRODUCTION_SMS_API_KEY" "SMS gateway API key for production" "false"
prompt_secret "PRODUCTION_IMD_API_KEY" "IMD weather API key for production" "false"
prompt_secret "PRODUCTION_SENTRY_DSN" "Sentry DSN for production" "false"

# Notification secrets
echo ""
echo -e "${GREEN}🔧 Notification Secrets${NC}"
prompt_secret "SLACK_WEBHOOK_URL" "Slack webhook URL for deployment notifications" "false"
prompt_secret "EMAIL_USERNAME" "SMTP username for email notifications" "false"
prompt_secret "EMAIL_PASSWORD" "SMTP password for email notifications" "false"
prompt_secret "ALERT_EMAIL" "Email address for critical alerts" "false"

echo ""
echo "✅ Secret configuration complete!"

# Validate workflows
echo ""
echo "🔍 Validating Workflows"
echo "======================="

if [ -f ".github/workflows/ci.yml" ]; then
    echo -e "${GREEN}✅ CI workflow found${NC}"
else
    echo -e "${RED}❌ CI workflow not found${NC}"
fi

if [ -f ".github/workflows/deploy-staging.yml" ]; then
    echo -e "${GREEN}✅ Staging deployment workflow found${NC}"
else
    echo -e "${RED}❌ Staging deployment workflow not found${NC}"
fi

if [ -f ".github/workflows/deploy-production.yml" ]; then
    echo -e "${GREEN}✅ Production deployment workflow found${NC}"
else
    echo -e "${RED}❌ Production deployment workflow not found${NC}"
fi

# Create GitHub environments
echo ""
echo "🌍 Creating GitHub Environments"
echo "==============================="

echo "Creating staging environment..."
gh api repos/$REPO/environments/staging -X PUT -f deployment_branch_policy='{"protected_branches":false,"custom_branch_policies":true}' 2>/dev/null || echo "Staging environment already exists"

echo "Creating production-10-percent environment..."
gh api repos/$REPO/environments/production-10-percent -X PUT 2>/dev/null || echo "Production-10-percent environment already exists"

echo "Creating production-50-percent environment..."
gh api repos/$REPO/environments/production-50-percent -X PUT 2>/dev/null || echo "Production-50-percent environment already exists"

echo "Creating production environment..."
gh api repos/$REPO/environments/production -X PUT -f deployment_branch_policy='{"protected_branches":true,"custom_branch_policies":false}' 2>/dev/null || echo "Production environment already exists"

echo -e "${GREEN}✅ Environments created${NC}"

# Summary
echo ""
echo "📊 Setup Summary"
echo "================"
echo -e "${GREEN}✅ CI/CD pipeline configured successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Review and update secrets in GitHub repository settings"
echo "2. Configure branch protection rules for main and develop branches"
echo "3. Set up required reviewers for production deployments"
echo "4. Test CI pipeline by pushing to a feature branch"
echo "5. Test staging deployment by pushing to develop branch"
echo "6. Test production deployment by pushing to main branch"
echo ""
echo "Documentation: .github/workflows/README.md"
echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
