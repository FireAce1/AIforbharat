# KrishiAI Platform - Development Environment Setup (Windows)

Write-Host "🌾 KrishiAI Platform - Development Environment Setup" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""

# Check Node.js installation
Write-Host "📦 Checking Node.js installation..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($nodeMajor -lt 18) {
        Write-Host "❌ Node.js version 18+ required. Current version: $nodeVersion" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Check Docker installation
Write-Host ""
Write-Host "🐳 Checking Docker installation..." -ForegroundColor Cyan
try {
    $dockerVersion = docker --version
    Write-Host "✅ $dockerVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check Docker Compose installation
Write-Host ""
Write-Host "🐳 Checking Docker Compose installation..." -ForegroundColor Cyan
try {
    $composeVersion = docker-compose --version
    Write-Host "✅ $composeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

# Check Python installation
Write-Host ""
Write-Host "🐍 Checking Python installation..." -ForegroundColor Cyan
try {
    $pythonVersion = python --version
    Write-Host "✅ $pythonVersion detected" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Python 3 is not installed. ML services will require Python 3.9+" -ForegroundColor Yellow
}

# Verify directory structure
Write-Host ""
Write-Host "📁 Verifying directory structure..." -ForegroundColor Cyan
$directories = @(
    "services/auth-service",
    "services/crop-service",
    "services/market-service",
    "services/climate-service",
    "services/govt-service",
    "mobile/krishiai-app",
    "ml-models/crop-recommender",
    "ml-models/disease-detector",
    "ml-models/price-forecaster",
    "ml-models/chatbot-nlp",
    "infrastructure/k8s",
    "infrastructure/terraform",
    "infrastructure/docker",
    "data-pipelines/ingestion",
    "data-pipelines/processing",
    "data-pipelines/training",
    "docs/api",
    "docs/architecture",
    "docs/guides"
)

foreach ($dir in $directories) {
    if (Test-Path $dir) {
        Write-Host "  ✓ $dir" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ $dir (missing)" -ForegroundColor Red
    }
}
Write-Host "✅ Directory structure verified" -ForegroundColor Green

# Install root dependencies
Write-Host ""
Write-Host "📦 Installing root dependencies..." -ForegroundColor Cyan
npm install
Write-Host "✅ Root dependencies installed" -ForegroundColor Green

# Start Docker containers
Write-Host ""
Write-Host "🐳 Starting Docker containers..." -ForegroundColor Cyan
docker-compose up -d

# Wait for services to be healthy
Write-Host ""
Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Check service health
Write-Host ""
Write-Host "🏥 Checking service health..." -ForegroundColor Cyan
$services = docker-compose ps
if ($services -match "Up \(healthy\)") {
    Write-Host "✅ All services are healthy" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some services may still be starting. Run 'docker-compose ps' to check status." -ForegroundColor Yellow
}

# Display connection information
Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Service Connection Information:" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "PostgreSQL (TimescaleDB):"
Write-Host "  Host: localhost:5432"
Write-Host "  Database: krishiai_db"
Write-Host "  User: krishiai"
Write-Host "  Password: krishiai_dev_password"
Write-Host ""
Write-Host "Redis:"
Write-Host "  Host: localhost:6379"
Write-Host "  Password: krishiai_redis_password"
Write-Host ""
Write-Host "MongoDB:"
Write-Host "  Host: localhost:27017"
Write-Host "  User: krishiai"
Write-Host "  Password: krishiai_mongo_password"
Write-Host ""
Write-Host "RabbitMQ:"
Write-Host "  Host: localhost:5672"
Write-Host "  Management UI: http://localhost:15672"
Write-Host "  User: krishiai"
Write-Host "  Password: krishiai_rabbitmq_password"
Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "==============" -ForegroundColor Cyan
Write-Host "1. Initialize individual services:"
Write-Host "   cd services/auth-service && npm init -y"
Write-Host ""
Write-Host "2. Start development:"
Write-Host "   npm run dev"
Write-Host ""
Write-Host "3. View logs:"
Write-Host "   npm run docker:logs"
Write-Host ""
Write-Host "4. Stop services:"
Write-Host "   npm run docker:down"
Write-Host ""
Write-Host "Happy coding! 🌾" -ForegroundColor Green
