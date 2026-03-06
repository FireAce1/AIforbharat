# Database Migrations

This directory contains database migrations for the KrishiAI platform using `node-pg-migrate`.

## Overview

Migrations are used to version control database schema changes. Each migration file represents a set of changes that can be applied (up) or reverted (down).

## Migration Files

- `1704067200000_initial-schema.js` - Initial database schema with:
  - Core tables: users, otp_codes, farms, crops, disease_detections
  - TimescaleDB hypertables: market_prices, weather_forecasts
  - Performance indexes for phone lookup, geospatial queries, time-series queries
  - Data retention policies: 5 years for prices, 2 years for weather

## Running Migrations

### Prerequisites

1. Ensure PostgreSQL with TimescaleDB and PostGIS extensions is running
2. Set DATABASE_URL environment variable in `.env` file

### Commands

```bash
# Install dependencies
npm install

# Run all pending migrations
npm run migrate

# Rollback last migration
npm run migrate:down

# Create a new migration
npm run migrate:create <migration-name>
```

## Migration Structure

Each migration file exports two functions:

- `up(pgm)` - Applies the migration (creates tables, indexes, etc.)
- `down(pgm)` - Reverts the migration (drops tables, indexes, etc.)

## Database Schema

### Core Tables

1. **users** - User accounts and profiles
   - Indexed on: phone (unique)

2. **otp_codes** - OTP verification codes
   - Indexed on: phone + expires_at (composite)
   - Auto-expires after 5 minutes

3. **farms** - Farm information with geospatial data
   - Indexed on: user_id, location (GIST)
   - Supports geospatial queries within radius

4. **crops** - Crop planting records
   - Indexed on: farm_id

5. **disease_detections** - Disease detection history
   - Indexed on: crop_id, detected_at

### TimescaleDB Hypertables

1. **market_prices** - Historical market price data
   - Partitioned by: time (1 week chunks)
   - Indexed on: time + crop_name, location (GIST)
   - Retention: 5 years

2. **weather_forecasts** - Weather forecast data
   - Partitioned by: time (1 day chunks)
   - Indexed on: time, location (GIST)
   - Retention: 2 years

## Performance Considerations

- **Geospatial Indexes**: GIST indexes on geography columns enable fast radius queries
- **Time-Series Indexes**: B-tree indexes on timestamp columns for efficient time-range queries
- **Composite Indexes**: Multi-column indexes for common query patterns
- **Hypertable Partitioning**: Automatic time-based partitioning for scalability
- **Data Retention**: Automatic cleanup of old data to manage storage

## Validation

After running migrations, verify the schema:

```bash
# Connect to database
psql $DATABASE_URL

# List all tables
\dt

# Describe a table
\d users

# Check hypertables
SELECT * FROM timescaledb_information.hypertables;

# Check retention policies
SELECT * FROM timescaledb_information.jobs WHERE proc_name = 'policy_retention';
```

## Troubleshooting

### Extension Not Found

If you get "extension timescaledb does not exist":
```sql
CREATE EXTENSION timescaledb;
```

### Permission Denied

Ensure the database user has sufficient privileges:
```sql
GRANT ALL PRIVILEGES ON DATABASE krishiai_db TO krishiai;
```

### Migration Already Applied

If a migration was partially applied, check the migrations table:
```sql
SELECT * FROM pgmigrations;
```

To force re-run, delete the entry and run again (use with caution).
