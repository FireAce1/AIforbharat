# Setup CI/CD Pipeline for KrishiAI (PowerShell)
# This script configures GitHub repository secrets and validates the CI/CD setup

$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up CI/CD Pipeline for KrishiAI" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Check if gh CLI is installed
try {
    $null = Get-Command gh -ErrorAction Stop
    Write-Host "✅ GitHub CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ GitHub CLI (gh) is not installed" -ForegroundColor Red
    Write-Host "Install it from: https://cli.github.com/" -ForegroundColor Yellow
    exit 1
}

# Check if user is authenticated
try {
    gh auth status 2>$null
    Write-Host "✅ Authenticated with GitHub CLI" -ForegroundColor Green
} catch {
    Write-Host "❌ Not authenticated with GitHub CLI" -ForegroundColor Red
    Write-Host "Run: gh auth login" -ForegroundColor Yellow
    exit 1
}

# Get repository information
$repo = gh repo view --json nameWithOwner -q .nameWithOwner
Write-Host "📦 Repository: $repo" -ForegroundColor Green

# Function to set secret
function Set-GitHubSecret {
    param(
        [string]$SecretName,
        [string]$SecretDescription,
        [string]$SecretValue
    )
    
    if ([string]::IsNullOrWhiteSpace($SecretValue)) {
        Write-Host "⏭️  Skipping $SecretName (no value provided)" -ForegroundColor Yellow
        return
    }
    
    Write-Host "🔐 Setting secret: $SecretName" -ForegroundColor Green
    $SecretValue | gh secret set $SecretName
}

# Function to prompt for secret
function Get-SecretValue {
    param(
        [string]$SecretName,
        [string]$SecretDescription,
        [bool]$IsRequired = $false
    )
    
    Write-Host ""
    Write-Host $SecretDescription -ForegroundColor Yellow
    $secureValue = Read-Host "Enter value for $SecretName (or press Enter to skip)" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    $secretValue = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    
    if ([string]::IsNullOrWhiteSpace($secretValue) -and $IsRequired) {
        Write-Host "❌ $SecretName is required" -ForegroundColor Red
        exit 1
    }
    
    if (-not [string]::IsNullOrWhiteSpace($secretValue)) {
        Set-GitHubSecret -SecretName $SecretName -SecretDescription $SecretDescription -SecretValue $secretValue
    }
}

Write-Host ""
Write-Host "📝 Configuring Secrets" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan

# Staging secrets
Write-Host ""
Write-Host "🔧 Staging Environment Secrets" -ForegroundColor Green
Get-SecretValue -SecretName "KUBE_CONFIG_STAGING" -SecretDescription "Kubernetes config for staging cluster (base64 encoded)"
Get-SecretValue -SecretName "STAGING_DATABASE_URL" -SecretDescription "PostgreSQL connection string for staging"
Get-SecretValue -SecretName "STAGING_REDIS_URL" -SecretDescription "Redis connection string for staging"
Get-SecretValue -SecretName "STAGING_JWT_SECRET" -SecretDescription "JWT signing secret for staging"
Get-SecretValue -SecretName "STAGING_SMS_API_KEY" -SecretDescription "SMS gateway API key for staging"
Get-SecretValue -SecretName "STAGING_IMD_API_KEY" -SecretDescription "IMD weather API key for staging"
Get-SecretValue -SecretName "STAGING_SENTRY_DSN" -SecretDescription "Sentry DSN for staging"

# Production secrets
Write-Host ""
Write-Host "🔧 Production Environment Secrets" -ForegroundColor Green
Get-SecretValue -SecretName "KUBE_CONFIG_PRODUCTION" -SecretDescription "Kubernetes config for production cluster (base64 encoded)"
Get-SecretValue -SecretName "PRODUCTION_DATABASE_URL" -SecretDescription "PostgreSQL connection string for production"
Get-SecretValue -SecretName "PRODUCTION_REDIS_URL" -SecretDescription "Redis connection string for production"
Get-SecretValue -SecretName "PRODUCTION_JWT_SECRET" -SecretDescription "JWT signing secret for production"
Get-SecretValue -SecretName "PRODUCTION_SMS_API_KEY" -SecretDescription "SMS gateway API key for production"
Get-SecretValue -SecretName "PRODUCTION_IMD_API_KEY" -SecretDescription "IMD weather API key for production"
Get-SecretValue -SecretName "PRODUCTION_SENTRY_DSN" -SecretDescription "Sentry DSN for production"

# Notification secrets
Write-Host ""
Write-Host "🔧 Notification Secrets" -ForegroundColor Green
Get-SecretValue -SecretName "SLACK_WEBHOOK_URL" -SecretDescription "Slack webhook URL for deployment notifications"
Get-SecretValue -SecretName "EMAIL_USERNAME" -SecretDescription "SMTP username for email notifications"
Get-SecretValue -SecretName "EMAIL_PASSWORD" -SecretDescription "SMTP password for email notifications"
Get-SecretValue -SecretName "ALERT_EMAIL" -SecretDescription "Email address for critical alerts"

Write-Host ""
Write-Host "✅ Secret configuration complete!" -ForegroundColor Green

# Validate workflows
Write-Host ""
Write-Host "🔍 Validating Workflows" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan

if (Test-Path ".github/workflows/ci.yml") {
    Write-Host "✅ CI workflow found" -ForegroundColor Green
} else {
    Write-Host "❌ CI workflow not found" -ForegroundColor Red
}

if (Test-Path ".github/workflows/deploy-staging.yml") {
    Write-Host "✅ Staging deployment workflow found" -ForegroundColor Green
} else {
    Write-Host "❌ Staging deployment workflow not found" -ForegroundColor Red
}

if (Test-Path ".github/workflows/deploy-production.yml") {
    Write-Host "✅ Production deployment workflow found" -ForegroundColor Green
} else {
    Write-Host "❌ Production deployment workflow not found" -ForegroundColor Red
}

# Create GitHub environments
Write-Host ""
Write-Host "🌍 Creating GitHub Environments" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

Write-Host "Creating staging environment..."
try {
    gh api "repos/$repo/environments/staging" -X PUT -f 'deployment_branch_policy={"protected_branches":false,"custom_branch_policies":true}' 2>$null
} catch {
    Write-Host "Staging environment already exists or created" -ForegroundColor Yellow
}

Write-Host "Creating production-10-percent environment..."
try {
    gh api "repos/$repo/environments/production-10-percent" -X PUT 2>$null
} catch {
    Write-Host "Production-10-percent environment already exists or created" -ForegroundColor Yellow
}

Write-Host "Creating production-50-percent environment..."
try {
    gh api "repos/$repo/environments/production-50-percent" -X PUT 2>$null
} catch {
    Write-Host "Production-50-percent environment already exists or created" -ForegroundColor Yellow
}

Write-Host "Creating production environment..."
try {
    gh api "repos/$repo/environments/production" -X PUT -f 'deployment_branch_policy={"protected_branches":true,"custom_branch_policies":false}' 2>$null
} catch {
    Write-Host "Production environment already exists or created" -ForegroundColor Yellow
}

Write-Host "✅ Environments created" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "📊 Setup Summary" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan
Write-Host "✅ CI/CD pipeline configured successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review and update secrets in GitHub repository settings"
Write-Host "2. Configure branch protection rules for main and develop branches"
Write-Host "3. Set up required reviewers for production deployments"
Write-Host "4. Test CI pipeline by pushing to a feature branch"
Write-Host "5. Test staging deployment by pushing to develop branch"
Write-Host "6. Test production deployment by pushing to main branch"
Write-Host ""
Write-Host "Documentation: .github/workflows/README.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
