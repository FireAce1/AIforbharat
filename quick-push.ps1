# Quick Push Script - No prompts, just push!

Write-Host "Pushing to GitHub..." -ForegroundColor Green

# Initialize if needed
if (-not (Test-Path .git)) {
    git init
}

# Setup remote
git remote remove origin 2>$null
git remote add origin https://github.com/FireAce1/AIforbharat.git

# Add, commit, push
git add .
git commit -m "KrishiAI Platform - AI-powered rural development for Indian farmers"
git branch -M main
git push -u origin main --force

Write-Host ""
Write-Host "Done! Check: https://github.com/FireAce1/AIforbharat" -ForegroundColor Green
