# Quick Push to GitHub Repository
# Target: https://github.com/FireAce1/AIforbharat.git

Write-Host "Pushing KrishiAI to GitHub..." -ForegroundColor Green
Write-Host "Repository: https://github.com/FireAce1/AIforbharat.git" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean up unnecessary docs (optional)
Write-Host "Step 1: Cleanup unnecessary documentation files? (y/n)" -ForegroundColor Yellow
$cleanup = Read-Host
if ($cleanup -eq "y") {
    Write-Host "Running cleanup..." -ForegroundColor Yellow
    .\cleanup-docs.ps1
    Write-Host ""
}

# Step 2: Initialize git if needed
if (-not (Test-Path .git)) {
    Write-Host "Step 2: Initializing git repository..." -ForegroundColor Yellow
    git init
    Write-Host "Git initialized" -ForegroundColor Green
} else {
    Write-Host "Step 2: Git already initialized" -ForegroundColor Green
}
Write-Host ""

# Step 3: Add remote
Write-Host "Step 3: Setting up remote..." -ForegroundColor Yellow
$remotes = git remote
if ($remotes -contains "origin") {
    Write-Host "Removing existing origin..." -ForegroundColor Gray
    git remote remove origin
}
git remote add origin https://github.com/FireAce1/AIforbharat.git
Write-Host "Remote added" -ForegroundColor Green
Write-Host ""

# Step 4: Add all files
Write-Host "Step 4: Adding all files..." -ForegroundColor Yellow
git add .
$fileCount = (git status --short | Measure-Object).Count
Write-Host "Added $fileCount files" -ForegroundColor Green
Write-Host ""

# Step 5: Create commit
Write-Host "Step 5: Creating commit..." -ForegroundColor Yellow
git commit -m "Initial commit: KrishiAI Platform - AI-powered rural development platform for Indian farmers"
Write-Host "Commit created" -ForegroundColor Green
Write-Host ""

# Step 6: Set branch to main
Write-Host "Step 6: Setting branch to main..." -ForegroundColor Yellow
git branch -M main
Write-Host "Branch set to main" -ForegroundColor Green
Write-Host ""

# Step 7: Push to GitHub
Write-Host "Step 7: Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "You may be prompted for credentials" -ForegroundColor Cyan
Write-Host "Use your Personal Access Token as password" -ForegroundColor Cyan
Write-Host ""

try {
    git push -u origin main --force
    
    Write-Host ""
    Write-Host "SUCCESS! Code pushed to GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your repository:" -ForegroundColor Yellow
    Write-Host "https://github.com/FireAce1/AIforbharat" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Visit your repository on GitHub" -ForegroundColor White
    Write-Host "2. Add description and topics" -ForegroundColor White
    Write-Host "3. Deploy to get a working link:" -ForegroundColor White
    Write-Host "   - Vercel: cd infrastructure/production/pilot-launch; vercel" -ForegroundColor Gray
    Write-Host "   - Railway: railway init; railway up" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Happy coding!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "Push failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common solutions:" -ForegroundColor Yellow
    Write-Host "1. Make sure the repository exists on GitHub" -ForegroundColor White
    Write-Host "2. Use Personal Access Token (not password)" -ForegroundColor White
    Write-Host "   Get token: https://github.com/settings/tokens" -ForegroundColor Gray
    Write-Host "3. Check your internet connection" -ForegroundColor White
    Write-Host ""
    Write-Host "Try again? The script is ready to run." -ForegroundColor Yellow
}
