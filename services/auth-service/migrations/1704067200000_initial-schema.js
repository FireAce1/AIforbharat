/* eslint-disable camelcase */

/**
 * Initial database schema migration for KrishiAI platform
 * Creates core tables: users, otp_codes, farms, crops, disease_detections
 * Creates TimescaleDB hypertables: market_prices, weather_forecasts
 * Adds performance indexes and data retention policies
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Enable required extensions
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS timescaledb');
  
  // Try to enable PostGIS, but continue if not available
  // Note: PostGIS may not be available in all TimescaleDB images
  // We'll use alternative approach with lat/lng columns if PostGIS is not available
  try {
    pgm.sql('CREATE EXTENSION IF NOT EXISTS postgis');
  } catch (error) {
    console.log('PostGIS not available, using lat/lng columns instead');
  }

  // ============================================
  // Core Tables
  // ============================================

  // Users table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    phone: {
      type: 'varchar(15)',
      notNull: true,
      unique: true,
    },
    name: {
      type: 'varchar(100)',
    },
    language: {
      type: 'varchar(5)',
      default: 'hi',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    last_active: {
      type: 'timestamp',
    },
  });

  // Create index for phone lookup
  pgm.createIndex('users', 'phone', {
    name: 'idx_users_phone',
  });

  // OTP codes table
  pgm.createTable('otp_codes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    phone: {
      type: 'varchar(15)',
      notNull: true,
    },
    code: {
      type: 'varchar(6)',
      notNull: true,
    },
    expires_at: {
      type: 'timestamp',
      notNull: true,
    },
    verified: {
      type: 'boolean',
      default: false,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create composite index for phone and expiry lookup
  pgm.createIndex('otp_codes', ['phone', 'expires_at'], {
    name: 'idx_otp_phone_expires',
  });

  // Farms table with geospatial support
  pgm.createTable('farms', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    latitude: {
      type: 'decimal(10,8)',
      comment: 'Latitude coordinate (-90 to 90)',
    },
    longitude: {
      type: 'decimal(11,8)',
      comment: 'Longitude coordinate (-180 to 180)',
    },
    size_hectares: {
      type: 'decimal(10,2)',
    },
    soil_type: {
      type: 'varchar(50)',
    },
    irrigation_type: {
      type: 'varchar(50)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create index for user lookup
  pgm.createIndex('farms', 'user_id', {
    name: 'idx_farms_user',
  });

  // Create composite index for geospatial queries (lat/lng)
  pgm.createIndex('farms', ['latitude', 'longitude'], {
    name: 'idx_farms_location',
    method: 'btree',
  });

  // Crops table
  pgm.createTable('crops', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    farm_id: {
      type: 'uuid',
      notNull: true,
      references: 'farms(id)',
      onDelete: 'CASCADE',
    },
    crop_name: {
      type: 'varchar(100)',
    },
    variety: {
      type: 'varchar(100)',
    },
    sowing_date: {
      type: 'date',
    },
    expected_harvest: {
      type: 'date',
    },
    status: {
      type: 'varchar(20)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create index for farm lookup
  pgm.createIndex('crops', 'farm_id', {
    name: 'idx_crops_farm',
  });

  // Disease detections table
  pgm.createTable('disease_detections', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    crop_id: {
      type: 'uuid',
      notNull: true,
      references: 'crops(id)',
      onDelete: 'CASCADE',
    },
    image_url: {
      type: 'varchar(500)',
    },
    disease_name: {
      type: 'varchar(100)',
    },
    confidence: {
      type: 'decimal(5,4)',
    },
    severity: {
      type: 'varchar(20)',
    },
    detected_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create index for crop lookup
  pgm.createIndex('disease_detections', 'crop_id', {
    name: 'idx_disease_crop',
  });

  // Create index for time-based queries
  pgm.createIndex('disease_detections', 'detected_at', {
    name: 'idx_disease_time',
    method: 'btree',
  });

  // ============================================
  // TimescaleDB Hypertables
  // ============================================

  // Market prices table (time-series data)
  pgm.createTable('market_prices', {
    time: {
      type: 'timestamptz',
      notNull: true,
    },
    crop_name: {
      type: 'varchar(100)',
    },
    market_name: {
      type: 'varchar(100)',
    },
    latitude: {
      type: 'decimal(10,8)',
      comment: 'Market latitude coordinate',
    },
    longitude: {
      type: 'decimal(11,8)',
      comment: 'Market longitude coordinate',
    },
    price_per_kg: {
      type: 'decimal(10,2)',
    },
    quantity_traded: {
      type: 'decimal(10,2)',
    },
  });

  // Convert to TimescaleDB hypertable with time partitioning
  pgm.sql(`
    SELECT create_hypertable(
      'market_prices',
      'time',
      if_not_exists => TRUE,
      chunk_time_interval => INTERVAL '1 week'
    )
  `);

  // Create composite index for time-series queries
  pgm.createIndex('market_prices', ['time', 'crop_name'], {
    name: 'idx_market_prices_time_crop',
    method: 'btree',
  });

  // Create composite index for location-based queries
  pgm.createIndex('market_prices', ['latitude', 'longitude'], {
    name: 'idx_market_prices_location',
    method: 'btree',
  });

  // Weather forecasts table (time-series data)
  pgm.createTable('weather_forecasts', {
    time: {
      type: 'timestamptz',
      notNull: true,
    },
    latitude: {
      type: 'decimal(10,8)',
      comment: 'Forecast location latitude',
    },
    longitude: {
      type: 'decimal(11,8)',
      comment: 'Forecast location longitude',
    },
    temperature: {
      type: 'decimal(5,2)',
    },
    rainfall: {
      type: 'decimal(5,2)',
    },
    humidity: {
      type: 'decimal(5,2)',
    },
    wind_speed: {
      type: 'decimal(5,2)',
    },
    source: {
      type: 'varchar(50)',
    },
  });

  // Convert to TimescaleDB hypertable with time partitioning
  pgm.sql(`
    SELECT create_hypertable(
      'weather_forecasts',
      'time',
      if_not_exists => TRUE,
      chunk_time_interval => INTERVAL '1 day'
    )
  `);

  // Create composite index for time-series queries
  pgm.createIndex('weather_forecasts', 'time', {
    name: 'idx_weather_time',
    method: 'btree',
  });

  // Create composite index for location-based queries
  pgm.createIndex('weather_forecasts', ['latitude', 'longitude'], {
    name: 'idx_weather_location',
    method: 'btree',
  });

  // ============================================
  // Data Retention Policies
  // ============================================

  // Market prices: retain for 5 years
  pgm.sql(`
    SELECT add_retention_policy(
      'market_prices',
      INTERVAL '5 years',
      if_not_exists => TRUE
    )
  `);

  // Weather forecasts: retain for 2 years
  pgm.sql(`
    SELECT add_retention_policy(
      'weather_forecasts',
      INTERVAL '2 years',
      if_not_exists => TRUE
    )
  `);

  // ============================================
  // Additional Performance Indexes
  // ============================================

  // Index for market price trend analysis
  pgm.createIndex('market_prices', ['crop_name', 'market_name', 'time'], {
    name: 'idx_market_prices_trend',
    method: 'btree',
  });

  // Index for weather forecast by source
  pgm.createIndex('weather_forecasts', ['source', 'time'], {
    name: 'idx_weather_source_time',
    method: 'btree',
  });

  // Comment on tables for documentation
  pgm.sql(`
    COMMENT ON TABLE users IS 'User accounts and profiles';
    COMMENT ON TABLE otp_codes IS 'OTP verification codes with 5-minute expiry';
    COMMENT ON TABLE farms IS 'Farm information with geospatial data';
    COMMENT ON TABLE crops IS 'Crop planting records';
    COMMENT ON TABLE disease_detections IS 'Disease detection history from AI model';
    COMMENT ON TABLE market_prices IS 'Historical market price data (TimescaleDB hypertable)';
    COMMENT ON TABLE weather_forecasts IS 'Weather forecast data (TimescaleDB hypertable)';
  `);
};

exports.down = (pgm) => {
  // Drop retention policies first
  pgm.sql(`
    SELECT remove_retention_policy('market_prices', if_exists => TRUE);
    SELECT remove_retention_policy('weather_forecasts', if_exists => TRUE);
  `);

  // Drop tables in reverse order (respecting foreign key constraints)
  pgm.dropTable('disease_detections', { ifExists: true, cascade: true });
  pgm.dropTable('crops', { ifExists: true, cascade: true });
  pgm.dropTable('farms', { ifExists: true, cascade: true });
  pgm.dropTable('otp_codes', { ifExists: true, cascade: true });
  pgm.dropTable('weather_forecasts', { ifExists: true, cascade: true });
  pgm.dropTable('market_prices', { ifExists: true, cascade: true });
  pgm.dropTable('users', { ifExists: true, cascade: true });

  // Note: We don't drop extensions as they might be used by other schemas
};
