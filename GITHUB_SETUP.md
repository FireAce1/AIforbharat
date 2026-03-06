# Push KrishiAI Code to GitHub

## Step-by-Step Guide

### Step 1: Check Git Status

First, let's see what we have:

```bash
git status
```

### Step 2: Initialize Git (if not already done)

```bash
# Check if git is initialized
git rev-parse --git-dir 2>/dev/null

# If not initialized, run:
git init
```

### Step 3: Create GitHub Repository

1. Go to https://github.com
2. Click "New Repository" (+ icon in top right)
3. Name it: `krishiai-platform` or `krishiai-mvp`
4. Description: "AI-powered rural development platform for Indian farmers"
5. Choose: **Public** or **Private**
6. **DO NOT** initialize with README (we already have one)
7. Click "Create repository"

### Step 4: Add All Files to Git

```bash
# Add all files
git add .

# Check what will be committed
git status
```

### Step 5: Create Initial Commit

```bash
git commit -m "Initial commit: KrishiAI MVP platform

- Complete microservices architecture (auth, crop, market, climate, govt)
- React Native mobile app with offline-first support
- ML models (disease detection, crop recommendation, price forecasting)
- Kubernetes deployment configurations
- Monitoring and analytics dashboards
- Pilot launch infrastructure
- Comprehensive documentation"
```

### Step 6: Connect to GitHub

Replace `YOUR_USERNAME` with your GitHub username:

```bash
git remote add origin https://github.com/YOUR_USERNAME/krishiai-platform.git

# Verify remote
git remote -v
```

### Step 7: Push to GitHub

```bash
# Push to main branch
git branch -M main
git push -u origin main
```

If you get authentication errors, you'll need to:
- Use a Personal Access Token (PAT) instead of password
- Or set up SSH keys

### Step 8: Verify on GitHub

Go to your repository URL:
```
https://github.com/YOUR_USERNAME/krishiai-platform
```

You should see all your files!

## Alternative: Use GitHub CLI

If you have GitHub CLI installed:

```bash
# Login to GitHub
gh auth login

# Create repo and push
gh repo create krishiai-platform --public --source=. --remote=origin --push
```

## Troubleshooting

### Large Files Error

If you get errors about large files:

```bash
# Check file sizes
find . -type f -size +50M

# Add large files to .gitignore
echo "*.tflite" >> .gitignore
echo "node_modules/" >> .gitignore
echo ".venv/" >> .gitignore
```

### Authentication Failed

Use Personal Access Token:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo`, `workflow`
4. Copy the token
5. Use it as password when pushing

Or set up credential helper:

```bash
git config --global credential.helper store
```

### Already Exists Error

If remote already exists:

```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/krishiai-platform.git
```

## What Gets Pushed

All your code including:
- ✅ Services (auth, crop, market, climate, govt)
- ✅ Mobile app (React Native)
- ✅ ML models
- ✅ Infrastructure configs (Kubernetes, Docker)
- ✅ Documentation
- ✅ Deployment scripts
- ✅ Monitoring dashboards

## What's Ignored (via .gitignore)

- ❌ node_modules/
- ❌ .venv/
- ❌ dist/
- ❌ .env files
- ❌ Large binary files

## Next Steps After Pushing

1. **Add Repository Description** on GitHub
2. **Add Topics**: `agriculture`, `ai`, `react-native`, `nodejs`, `kubernetes`
3. **Enable GitHub Actions** for CI/CD
4. **Add Collaborators** if working in a team
5. **Create README badges** for build status
6. **Set up branch protection** for main branch

## Quick Deploy After Push

Once code is on GitHub, you can deploy to:

### Vercel (Dashboard)
```bash
vercel --prod
```

### Railway (Full Stack)
```bash
railway init
railway up
```

### Render (via GitHub)
1. Go to https://render.com
2. Connect GitHub repo
3. Auto-deploy from main branch

## Repository URL

After pushing, your code will be at:
```
https://github.com/YOUR_USERNAME/krishiai-platform
```

Share this URL for:
- Collaboration
- Deployment
- Documentation
- Portfolio
