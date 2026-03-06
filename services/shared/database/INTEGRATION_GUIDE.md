# Database Performance Optimization - Integration Guide

This guide shows how to integrate the database performance optimizations (Task 12.2) into each service.

## Overview

The optimization includes:
1. **Composite Indexes**: 40+ indexes for common query patterns
2. **Prepared Statements**: Centralized registry for all services
3. **Query Optimizer**: TypeScript utility for Node.js services
4. **Database Optimizer**: Python utility for FastAPI services
5. **Connection Pooling**: Optimized pool configuration (20 connections)
6. **Query Performance Logging**: Automatic logging of slow queries (>100ms)

## Node.js Services Integration

### 1. Update Database Configuration

**File**: `services/{service-name}/src/config/database.ts`

```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { QueryOptimizer } from '../../shared/database/queryOptimizer';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'krishiai_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,                      // Connection pool size
  idleTimeoutMillis: 30000,     // 30 seconds
  connectionTimeoutMillis: 2000, // 2 seconds
  statement_timeout: 30000,      // 30 seconds query timeout
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Initialize query optimizer
export const queryOptimizer = new QueryOptimizer(pool);

export default pool;
```

### 2. Update Service Code to Use Prepared Statements

**Before**:
```typescript
const result = await db.query(
  'SELECT * FROM users WHERE phone = $1',
  [phone]
);
```

**After**:
```typescript
import { queryOptimizer } from '../config/database';
import { PreparedStatements } from '../../shared/database/preparedStatements';

const stmt = PreparedStatements.AUTH.GET_USER_BY_PHONE;
const result = await queryOptimizer.query(
  stmt.text,
  [phone],
  { name: stmt.name }
);
```

### 3. Use Batch Operations

```typescript
import { queryOptimizer } from '../config/database';

// Batch insert
await queryOptimizer.batchInsert(
  'market_prices',
  ['time', 'crop_name', 'market_name', 'price_per_kg'],
  rows,
  { 
    batchSize: 100,
    onConflict: 'ON CONFLICT (time, crop_name, market_name) DO UPDATE SET price_per_kg = EXCLUDED.price_per_kg'
  }
);
```

### 4. Use Transactions

```typescript
import { queryOptimizer } from '../config/database';

await queryOptimizer.transaction(async (client) => {
  await client.query('INSERT INTO farms (...) VALUES (...)');
  await client.query('INSERT INTO crops (...) VALUES (...)');
  // Both queries committed together or rolled back on error
});
```

### 5. Monitor Performance

```typescript
import { queryOptimizer } from '../config/database';

// Get slow queries
const slowQueries = queryOptimizer.getSlowQueries();
console.log(`Slow queries: ${slowQueries.length}`);

// Get pool stats
const poolStats = queryOptimizer.getPoolStats();
console.log('Pool stats:', poolStats);

// Get all metrics
const metrics = queryOptimizer.getMetrics();
console.log(`Total queries: ${metrics.length}`);
```

## Python Services Integration

### 1. Update Main Application

**File**: `services/{service-name}/src/main.py`

```python
from fastapi import FastAPI
from .database_optimizer import db_optimizer
import logging

logger = logging.getLogger(__name__)

app = FastAPI(title="Service Name")

@app.on_event("startup")
async def startup_event():
    logger.info("Starting service...")
    pool_stats = db_optimizer.get_pool_stats()
    logger.info(f"Database optimizer initialized: {pool_stats}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down service...")
    
    # Log slow queries
    slow_queries = db_optimizer.get_slow_queries()
    if slow_queries:
        logger.warning(f"Slow queries detected: {len(slow_queries)}")
    
    # Close connections
    db_optimizer.close()
    logger.info("Database connections closed")
```

### 2. Update Route Handlers

**Before**:
```python
from sqlalchemy.orm import Session
from .database import get_db

@app.get("/farms/{farm_id}")
def get_farm(farm_id: str, db: Session = Depends(get_db)):
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    # This causes N+1 queries if accessing farm.crops
    return farm
```

**After**:
```python
from sqlalchemy.orm import Session
from .database_optimizer import get_db, get_with_relationships

@app.get("/farms/{farm_id}")
def get_farm(farm_id: str, db: Session = Depends(get_db)):
    # Eager load relationships to prevent N+1 queries
    farm = get_with_relationships(
        db,
        Farm,
        {'id': farm_id},
        ['crops', 'user'],  # Relationships to eager load
        strategy='joined'
    )
    return farm
```

### 3. Use Batch Operations

```python
from .database_optimizer import db_optimizer, get_db

with db_optimizer.get_db() as db:
    # Batch insert
    records = [
        {'time': datetime.now(), 'crop_name': 'Tomato', 'price_per_kg': 25.50},
        {'time': datetime.now(), 'crop_name': 'Onion', 'price_per_kg': 18.00},
        # ... more records
    ]
    
    db_optimizer.batch_insert(
        db,
        MarketPrice,
        records,
        batch_size=100
    )
```

### 4. Monitor Performance

```python
from .database_optimizer import db_optimizer

# Get pool stats
stats = db_optimizer.get_pool_stats()
print(f"Pool stats: {stats}")

# Get slow queries
slow_queries = db_optimizer.get_slow_queries()
print(f"Slow queries: {len(slow_queries)}")

# Clear metrics
db_optimizer.clear_metrics()
```

## Service-Specific Integration Examples

### Auth Service

**Files to update**:
- `src/config/database.ts` ✅ (Already updated)
- `src/services/authService.ts` ✅ (Already updated)
- `src/services/otpService.ts` (Update to use prepared statements)

### Market Service

**Files to update**:
- `src/config/database.ts`
- `src/services/priceService.ts`
- `src/services/forecastService.ts`
- `src/services/ingestionService.ts`

**Example for priceService.ts**:
```typescript
import { queryOptimizer } from '../config/database';
import { PreparedStatements } from '../../shared/database/preparedStatements';

export class PriceService {
  async getRecentPrices(cropName: string, limit: number = 10) {
    const stmt = PreparedStatements.MARKET.GET_RECENT_PRICES;
    const result = await queryOptimizer.query(
      stmt.text,
      [cropName, limit],
      { name: stmt.name }
    );
    return result.rows;
  }
}
```

### Climate Service

**Files to update**:
- `src/config/database.ts`
- `src/services/weatherService.ts`
- `src/services/waterAdvisoryService.ts`

**Example for weatherService.ts**:
```typescript
import { queryOptimizer } from '../config/database';
import { PreparedStatements } from '../../shared/database/preparedStatements';

export class WeatherService {
  async getForecast(lng: number, lat: number, days: number = 7) {
    const stmt = PreparedStatements.WEATHER.GET_FORECAST;
    const result = await queryOptimizer.query(
      stmt.text,
      [lng, lat, days],
      { name: stmt.name }
    );
    return result.rows;
  }
}
```

### Crop Service (Python)

**Files to update**:
- `src/main.py` ✅ (Already updated)
- `src/services/crop_service.py`
- `src/services/disease_service.py`

**Example for crop_service.py**:
```python
from sqlalchemy.orm import Session
from .database_optimizer import get_with_relationships, get_db
from .models.farm import Farm

class CropService:
    def get_farm_with_crops(self, db: Session, farm_id: str):
        # Eager load crops to prevent N+1 queries
        farm = get_with_relationships(
            db,
            Farm,
            {'id': farm_id},
            ['crops', 'user'],
            strategy='joined'
        )
        return farm
```

### Government Service

**Files to update**:
- `src/config/database.ts`
- `src/services/schemeService.ts`
- `src/services/notificationService.ts`

**Example for schemeService.ts**:
```typescript
import { queryOptimizer } from '../config/database';
import { PreparedStatements } from '../../shared/database/preparedStatements';

export class SchemeService {
  async searchSchemes(query: string, limit: number = 20) {
    const stmt = PreparedStatements.SCHEMES.SEARCH_SCHEMES;
    const result = await queryOptimizer.query(
      stmt.text,
      [`%${query}%`, limit],
      { name: stmt.name }
    );
    return result.rows;
  }
}
```

## Database Migration

### Apply Composite Indexes

**Windows (PowerShell)**:
```powershell
cd services/shared/database/migrations
.\apply-indexes.ps1
```

**Linux/Mac**:
```bash
cd services/shared/database/migrations
psql -h localhost -p 5432 -U postgres -d krishiai_db -f add-composite-indexes.sql
```

### Verify Indexes

```bash
psql -h localhost -p 5432 -U postgres -d krishiai_db -f verify-indexes.sql
```

## Performance Monitoring

### 1. Enable pg_stat_statements

```sql
-- Enable extension for query performance tracking
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 100  -- queries averaging >100ms
ORDER BY mean_time DESC
LIMIT 20;
```

### 2. Monitor Index Usage

```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND idx_scan = 0
AND indexname LIKE 'idx_%';
```

### 3. Monitor Connection Pool

```typescript
// In your service
import { queryOptimizer } from './config/database';

setInterval(() => {
  const stats = queryOptimizer.getPoolStats();
  console.log('Pool stats:', stats);
  
  if (stats.waitingCount > 0) {
    console.warn('Connection pool exhausted! Waiting:', stats.waitingCount);
  }
}, 60000); // Check every minute
```

## Expected Performance Improvements

### Before Optimization
- User lookup: ~50ms
- Farm with crops: ~200ms (N+1 problem)
- Market price query: ~150ms
- Scheme search: ~300ms
- Batch insert (1000 rows): ~5000ms

### After Optimization
- User lookup: ~10ms (80% improvement)
- Farm with crops: ~20ms (90% improvement)
- Market price query: ~45ms (70% improvement)
- Scheme search: ~50ms (83% improvement)
- Batch insert (1000 rows): ~250ms (95% improvement)

## Troubleshooting

### Issue: Prepared statement already exists

**Solution**: The QueryOptimizer automatically handles this. If you see this error, ensure you're using the same statement name consistently.

### Issue: Connection pool exhausted

**Solution**: 
1. Check for connection leaks (always release connections)
2. Increase pool size if needed (max: 20 is recommended)
3. Review slow queries and optimize them

### Issue: Slow queries not being logged

**Solution**:
1. Ensure LOG_LEVEL is set to 'warn' or lower
2. Check that queryOptimizer is being used instead of direct pool.query()
3. Verify SLOW_QUERY_THRESHOLD (default: 100ms)

### Issue: Index not being used

**Solution**:
1. Run ANALYZE on the table to update statistics
2. Check query plan with EXPLAIN ANALYZE
3. Ensure WHERE clause matches index columns
4. Consider partial indexes for filtered queries

## Maintenance Tasks

### Weekly
- Review slow query logs
- Check index usage statistics
- Monitor connection pool metrics

### Monthly
- Run VACUUM ANALYZE on all tables
- Review and remove unused indexes
- Update query statistics with ANALYZE

### Quarterly
- Review and optimize query patterns
- Benchmark performance improvements
- Update prepared statements as needed

## Additional Resources

- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [SQLAlchemy Performance](https://docs.sqlalchemy.org/en/14/faq/performance.html)
- [Node.js pg Pool](https://node-postgres.com/features/pooling)
- [TimescaleDB Best Practices](https://docs.timescale.com/timescaledb/latest/how-to-guides/hypertables/)

