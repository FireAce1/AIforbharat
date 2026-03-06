/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create market_prices table
  pgm.createTable('market_prices', {
    time: {
      type: 'timestamptz',
      notNull: true,
    },
    crop_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    market_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    location: {
      type: 'geography(POINT)',
      notNull: true,
    },
    price_per_kg: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    quantity_traded: {
      type: 'decimal(10,2)',
    },
    source: {
      type: 'varchar(50)',
      default: 'agmarknet',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Create primary key
  pgm.addConstraint('market_prices', 'market_prices_pkey', {
    primaryKey: ['time', 'crop_name', 'market_name'],
  });

  // Create TimescaleDB hypertable
  pgm.sql(`
    SELECT create_hypertable('market_prices', 'time', 
      chunk_time_interval => INTERVAL '1 month',
      if_not_exists => TRUE
    );
  `);

  // Create indexes for common queries
  pgm.createIndex('market_prices', 'crop_name');
  pgm.createIndex('market_prices', 'market_name');
  pgm.createIndex('market_prices', 'location', { method: 'gist' });
  pgm.createIndex('market_prices', ['crop_name', 'time'], { name: 'idx_market_prices_crop_time' });

  // Create data retention policy (5 years)
  pgm.sql(`
    SELECT add_retention_policy('market_prices', INTERVAL '5 years', if_not_exists => TRUE);
  `);

  // Create compression policy (compress data older than 1 year)
  pgm.sql(`
    ALTER TABLE market_prices SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'crop_name, market_name'
    );
  `);

  pgm.sql(`
    SELECT add_compression_policy('market_prices', INTERVAL '1 year', if_not_exists => TRUE);
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('market_prices');
};
