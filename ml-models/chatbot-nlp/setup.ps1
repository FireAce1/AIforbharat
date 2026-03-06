# Setup script for Chatbot NLP Model Training
# Windows PowerShell

Write-Host "Setting up Chatbot NLP Model Training Environment..." -ForegroundColor Green

# Check Python version
Write-Host "`nChecking Python version..." -ForegroundColor Yellow
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Python not found. Please install Python 3.8 or higher." -ForegroundColor Red
    exit 1
}
Write-Host "Found: $pythonVersion" -ForegroundColor Green

# Create virtual environment
Write-Host "`nCreating virtual environment..." -ForegroundColor Yellow
if (Test-Path ".venv") {
    Write-Host "Virtual environment already exists." -ForegroundColor Yellow
} else {
    python -m venv .venv
    Write-Host "Virtual environment created." -ForegroundColor Green
}

# Activate virtual environment
Write-Host "`nActivating virtual environment..." -ForegroundColor Yellow
& .\.venv\Scripts\Activate.ps1

# Upgrade pip
Write-Host "`nUpgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

# Create necessary directories
Write-Host "`nCreating directories..." -ForegroundColor Yellow
$directories = @("models", "models/intent_classifier", "models/tokenizer", "logs", "data")
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Write-Host "Created: $dir" -ForegroundColor Green
    }
}

# Generate training data if not exists
Write-Host "`nChecking training data..." -ForegroundColor Yellow
if (-not (Test-Path "data/training_data.json")) {
    Write-Host "Generating training data..." -ForegroundColor Yellow
    python generate_full_dataset.py
} else {
    Write-Host "Training data already exists." -ForegroundColor Green
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Train the model: python train.py" -ForegroundColor White
Write-Host "2. Evaluate: python evaluate.py" -ForegroundColor White
Write-Host "3. Test inference: python inference.py --text 'आज का मौसम कैसा है?'" -ForegroundColor White
Write-Host "`nNote: Training requires GPU for optimal performance." -ForegroundColor Yellow
Write-Host "Expected training time: 30-60 minutes on GPU, 2-4 hours on CPU" -ForegroundColor Yellow
