# PowerShell script to apply database performance optimization indexes
# Task 12.2: Database and API Performance Optimization

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Database Performance Optimization Migration" -ForegroundColor Cyan
Write-Host "Task 12.2: Adding Composite Indexes" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables
if (Test-Path "../../../.env") {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
    Get-Content "../../../.env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Database connection parameters
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "krishiai_db" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "postgres" }

Write-Host "Database Configuration:" -ForegroundColor Green
Write-Host "  Host: $DB_HOST" -ForegroundColor Gray
Write-Host "  Port: $DB_PORT" -ForegroundColor Gray
Write-Host "  Database: $DB_NAME" -ForegroundColor Gray
Write-Host "  User: $DB_USER" -ForegroundColor Gray
Write-Host ""

# Set PGPASSWORD environment variable for psql
$env:PGPASSWORD = $DB_PASSWORD

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "ERROR: psql command not found!" -ForegroundColor Red
    Write-Host "Please install PostgreSQL client tools." -ForegroundColor Red
    Write-Host "Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found psql at: $($psqlPath.Source)" -ForegroundColor Green
Write-Host ""

# Test database connection
Write-Host "Testing database connection..." -ForegroundColor Yellow
$testQuery = "SELECT version();"
$testResult = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $testQuery 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to connect to database!" -ForegroundColor Red
    Write-Host $testResult -ForegroundColor Red
    exit 1
}

Write-Host "Database connection successful!" -ForegroundColor Green
Write-Host "PostgreSQL version: $($testResult.Trim())" -ForegroundColor Gray
Write-Host ""

# Count existing indexes
Write-Host "Checking existing indexes..." -ForegroundColor Yellow
$countQuery = "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';"
$existingCount = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $countQuery

Write-Host "Existing custom indexes: $($existingCount.Trim())" -ForegroundColor Gray
Write-Host ""

# Apply migration
Write-Host "Applying composite indexes migration..." -ForegroundColor Yellow
Write-Host "This may take a few minutes depending on table sizes..." -ForegroundColor Gray
Write-Host ""

$migrationFile = "add-composite-indexes.sql"
$migrationPath = Join-Path $PSScriptRoot $migrationFile

if (-not (Test-Path $migrationPath)) {
    Write-Host "ERROR: Migration file not found: $migrationPath" -ForegroundColor Red
    exit 1
}

# Apply migration with timing
$startTime = Get-Date
$migrationResult = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $migrationPath 2>&1
$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Migration failed!" -ForegroundColor Red
    Write-Host $migrationResult -ForegroundColor Red
    exit 1
}

Write-Host "Migration completed successfully!" -ForegroundColor Green
Write-Host "Duration: $([math]::Round($duration, 2)) seconds" -ForegroundColor Gray
Write-Host ""

# Count new indexes
Write-Host "Verifying indexes created..." -ForegroundColor Yellow
$newCount = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $countQuery
$indexesAdded = [int]$newCount.Trim() - [int]$existingCount.Trim()

Write-Host "Total custom indexes: $($newCount.Trim())" -ForegroundColor Gray
Write-Host "Indexes added: $indexesAdded" -ForegroundColor Green
Write-Host ""

# Show index details
Write-Host "Index Summary:" -ForegroundColor Cyan
$summaryQuery = @"
SELECT 
  tablename,
  COUNT(*) as index_count,
  pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
GROUP BY tablename
ORDER BY tablename;
"@

Write-Host ""
& psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $summaryQuery
Write-Host ""

# Show slow query threshold
Write-Host "Performance Monitoring Configuration:" -ForegroundColor Cyan
Write-Host "  Slow query threshold: 100ms" -ForegroundColor Gray
Write-Host "  Connection pool size: 20 connections" -ForegroundColor Gray
Write-Host "  Query timeout: 30 seconds" -ForegroundColor Gray
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Migration Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update service configurations to use QueryOptimizer" -ForegroundColor Gray
Write-Host "2. Replace direct queries with prepared statements" -ForegroundColor Gray
Write-Host "3. Monitor query performance with slow query logs" -ForegroundColor Gray
Write-Host "4. Run performance benchmarks to validate improvements" -ForegroundColor Gray
Write-Host ""
Write-Host "To monitor index usage, run:" -ForegroundColor Yellow
Write-Host "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f verify-indexes.sql" -ForegroundColor Gray
Write-Host ""
