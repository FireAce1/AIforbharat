# KrishiAI Deployment Guide

## Quick Start - Get a Working Link in 30 Minutes

### Option 1: Deploy Dashboard Only (Fastest)

#### Using Vercel (Recommended for Demo)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Navigate to pilot dashboard
cd infrastructure/production/pilot-launch

# 3. Create vercel.json configuration
cat > vercel.json << EOF
{
  "version": 2,
  "builds": [
    {
      "src": "pilot-dashboard.html",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/pilot-dashboard.html"
    }
  ]
}
EOF

# 4. Deploy
vercel --prod
```

**Result**: You'll get a URL like `https://krishiai-dashboard-xyz.vercel.app`

#### Using Netlify

```bash
# 1. Install Netlify CLI
npm install -g netlify-cli

# 2. Deploy
cd infrastructure/production/pilot-launch
netlify deploy --prod --dir=.
```

### Option 2: Deploy Full Backend + Dashboard (Railway)

#### Step 1: Prepare for Railway

```bash
# 1. Create railway.json in project root
cat > railway.json << EOF
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start:all",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF

# 2. Create Procfile
cat > Procfile << EOF
web: cd infrastructure/production/pilot-launch && npm install && npm run start:all
EOF
```

#### Step 2: Deploy to Railway

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Add PostgreSQL
railway add --database postgresql

# 5. Add Redis
railway add --database redis

# 6. Deploy
railway up

# 7. Get your URL
railway domain
```

**Result**: URLs like:
- Dashboard: `https://krishiai.up.railway.app`
- API: `https://krishiai-api.up.railway.app`

### Option 3: Deploy to Render.com (Free Tier)

#### Step 1: Create render.yaml

```yaml
# render.yaml
services:
  # PostgreSQL Database
  - type: pserv
    name: krishiai-db
    env: docker
    plan: free
    
  # Redis
  - type: redis
    name: krishiai-redis
    plan: free
    
  # Monitoring Dashboard Backend
  - type: web
    name: krishiai-monitoring
    env: node
    plan: free
    buildCommand: cd infrastructure/production/pilot-launch && npm install
    startCommand: cd infrastructure/production/pilot-launch && npm run start:monitoring
    envVars:
      - key: NODE_ENV
        value: production
      - key: DB_HOST
        fromDatabase:
          name: krishiai-db
          property: host
      - key: REDIS_HOST
        fromDatabase:
          name: krishiai-redis
          property: host
    
  # Static Dashboard
  - type: web
    name: krishiai-dashboard
    env: static
    buildCommand: echo "No build needed"
    staticPublishPath: infrastructure/production/pilot-launch
    routes:
      - type: rewrite
        source: /*
        destination: /pilot-dashboard.html
```

#### Step 2: Deploy

1. Push code to GitHub
2. Go to https://render.com
3. Click "New" → "Blueprint"
4. Connect your GitHub repo
5. Render will auto-detect `render.yaml` and deploy

**Result**: `https://krishiai-dashboard.onrender.com`

### Option 4: Deploy to AWS (Production Ready)

#### Quick AWS Deployment with Elastic Beanstalk

```bash
# 1. Install EB CLI
pip install awsebcli

# 2. Initialize
cd infrastructure/production/pilot-launch
eb init -p node.js-18 krishiai-pilot

# 3. Create environment
eb create krishiai-pilot-env

# 4. Deploy
eb deploy

# 5. Open in browser
eb open
```

**Result**: `http://krishiai-pilot-env.elasticbeanstalk.com`

#### Full Kubernetes Deployment (Your Existing Setup)

```bash
# 1. Set up AWS credentials
aws configure

# 2. Create EKS cluster
eksctl create cluster \
  --name krishiai-cluster \
  --region ap-south-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3

# 3. Deploy services
cd infrastructure/k8s
./deploy.sh

# 4. Get Load Balancer URL
kubectl get svc -n krishiai
```

### Option 5: Docker Compose (Local + Cloud)

#### For Local Testing

```bash
# 1. Navigate to project root
cd infrastructure/production/pilot-launch

# 2. Create docker-compose.yml
cat > docker-compose.yml << EOF
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: krishiai_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  monitoring:
    build: .
    command: npm run start:monitoring
    ports:
      - "3100:3100"
    environment:
      - DB_HOST=postgres
      - REDIS_HOST=redis
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis

  dashboard:
    image: nginx:alpine
    volumes:
      - ./pilot-dashboard.html:/usr/share/nginx/html/index.html
    ports:
      - "8080:80"

volumes:
  postgres_data:
EOF

# 3. Start services
docker-compose up -d

# 4. Access dashboard
open http://localhost:8080
```

#### Deploy to DigitalOcean App Platform

```bash
# 1. Install doctl
brew install doctl  # or download from digitalocean.com

# 2. Authenticate
doctl auth init

# 3. Create app
doctl apps create --spec .do/app.yaml

# 4. Get URL
doctl apps list
```

## Recommended Deployment Path

### For Quick Demo (Today):
1. **Vercel** for dashboard → 5 minutes
2. **Mock API data** in dashboard → Works immediately

### For Working Prototype (This Week):
1. **Railway.app** → Full stack with database
2. **GitHub Actions** → Auto-deploy on push

### For Production (Next Month):
1. **AWS EKS** with your Kubernetes configs
2. **CloudFront CDN** for dashboard
3. **RDS** for PostgreSQL
4. **ElastiCache** for Redis

## Environment Variables Needed

Create `.env` file:

```bash
# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=krishiai_db
DB_USER=postgres
DB_PASSWORD=your-password

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379

# Monitoring
PROMETHEUS_URL=http://prometheus:9090
MONITORING_PORT=3100

# Email (for alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ALERT_EMAIL=alerts@krishiai.com

# API Keys
AGMARKNET_API_KEY=your-key
IMD_API_KEY=your-key
```

## Testing Your Deployment

```bash
# Test monitoring API
curl https://your-url.com/api/monitoring/dashboard

# Test health endpoint
curl https://your-url.com/health

# View dashboard
open https://your-url.com
```

## Troubleshooting

### Dashboard shows "Loading..."
- Check API endpoints in `pilot-dashboard.html`
- Update `API_BASE_URL` to your backend URL
- Check CORS settings

### Database connection fails
- Verify environment variables
- Check database is running
- Test connection: `psql -h $DB_HOST -U $DB_USER -d $DB_NAME`

### Redis connection fails
- Verify Redis is running
- Test: `redis-cli -h $REDIS_HOST ping`

## Next Steps

1. Choose deployment option above
2. Set up environment variables
3. Run database migrations
4. Deploy and test
5. Share the URL!

## Cost Estimates

- **Vercel/Netlify**: Free for dashboard
- **Railway**: $5-20/month (includes DB + Redis)
- **Render**: Free tier available
- **AWS**: $50-200/month (production setup)
- **DigitalOcean**: $12-50/month

## Support

For deployment issues:
1. Check logs: `railway logs` or `kubectl logs`
2. Verify environment variables
3. Test database connectivity
4. Check service health endpoints
