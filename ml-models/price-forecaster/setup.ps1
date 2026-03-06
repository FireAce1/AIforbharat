# Price Forecaster Model - Setup Script (PowerShell)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Price Forecaster Model - Setup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Create directories
Write-Host "`nCreating directories..." -ForegroundColor Yellow
$directories = @("models", "logs", "data")
foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Write-Host "✓ Created directory: $dir/" -ForegroundColor Green
    } else {
        Write-Host "✓ Directory already exists: $dir/" -ForegroundColor Green
    }
}

# Check Python installation
Write-Host "`nChecking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
try {
    python -m pip install -r requirements.txt
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Create .env file
Write-Host "`nCreating .env file..." -ForegroundColor Yellow
if (!(Test-Path ".env")) {
    @"
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=krishiai_db
DB_USER=krishiai_user
DB_PASSWORD=your_password_here
"@ | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✓ Created .env file (please update with your credentials)" -ForegroundColor Green
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "Setup completed successfully!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Update .env file with your database credentials"
Write-Host "2. Ensure PostgreSQL is running with market_prices data"
Write-Host "3. Run: python train.py --crop tomato --market pune"
Write-Host "============================================================" -ForegroundColor Cyan
