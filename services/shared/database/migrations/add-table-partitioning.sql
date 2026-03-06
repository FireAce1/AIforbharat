-- Table Partitioning for KrishiAI Platform
-- Purpose: Improve query performance and manageability for large time-series tables
-- Strategy: Range partitioning by time for market_prices and weather_forecasts

-- ============================================================================
-- 1. Partition market_prices by month
-- ============================================================================

-- Create partitioned table (if not already partitioned)
-- Note: This requires recreating the table if it already exists

-- Step 1: Rename existing table
ALTER TABLE IF EXISTS market_prices RENAME TO market_prices_old;

-- Step 2: Create new partitioned table
CREATE TABLE market_prices (
    time TIMESTAMPTZ NOT NULL,
    crop_name VARCHAR(100) NOT NULL,
    market_name VARCHAR(100) NOT NULL,
    location GEOGRAPHY(POINT),
    price_per_kg DECIMAL(10,2) NOT NULL,
    quantity_traded DECIMAL(10,2),
    source VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (time);

-- Step 3: Create partitions for past, current, and future months
-- Past 6 months
CREATE TABLE market_prices_2025_07 PARTITION OF market_prices
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE market_prices_2025_08 PARTITION OF market_prices
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE market_prices_2025_09 PARTITION OF market_prices
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE market_prices_2025_10 PARTITION OF market_prices
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE market_prices_2025_11 PARTITION OF market_prices
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE market_prices_2025_12 PARTITION OF market_prices
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Current and future months
CREATE TABLE market_prices_2026_01 PARTITION OF market_prices
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE market_prices_2026_02 PARTITION OF market_prices
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE market_prices_2026_03 PARTITION OF market_prices
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE market_prices_2026_04 PARTITION OF market_prices
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE market_prices_2026_05 PARTITION OF market_prices
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE market_prices_2026_06 PARTITION OF market_prices
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Step 4: Create indexes on partitioned table
CREATE INDEX idx_market_prices_time ON market_prices (time DESC);
CREATE INDEX idx_market_prices_crop ON market_prices (crop_name);
CREATE INDEX idx_market_prices_market ON market_prices (market_name);
CREATE INDEX idx_market_prices_location ON market_prices USING GIST (location);
CREATE INDEX idx_market_prices_crop_time ON market_prices (crop_name, time DESC);

-- Step 5: Migrate data from old table (if exists)
INSERT INTO market_prices 
SELECT * FROM market_prices_old 
WHERE time >= '2025-07-01'
ON CONFLICT DO NOTHING;

-- Step 6: Drop old table (after verification)
-- DROP TABLE IF EXISTS market_prices_old;

-- ============================================================================
-- 2. Partition weather_forecasts by month
-- ============================================================================

-- Step 1: Rename existing table
ALTER TABLE IF EXISTS weather_forecasts RENAME TO weather_forecasts_old;

-- Step 2: Create new partitioned table
CREATE TABLE weather_forecasts (
    time TIMESTAMPTZ NOT NULL,
    location GEOGRAPHY(POINT) NOT NULL,
    temperature DECIMAL(5,2),
    rainfall DECIMAL(5,2),
    humidity DECIMAL(5,2),
    wind_speed DECIMAL(5,2),
    solar_radiation DECIMAL(8,2),
    source VARCHAR(50),
    forecast_type VARCHAR(20), -- 'actual' or 'forecast'
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (time);

-- Step 3: Create partitions for past, current, and future months
CREATE TABLE weather_forecasts_2025_07 PARTITION OF weather_forecasts
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE weather_forecasts_2025_08 PARTITION OF weather_forecasts
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE weather_forecasts_2025_09 PARTITION OF weather_forecasts
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE weather_forecasts_2025_10 PARTITION OF weather_forecasts
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE weather_forecasts_2025_11 PARTITION OF weather_forecasts
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE weather_forecasts_2025_12 PARTITION OF weather_forecasts
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE weather_forecasts_2026_01 PARTITION OF weather_forecasts
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE weather_forecasts_2026_02 PARTITION OF weather_forecasts
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE weather_forecasts_2026_03 PARTITION OF weather_forecasts
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE weather_forecasts_2026_04 PARTITION OF weather_forecasts
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE weather_forecasts_2026_05 PARTITION OF weather_forecasts
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE weather_forecasts_2026_06 PARTITION OF weather_forecasts
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Step 4: Create indexes on partitioned table
CREATE INDEX idx_weather_forecasts_time ON weather_forecasts (time DESC);
CREATE INDEX idx_weather_forecasts_location ON weather_forecasts USING GIST (location);
CREATE INDEX idx_weather_forecasts_location_time ON weather_forecasts (location, time DESC);

-- Step 5: Migrate data from old table (if exists)
INSERT INTO weather_forecasts 
SELECT * FROM weather_forecasts_old 
WHERE time >= '2025-07-01'
ON CONFLICT DO NOTHING;

-- Step 6: Drop old table (after verification)
-- DROP TABLE IF EXISTS weather_forecasts_old;

-- ============================================================================
-- 3. Automatic Partition Management Functions
-- ============================================================================

-- Function to create next month's partition for market_prices
CREATE OR REPLACE FUNCTION create_market_prices_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    -- Get first day of next month
    partition_date := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    
    -- Generate partition name
    partition_name := 'market_prices_' || TO_CHAR(partition_date, 'YYYY_MM');
    
    -- Check if partition already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        start_date := TO_CHAR(partition_date, 'YYYY-MM-DD');
        end_date := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-DD');
        
        -- Create partition
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF market_prices FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        
        RAISE NOTICE 'Created partition: %', partition_name;
    ELSE
        RAISE NOTICE 'Partition % already exists', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create next month's partition for weather_forecasts
CREATE OR REPLACE FUNCTION create_weather_forecasts_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    partition_date := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    partition_name := 'weather_forecasts_' || TO_CHAR(partition_date, 'YYYY_MM');
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        start_date := TO_CHAR(partition_date, 'YYYY-MM-DD');
        end_date := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-DD');
        
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF weather_forecasts FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        
        RAISE NOTICE 'Created partition: %', partition_name;
    ELSE
        RAISE NOTICE 'Partition % already exists', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to drop old partitions (older than 12 months)
CREATE OR REPLACE FUNCTION drop_old_partitions()
RETURNS void AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := DATE_TRUNC('month', NOW() - INTERVAL '12 months');
    
    -- Drop old market_prices partitions
    FOR partition_record IN
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'market_prices_%'
        AND tablename != 'market_prices_old'
    LOOP
        -- Extract date from partition name (format: market_prices_YYYY_MM)
        DECLARE
            partition_date DATE;
        BEGIN
            partition_date := TO_DATE(
                SUBSTRING(partition_record.tablename FROM 'market_prices_(\d{4}_\d{2})'),
                'YYYY_MM'
            );
            
            IF partition_date < cutoff_date THEN
                EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.tablename);
                RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not process partition: %', partition_record.tablename;
        END;
    END LOOP;
    
    -- Drop old weather_forecasts partitions
    FOR partition_record IN
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'weather_forecasts_%'
        AND tablename != 'weather_forecasts_old'
    LOOP
        DECLARE
            partition_date DATE;
        BEGIN
            partition_date := TO_DATE(
                SUBSTRING(partition_record.tablename FROM 'weather_forecasts_(\d{4}_\d{2})'),
                'YYYY_MM'
            );
            
            IF partition_date < cutoff_date THEN
                EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.tablename);
                RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not process partition: %', partition_record.tablename;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Scheduled Partition Management (using pg_cron if available)
-- ============================================================================

-- Create next month's partitions on the 25th of each month
-- SELECT cron.schedule('create-market-prices-partition', '0 0 25 * *', 
--   'SELECT create_market_prices_partition()');

-- SELECT cron.schedule('create-weather-forecasts-partition', '0 0 25 * *', 
--   'SELECT create_weather_forecasts_partition()');

-- Drop old partitions on the 1st of each month
-- SELECT cron.schedule('drop-old-partitions', '0 0 1 * *', 
--   'SELECT drop_old_partitions()');

-- ============================================================================
-- 5. Partition Information Query
-- ============================================================================

-- Query to view all partitions and their sizes
CREATE OR REPLACE VIEW partition_info AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE tablename LIKE 'market_prices_%' OR tablename LIKE 'weather_forecasts_%'
ORDER BY size_bytes DESC;

-- ============================================================================
-- Performance Benefits
-- ============================================================================

-- 1. Query Performance: Partition pruning eliminates scanning irrelevant data
--    Example: Query for last 7 days only scans current month's partition
--    Performance improvement: 10-100x faster for time-range queries

-- 2. Maintenance: VACUUM, ANALYZE, and REINDEX operations are faster on smaller partitions

-- 3. Data Management: Easy to archive or drop old data by dropping partitions

-- 4. Concurrent Operations: Different partitions can be accessed concurrently

-- ============================================================================
-- Usage Examples
-- ============================================================================

-- Query with automatic partition pruning
-- EXPLAIN ANALYZE
-- SELECT * FROM market_prices 
-- WHERE time >= NOW() - INTERVAL '7 days'
-- AND crop_name = 'Tomato';

-- Create next month's partitions manually
-- SELECT create_market_prices_partition();
-- SELECT create_weather_forecasts_partition();

-- View partition information
-- SELECT * FROM partition_info;

-- Drop old partitions manually
-- SELECT drop_old_partitions();

-- ============================================================================
-- Rollback Script
-- ============================================================================

-- To rollback partitioning (restore from backup):
-- DROP TABLE IF EXISTS market_prices CASCADE;
-- ALTER TABLE market_prices_old RENAME TO market_prices;
-- DROP TABLE IF EXISTS weather_forecasts CASCADE;
-- ALTER TABLE weather_forecasts_old RENAME TO weather_forecasts;
-- DROP FUNCTION IF EXISTS create_market_prices_partition();
-- DROP FUNCTION IF EXISTS create_weather_forecasts_partition();
-- DROP FUNCTION IF EXISTS drop_old_partitions();
-- DROP VIEW IF EXISTS partition_info;
