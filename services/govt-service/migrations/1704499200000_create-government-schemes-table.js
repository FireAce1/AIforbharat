/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create government_schemes table with multilingual support
  pgm.createTable('government_schemes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    scheme_name: {
      type: 'varchar(200)',
      notNull: true,
    },
    scheme_name_hi: {
      type: 'varchar(200)',
    },
    scheme_name_mr: {
      type: 'varchar(200)',
    },
    description: {
      type: 'text',
    },
    description_hi: {
      type: 'text',
    },
    description_mr: {
      type: 'text',
    },
    benefits_amount: {
      type: 'decimal(12,2)',
    },
    benefits_description: {
      type: 'text',
    },
    benefits_description_hi: {
      type: 'text',
    },
    benefits_description_mr: {
      type: 'text',
    },
    eligibility_criteria: {
      type: 'jsonb',
    },
    required_documents: {
      type: 'jsonb',
    },
    application_deadline: {
      type: 'date',
    },
    application_link: {
      type: 'varchar(500)',
    },
    scheme_type: {
      type: 'varchar(50)',
    },
    state: {
      type: 'varchar(50)',
    },
    is_active: {
      type: 'boolean',
      default: true,
    },
    last_updated: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create indexes for efficient querying
  pgm.createIndex('government_schemes', 'scheme_type');
  pgm.createIndex('government_schemes', 'state');
  pgm.createIndex('government_schemes', 'application_deadline');
  pgm.createIndex('government_schemes', 'is_active');
  
  // Full-text search index on scheme names and descriptions
  pgm.sql(`
    CREATE INDEX idx_schemes_search ON government_schemes 
    USING gin(to_tsvector('english', 
      coalesce(scheme_name, '') || ' ' || 
      coalesce(description, '') || ' ' ||
      coalesce(scheme_name_hi, '') || ' ' ||
      coalesce(scheme_name_mr, '')
    ));
  `);

  // Create scheme_subscriptions table for deadline alerts
  pgm.createTable('scheme_subscriptions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    scheme_id: {
      type: 'uuid',
      notNull: true,
      references: 'government_schemes',
      onDelete: 'CASCADE',
    },
    subscribed_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    notification_sent: {
      type: 'boolean',
      default: false,
    },
  });

  // Unique constraint to prevent duplicate subscriptions
  pgm.addConstraint('scheme_subscriptions', 'unique_user_scheme', {
    unique: ['user_id', 'scheme_id'],
  });

  // Index for efficient subscription queries
  pgm.createIndex('scheme_subscriptions', ['user_id', 'scheme_id']);
};

exports.down = (pgm) => {
  pgm.dropTable('scheme_subscriptions', { cascade: true });
  pgm.dropTable('government_schemes', { cascade: true });
};
