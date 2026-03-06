# Setup script for Crop Recommender training environment (Windows)

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Crop Recommender Setup" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Check Python version
Write-Host "Checking Python version..." -ForegroundColor Yellow
python --version

# Create virtual environment
if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

# Create directories
Write-Host "Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path data, models, logs | Out-Null

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To activate the environment, run:" -ForegroundColor Cyan
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host ""
Write-Host "To train the model, run:" -ForegroundColor Cyan
Write-Host "  python train.py" -ForegroundColor White
Write-Host ""
Write-Host "To evaluate the model, run:" -ForegroundColor Cyan
Write-Host "  python evaluate.py" -ForegroundColor White
