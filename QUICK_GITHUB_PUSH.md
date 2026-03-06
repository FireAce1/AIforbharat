# Quick GitHub Push Guide

## Option 1: Automated Script (Recommended)

### On Windows (PowerShell):
```powershell
.\push-to-github.ps1
```

### On Mac/Linux (Bash):
```bash
chmod +x push-to-github.sh
./push-to-github.sh
```

The script will:
1. ✅ Initialize git if needed
2. ✅ Create .gitignore
3. ✅ Add all files
4. ✅ Create commit
5. ✅ Push to GitHub

## Option 2: Manual Steps

### 1. Create GitHub Repository
Go to https://github.com/new and create a new repository named `krishiai-platform`

### 2. Run These Commands

```bash
# Initialize git (if not done)
git init

# Add all files
git add .

# Create commit
git commit -m "Initial commit: KrishiAI MVP Platform"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/krishiai-platform.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Option 3: GitHub CLI (Fastest)

If you have GitHub CLI installed:

```bash
# Login
gh auth login

# Create repo and push in one command
gh repo create krishiai-platform --public --source=. --remote=origin --push
```

## Authentication

### Using Personal Access Token (PAT)

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`
4. Copy the token
5. Use it as password when pushing

### Using SSH (Alternative)

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to GitHub
cat ~/.ssh/id_ed25519.pub
# Copy and paste to GitHub Settings → SSH Keys

# Use SSH URL
git remote set-url origin git@github.com:YOUR_USERNAME/krishiai-platform.git
```

## Troubleshooting

### "Repository not found"
- Create the repository on GitHub first
- Check the repository name matches

### "Authentication failed"
- Use Personal Access Token instead of password
- Or set up SSH keys

### "Large files detected"
- Add large files to .gitignore
- Or use Git LFS: `git lfs install`

### "Remote already exists"
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/krishiai-platform.git
```

## After Pushing

Your code will be at:
```
https://github.com/YOUR_USERNAME/krishiai-platform
```

### Next Steps:
1. ✅ Add repository description
2. ✅ Add topics: `agriculture`, `ai`, `react-native`, `nodejs`
3. ✅ Enable GitHub Actions
4. ✅ Deploy to Vercel/Railway/Render

## Quick Deploy Commands

### Vercel (Dashboard only)
```bash
cd infrastructure/production/pilot-launch
vercel --prod
```

### Railway (Full stack)
```bash
railway login
railway init
railway up
```

### Render
1. Go to https://render.com
2. Connect GitHub repo
3. Auto-deploy

## Repository Structure

After pushing, your repo will contain:

```
krishiai-platform/
├── services/              # Backend microservices
├── mobile/               # React Native app
├── ml-models/            # AI/ML models
├── infrastructure/       # Kubernetes, Docker configs
├── docs/                 # Documentation
├── tests/                # Integration & load tests
└── README.md            # Project overview
```

## Support

If you encounter issues:
1. Check GITHUB_SETUP.md for detailed instructions
2. Run the automated script for easier setup
3. Use GitHub CLI for fastest deployment

Happy coding! 🚀
