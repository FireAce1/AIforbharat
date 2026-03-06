/**
 * Migration: Create price_alerts table
 * 
 * This table stores user price alert subscriptions for SMS notifications
 * when target prices are reached.
 */

exports.up = async (pgm) => {
  // Create price_alerts table
  pgm.createTable('price_alerts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
    },
    phone: {
      type: 'varchar(15)',
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
    target_price: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    alert_type: {
      type: 'varchar(10)',
      notNull: true,
      check: "alert_type IN ('above', 'below')",
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create indexes for efficient queries
  pgm.createIndex('price_alerts', 'user_id');
  pgm.createIndex('price_alerts', 'is_active');
  pgm.createIndex('price_alerts', ['crop_name', 'market_name']);
  pgm.createIndex('price_alerts', ['is_active', 'crop_name', 'market_name']);

  // Create updated_at trigger
  pgm.createFunction(
    'update_updated_at_column',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true,
    },
    `
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    `
  );

  pgm.createTrigger('price_alerts', 'update_price_alerts_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });
};

exports.down = async (pgm) => {
  pgm.dropTable('price_alerts', { cascade: true });
  pgm.dropFunction('update_updated_at_column', [], { cascade: true });
};
