# Market Service

KrishiAI Market Intelligence Service - Provides real-time market price information, price forecasting, and market analytics for farmers.

## Features

- **Real-time Price Data**: Daily updates from Agmarknet and eNAM APIs
- **TimescaleDB Integration**: Efficient time-series data storage with automatic compression
- **Geospatial Queries**: Find nearest mandis using PostGIS
- **Automated Data Ingestion**: Scheduled daily updates at 6:00 AM IST
- **Caching**: Redis-based caching for improved performance
- **Data Retention**: 5-year retention with automatic compression after 1 year

## Technology Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with TimescaleDB extension
- **Cache**: Redis
- **Scheduling**: node-cron
- **Logging**: Winston

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ with TimescaleDB and PostGIS extensions
- Redis 7+

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Database Setup

```bash
# Run migrations
npm run migrate

# The migration will:
# - Create market_prices table
# - Set up TimescaleDB hypertable
# - Create geospatial indexes
# - Configure data retention (5 years)
# - Configure compression (after 1 year)
```

## Development

```bash
# Start development server with hot reload
npm run dev

# Run tests
npm test

# Run linter
npm run lint
```

## Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## Docker

```bash
# Build image
docker build -t krishiai/market-service:latest .

# Run container
docker run -d \
  --name market-service \
  -p 3003:3003 \
  --env-file .env \
  krishiai/market-service:latest
```

## API Endpoints

### Health Check
```
GET /health
```

Returns service health status including database, Redis, and cron job status.

### Manual Data Ingestion
```
POST /api/v1/admin/ingest
```

Manually trigger price data ingestion from external APIs.

### Cron Job Status
```
GET /api/v1/admin/cron-status
```

Get status of all scheduled cron jobs.

## Data Sources

### Agmarknet
- **URL**: https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070
- **Coverage**: 6,000+ mandis across India
- **Update Frequency**: Daily

### eNAM (National Agriculture Market)
- **URL**: https://enam.gov.in/web/api
- **Coverage**: 1,000+ integrated mandis
- **Update Frequency**: Real-time

## Cron Schedule

- **Price Updates**: Daily at 6:00 AM IST
- **Timezone**: Asia/Kolkata (IST)

## Data Retention Policy

- **Active Data**: 5 years
- **Compression**: Data older than 1 year is automatically compressed
- **Cleanup**: Automatic deletion of data older than 5 years

## Performance Optimization

- **Connection Pooling**: Max 20 database connections
- **Redis Caching**: 1-hour TTL for price queries
- **Geospatial Indexing**: GIST indexes for location-based queries
- **TimescaleDB Compression**: Reduces storage by 90% for historical data

## Monitoring

- **Logs**: Stored in `logs/` directory
  - `error.log`: Error-level logs
  - `combined.log`: All logs
- **Metrics**: Exposed via health endpoint
- **Slow Query Logging**: Queries >100ms are logged

## Environment Variables

See `.env.example` for all configuration options.

Key variables:
- `PORT`: Server port (default: 3003)
- `DB_HOST`, `DB_PORT`, `DB_NAME`: Database connection
- `REDIS_HOST`, `REDIS_PORT`: Redis connection
- `AGMARKNET_API_KEY`, `ENAM_API_KEY`: External API credentials
- `PRICE_UPDATE_CRON`: Cron schedule for price updates

## Troubleshooting

### Database Connection Issues
```bash
# Test database connection
psql -h localhost -U postgres -d krishiai_db -c "SELECT NOW();"
```

### Redis Connection Issues
```bash
# Test Redis connection
redis-cli ping
```

### TimescaleDB Extension
```sql
-- Check if TimescaleDB is installed
SELECT * FROM pg_extension WHERE extname = 'timescaledb';

-- Install if missing
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### PostGIS Extension
```sql
-- Check if PostGIS is installed
SELECT * FROM pg_extension WHERE extname = 'postgis';

-- Install if missing
CREATE EXTENSION IF NOT EXISTS postgis;
```

## License

MIT

## Support

For issues and questions, contact the KrishiAI development team.
