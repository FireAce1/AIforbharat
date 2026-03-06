# KrishiAI Platform - Setup Verification Script

Write-Host "🔍 KrishiAI Platform - Setup Verification" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check Docker containers
Write-Host "🐳 Checking Docker containers..." -ForegroundColor Cyan
$containers = docker-compose ps --format json | ConvertFrom-Json

$services = @("postgres", "redis", "mongodb", "rabbitmq")
$allHealthy = $true

foreach ($service in $services) {
    $container = $containers | Where-Object { $_.Service -eq "krishiai-$service" }
    if ($container) {
        $status = $container.State
        if ($status -eq "running") {
            Write-Host "  ✅ $service is running" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $service is $status" -ForegroundColor Red
            $allHealthy = $false
        }
    } else {
        Write-Host "  ❌ $service container not found" -ForegroundColor Red
        $allHealthy = $false
    }
}

Write-Host ""

# Test PostgreSQL connection
Write-Host "🗄️  Testing PostgreSQL connection..." -ForegroundColor Cyan
try {
    $pgTest = docker exec krishiai-postgres pg_isready -U krishiai 2>&1
    if ($pgTest -match "accepting connections") {
        Write-Host "  ✅ PostgreSQL is accepting connections" -ForegroundColor Green
    } else {
        Write-Host "  ❌ PostgreSQL is not ready" -ForegroundColor Red
        $allHealthy = $false
    }
} catch {
    Write-Host "  ❌ Failed to connect to PostgreSQL" -ForegroundColor Red
    $allHealthy = $false
}

# Test Redis connection
Write-Host ""
Write-Host "💾 Testing Redis connection..." -ForegroundColor Cyan
try {
    $redisTest = docker exec krishiai-redis redis-cli -a krishiai_redis_password ping 2>&1
    if ($redisTest -match "PONG") {
        Write-Host "  ✅ Redis is responding" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Redis is not responding" -ForegroundColor Red
        $allHealthy = $false
    }
} catch {
    Write-Host "  ❌ Failed to connect to Redis" -ForegroundColor Red
    $allHealthy = $false
}

# Test MongoDB connection
Write-Host ""
Write-Host "🍃 Testing MongoDB connection..." -ForegroundColor Cyan
try {
    $mongoTest = docker exec krishiai-mongodb mongosh --quiet --eval "db.adminCommand('ping')" 2>&1
    if ($mongoTest -match "ok.*1") {
        Write-Host "  ✅ MongoDB is responding" -ForegroundColor Green
    } else {
        Write-Host "  ❌ MongoDB is not responding" -ForegroundColor Red
        $allHealthy = $false
    }
} catch {
    Write-Host "  ❌ Failed to connect to MongoDB" -ForegroundColor Red
    $allHealthy = $false
}

# Test RabbitMQ connection
Write-Host ""
Write-Host "🐰 Testing RabbitMQ connection..." -ForegroundColor Cyan
try {
    $rabbitTest = docker exec krishiai-rabbitmq rabbitmq-diagnostics -q ping 2>&1
    if ($rabbitTest -match "Ping succeeded") {
        Write-Host "  ✅ RabbitMQ is responding" -ForegroundColor Green
    } else {
        Write-Host "  ❌ RabbitMQ is not responding" -ForegroundColor Red
        $allHealthy = $false
    }
} catch {
    Write-Host "  ❌ Failed to connect to RabbitMQ" -ForegroundColor Red
    $allHealthy = $false
}

# Check directory structure
Write-Host ""
Write-Host "📁 Verifying directory structure..." -ForegroundColor Cyan
$requiredDirs = @(
    "services/auth-service",
    "services/crop-service",
    "services/market-service",
    "services/climate-service",
    "services/govt-service",
    "mobile/krishiai-app",
    "ml-models/crop-recommender",
    "ml-models/disease-detector",
    "infrastructure/docker"
)

$allDirsExist = $true
foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Write-Host "  ✓ $dir" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ $dir (missing)" -ForegroundColor Red
        $allDirsExist = $false
    }
}

if ($allDirsExist) {
    Write-Host "  ✅ All directories exist" -ForegroundColor Green
}

# Final summary
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
if ($allHealthy -and $allDirsExist) {
    Write-Host "✅ Setup verification PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your development environment is ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Start implementing services in services/ directory"
    Write-Host "2. Run 'npm run dev' to start development"
    Write-Host "3. Access RabbitMQ Management UI: http://localhost:15672"
} else {
    Write-Host "⚠️  Setup verification FAILED!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Some services are not ready. Please check the errors above." -ForegroundColor Yellow
    Write-Host "You may need to wait a bit longer for services to start." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run this script again after a few minutes:" -ForegroundColor Cyan
    Write-Host "  .\verify-setup.ps1"
}
Write-Host ""
