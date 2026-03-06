# KrishiAI - Push to GitHub Script (PowerShell)
# This script helps you push all code to GitHub

Write-Host "🌾 KrishiAI - GitHub Push Script" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# Check if git is installed
try {
    $gitVersion = git --version
    Write-Host "✓ Git is installed: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git is not installed. Please install git first." -ForegroundColor Red
    Write-Host "Download from: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Check if we're in a git repository
if (-not (Test-Path .git)) {
    Write-Host "⚠ Not a git repository. Initializing..." -ForegroundColor Yellow
    git init
    Write-Host "✓ Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "✓ Already a git repository" -ForegroundColor Green
}

# Check for .gitignore
if (-not (Test-Path .gitignore)) {
    Write-Host "⚠ Creating .gitignore file..." -ForegroundColor Yellow
    
    $gitignoreContent = @"
# Dependencies
node_modules/
.pnp
.pnp.js

# Python
.venv/
__pycache__/
*.py[cod]
*`$py.class
*.so
.Python
env/
venv/
ENV/

# Build outputs
dist/
build/
*.egg-info/

# Environment variables
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# ML Models (large files)
*.h5
*.pkl
*.joblib
ml-models/*/models/*.tflite
ml-models/*/data/raw/

# Mobile
mobile/krishiai-app/android/app/build/
mobile/krishiai-app/ios/build/
mobile/krishiai-app/.expo/

# Temporary files
*.tmp
*.temp
.cache/
"@
    
    $gitignoreContent | Out-File -FilePath .gitignore -Encoding UTF8
    Write-Host "✓ .gitignore created" -ForegroundColor Green
}

# Get GitHub username
Write-Host ""
Write-Host "Enter your GitHub username:" -ForegroundColor Yellow
$GITHUB_USERNAME = Read-Host

if ([string]::IsNullOrWhiteSpace($GITHUB_USERNAME)) {
    Write-Host "❌ GitHub username is required" -ForegroundColor Red
    exit 1
}

# Get repository name
Write-Host "Enter repository name (default: krishiai-platform):" -ForegroundColor Yellow
$REPO_NAME = Read-Host
if ([string]::IsNullOrWhiteSpace($REPO_NAME)) {
    $REPO_NAME = "krishiai-platform"
}

# Check if remote already exists
$remotes = git remote
if ($remotes -contains "origin") {
    Write-Host "⚠ Remote 'origin' already exists. Removing..." -ForegroundColor Yellow
    git remote remove origin
}

# Add remote
$REPO_URL = "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
git remote add origin $REPO_URL
Write-Host "✓ Remote added: $REPO_URL" -ForegroundColor Green

# Check for large files
Write-Host ""
Write-Host "Checking for large files (>50MB)..." -ForegroundColor Yellow
$largeFiles = Get-ChildItem -Recurse -File | Where-Object { 
    $_.Length -gt 50MB -and $_.FullName -notlike "*\.git\*" 
} | Select-Object -First 10

if ($largeFiles) {
    Write-Host "⚠ Found large files:" -ForegroundColor Red
    $largeFiles | ForEach-Object { 
        Write-Host "  $($_.FullName) - $([math]::Round($_.Length/1MB, 2)) MB" 
    }
    Write-Host ""
    Write-Host "These files should be added to .gitignore or use Git LFS" -ForegroundColor Yellow
    Write-Host "Continue anyway? (y/n):" -ForegroundColor Yellow
    $continue = Read-Host
    if ($continue -ne "y") {
        Write-Host "Aborted."
        exit 1
    }
}

# Add all files
Write-Host ""
Write-Host "Adding all files to git..." -ForegroundColor Yellow
git add .

# Show status
Write-Host ""
Write-Host "Files to be committed:" -ForegroundColor Yellow
$status = git status --short
$fileCount = ($status | Measure-Object).Count
$status | Select-Object -First 20 | ForEach-Object { Write-Host $_ }
if ($fileCount -gt 20) {
    Write-Host "... and $($fileCount - 20) more files"
}

# Create commit
Write-Host ""
Write-Host "Creating commit..." -ForegroundColor Yellow
git commit -m "Initial commit: KrishiAI MVP Platform - Complete implementation for 150M+ Indian farmers"
Write-Host "✓ Commit created" -ForegroundColor Green

# Set branch to main
git branch -M main

# Push to GitHub
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "You may be prompted for your GitHub credentials" -ForegroundColor Yellow
Write-Host "Use Personal Access Token (PAT) as password if needed" -ForegroundColor Yellow
Write-Host ""

try {
    git push -u origin main
    
    Write-Host ""
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your repository is now available at:" -ForegroundColor Green
    Write-Host "https://github.com/$GITHUB_USERNAME/$REPO_NAME" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Visit your repository on GitHub"
    Write-Host "2. Add a description and topics"
    Write-Host "3. Enable GitHub Actions for CI/CD"
    Write-Host "4. Deploy using Vercel, Railway, or Render"
    Write-Host ""
    Write-Host "Happy coding! 🚀" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ Push failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "1. Repository doesn't exist on GitHub - create it first"
    Write-Host "2. Authentication failed - use Personal Access Token"
    Write-Host "3. Large files - add to .gitignore or use Git LFS"
    Write-Host ""
    Write-Host "To create repository on GitHub:" -ForegroundColor Yellow
    Write-Host "1. Go to https://github.com/new"
    Write-Host "2. Name: $REPO_NAME"
    Write-Host "3. Don't initialize with README"
    Write-Host "4. Create repository"
    Write-Host "5. Run this script again"
    Write-Host ""
    Write-Host "Error details: $_" -ForegroundColor Red
    exit 1
}
