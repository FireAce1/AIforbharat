#!/bin/bash

# KrishiAI - Push to GitHub Script
# This script helps you push all code to GitHub

set -e  # Exit on error

echo "🌾 KrishiAI - GitHub Push Script"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git is not installed. Please install git first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Git is installed${NC}"

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo -e "${YELLOW}⚠ Not a git repository. Initializing...${NC}"
    git init
    echo -e "${GREEN}✓ Git repository initialized${NC}"
else
    echo -e "${GREEN}✓ Already a git repository${NC}"
fi

# Check for .gitignore
if [ ! -f .gitignore ]; then
    echo -e "${YELLOW}⚠ Creating .gitignore file...${NC}"
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Python
.venv/
__pycache__/
*.py[cod]
*$py.class
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
EOF
    echo -e "${GREEN}✓ .gitignore created${NC}"
fi

# Get GitHub username
echo ""
echo -e "${YELLOW}Enter your GitHub username:${NC}"
read -r GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo -e "${RED}❌ GitHub username is required${NC}"
    exit 1
fi

# Get repository name
echo -e "${YELLOW}Enter repository name (default: krishiai-platform):${NC}"
read -r REPO_NAME
REPO_NAME=${REPO_NAME:-krishiai-platform}

# Check if remote already exists
if git remote | grep -q "^origin$"; then
    echo -e "${YELLOW}⚠ Remote 'origin' already exists. Removing...${NC}"
    git remote remove origin
fi

# Add remote
REPO_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
git remote add origin "$REPO_URL"
echo -e "${GREEN}✓ Remote added: ${REPO_URL}${NC}"

# Check for large files
echo ""
echo -e "${YELLOW}Checking for large files (>50MB)...${NC}"
LARGE_FILES=$(find . -type f -size +50M 2>/dev/null | grep -v ".git" || true)

if [ -n "$LARGE_FILES" ]; then
    echo -e "${RED}⚠ Found large files:${NC}"
    echo "$LARGE_FILES"
    echo ""
    echo -e "${YELLOW}These files should be added to .gitignore or use Git LFS${NC}"
    echo -e "${YELLOW}Continue anyway? (y/n):${NC}"
    read -r CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        echo "Aborted."
        exit 1
    fi
fi

# Add all files
echo ""
echo -e "${YELLOW}Adding all files to git...${NC}"
git add .

# Show status
echo ""
echo -e "${YELLOW}Files to be committed:${NC}"
git status --short | head -20
FILE_COUNT=$(git status --short | wc -l)
echo "... and $FILE_COUNT more files"

# Create commit
echo ""
echo -e "${YELLOW}Creating commit...${NC}"
git commit -m "Initial commit: KrishiAI MVP Platform

Complete implementation including:
- Microservices (auth, crop, market, climate, govt)
- React Native mobile app with offline support
- ML models (disease detection, crop recommendation, price forecasting)
- Kubernetes deployment configurations
- Monitoring and analytics dashboards
- Pilot launch infrastructure
- Comprehensive documentation

Platform designed for 150M+ Indian farmers with:
- Offline-first architecture
- Voice-first UI (12+ languages)
- Mobile-first design (low-end devices)
- Data-light operation (<5MB/month)
- Freemium model for small farmers"

echo -e "${GREEN}✓ Commit created${NC}"

# Set branch to main
git branch -M main

# Push to GitHub
echo ""
echo -e "${YELLOW}Pushing to GitHub...${NC}"
echo -e "${YELLOW}You may be prompted for your GitHub credentials${NC}"
echo -e "${YELLOW}Use Personal Access Token (PAT) as password if needed${NC}"
echo ""

if git push -u origin main; then
    echo ""
    echo -e "${GREEN}✅ Successfully pushed to GitHub!${NC}"
    echo ""
    echo -e "${GREEN}Your repository is now available at:${NC}"
    echo -e "${GREEN}https://github.com/${GITHUB_USERNAME}/${REPO_NAME}${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Visit your repository on GitHub"
    echo "2. Add a description and topics"
    echo "3. Enable GitHub Actions for CI/CD"
    echo "4. Deploy using Vercel, Railway, or Render"
    echo ""
    echo -e "${GREEN}Happy coding! 🚀${NC}"
else
    echo ""
    echo -e "${RED}❌ Push failed${NC}"
    echo ""
    echo -e "${YELLOW}Common issues:${NC}"
    echo "1. Repository doesn't exist on GitHub - create it first"
    echo "2. Authentication failed - use Personal Access Token"
    echo "3. Large files - add to .gitignore or use Git LFS"
    echo ""
    echo -e "${YELLOW}To create repository on GitHub:${NC}"
    echo "1. Go to https://github.com/new"
    echo "2. Name: ${REPO_NAME}"
    echo "3. Don't initialize with README"
    echo "4. Create repository"
    echo "5. Run this script again"
    exit 1
fi
