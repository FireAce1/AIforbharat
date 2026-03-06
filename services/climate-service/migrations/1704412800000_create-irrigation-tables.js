/**
 * Migration: Create irrigation recommendations and water savings tracking tables
 * Timestamp: 1704412800000 (2024-01-05)
 */

exports.up = async function (knex) {
  // Create irrigation_recommendations table
  await knex.schema.createTable('irrigation_recommendations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('farm_id').notNullable();
    table.uuid('crop_id').notNullable();
    table.date('recommendation_date').notNullable();
    table.boolean('should_irrigate').notNullable();
    table.decimal('water_amount_mm', 5, 2);
    table.string('timing', 20); // 'morning' or 'evening'
    table.decimal('water_saved_mm', 5, 2);
    table.string('calculation_method', 50).defaultTo('FAO-56');
    table.text('reason');
    table.decimal('etc', 5, 2); // Crop evapotranspiration
    table.decimal('effective_rainfall', 5, 2);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['farm_id', 'recommendation_date'], 'idx_farm_date');
    table.index('crop_id', 'idx_crop');
    table.index('recommendation_date', 'idx_recommendation_date');
    
    // Unique constraint to prevent duplicate recommendations for same farm on same date
    table.unique(['farm_id', 'recommendation_date'], 'uq_farm_recommendation_date');
  });

  // Create water_savings_tracking table
  await knex.schema.createTable('water_savings_tracking', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('farm_id').notNullable();
    table.date('period_start').notNullable();
    table.date('period_end').notNullable();
    table.decimal('total_water_saved_mm', 10, 2);
    table.decimal('traditional_usage_mm', 10, 2);
    table.decimal('optimized_usage_mm', 10, 2);
    table.decimal('savings_percentage', 5, 2);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['farm_id', 'period_start', 'period_end'], 'idx_farm_period');
    table.index('period_start', 'idx_period_start');
  });

  console.log('Created irrigation_recommendations and water_savings_tracking tables');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('water_savings_tracking');
  await knex.schema.dropTableIfExists('irrigation_recommendations');
  console.log('Dropped irrigation_recommendations and water_savings_tracking tables');
};
