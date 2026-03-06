/**
 * Migration: Create weather_forecasts TimescaleDB hypertable
 * 
 * This migration creates the weather_forecasts table with TimescaleDB
 * for efficient time-series data storage and querying.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'krishiai_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function up() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration: create weather_forecasts table...');
    
    await client.query('BEGIN');

    // Enable PostGIS extension if not already enabled
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS postgis;
    `);

    // Enable TimescaleDB extension if not already enabled
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS timescaledb;
    `);

    // Create weather_forecasts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS weather_forecasts (
        time TIMESTAMPTZ NOT NULL,
        location GEOGRAPHY(POINT, 4326) NOT NULL,
        temperature DECIMAL(5,2) NOT NULL,
        rainfall DECIMAL(5,2) NOT NULL DEFAULT 0,
        humidity DECIMAL(5,2) NOT NULL,
        wind_speed DECIMAL(5,2) NOT NULL,
        source VARCHAR(50) NOT NULL DEFAULT 'IMD',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (time, location)
      );
    `);

    // Convert to TimescaleDB hypertable
    await client.query(`
      SELECT create_hypertable(
        'weather_forecasts', 
        'time',
        if_not_exists => TRUE,
        chunk_time_interval => INTERVAL '1 day'
      );
    `);

    // Create spatial index for location-based queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_weather_location 
      ON weather_forecasts USING GIST (location);
    `);

    // Create index for time-based queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_weather_time 
      ON weather_forecasts (time DESC);
    `);

    // Create composite index for common query patterns
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_weather_time_location 
      ON weather_forecasts (time DESC, location);
    `);

    // Set up data retention policy (keep 2 years of data)
    await client.query(`
      SELECT add_retention_policy(
        'weather_forecasts',
        INTERVAL '2 years',
        if_not_exists => TRUE
      );
    `);

    // Create compression policy (compress data older than 7 days)
    await client.query(`
      ALTER TABLE weather_forecasts SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'location'
      );
    `);

    await client.query(`
      SELECT add_compression_policy(
        'weather_forecasts',
        INTERVAL '7 days',
        if_not_exists => TRUE
      );
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully: weather_forecasts table created');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  
  try {
    console.log('Rolling back migration: dropping weather_forecasts table...');
    
    await client.query('BEGIN');

    // Drop the table (this will also remove the hypertable)
    await client.query(`
      DROP TABLE IF EXISTS weather_forecasts CASCADE;
    `);

    await client.query('COMMIT');
    console.log('Rollback completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rollback failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'up') {
    up()
      .then(() => {
        console.log('Migration completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
      });
  } else if (command === 'down') {
    down()
      .then(() => {
        console.log('Rollback completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Rollback failed:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage: node migration.js [up|down]');
    process.exit(1);
  }
}

module.exports = { up, down };
