/**
 * Data Migration Script: Encrypt Existing PII Data
 * 
 * This script migrates existing plaintext PII data to encrypted format.
 * It processes data in batches to avoid memory issues with large datasets.
 * 
 * Requirements: 15.2
 * 
 * Usage:
 *   ts-node services/shared/database/migrations/migrate-to-encrypted.ts
 * 
 * Environment Variables Required:
 *   - DATABASE_URL: PostgreSQL connection string
 *   - ENCRYPTION_KEY: 256-bit encryption key (64 hex characters)
 */

import { Pool } from 'pg';
import {
  encryptPhone,
  encryptName,
  encryptCoordinates,
} from '../../utils/encryption';

const BATCH_SIZE = 100; // Process 100 records at a time

interface User {
  id: string;
  phone: string | null;
  name: string | null;
}

interface Farm {
  id: string;
  location: string | null; // PostGIS GEOGRAPHY format
}

interface MigrationStats {
  tableName: string;
  totalRecords: number;
  encryptedRecords: number;
  failedRecords: number;
  errors: Array<{ recordId: string; error: string }>;
}

/**
 * Parse PostGIS GEOGRAPHY point format to lat/lon
 * Format: POINT(longitude latitude) or 0101000020E6100000...
 */
function parseGeography(geography: string): { latitude: number; longitude: number } | null {
  if (!geography) return null;

  // Try to parse WKT format: POINT(lon lat)
  const wktMatch = geography.match(/POINT\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)/i);
  if (wktMatch) {
    return {
      longitude: parseFloat(wktMatch[1]),
      latitude: parseFloat(wktMatch[2]),
    };
  }

  // If it's in WKB format, we need to query PostGIS to convert it
  // This will be handled in the migration query itself
  return null;
}

/**
 * Migrate users table: encrypt phone and name
 */
async function migrateUsers(pool: Pool): Promise<MigrationStats> {
  const stats: MigrationStats = {
    tableName: 'users',
    totalRecords: 0,
    encryptedRecords: 0,
    failedRecords: 0,
    errors: [],
  };

  try {
    // Update migration status
    await pool.query(
      `UPDATE encryption_migration_status 
       SET status = 'in_progress', started_at = NOW() 
       WHERE table_name = 'users'`
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE phone IS NOT NULL OR name IS NOT NULL`
    );
    stats.totalRecords = parseInt(countResult.rows[0].count, 10);

    console.log(`Migrating ${stats.totalRecords} user records...`);

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch of users
      const result = await pool.query<User>(
        `SELECT id, phone, name 
         FROM users 
         WHERE (phone IS NOT NULL OR name IS NOT NULL)
           AND (phone_encrypted IS NULL OR name_encrypted IS NULL)
         ORDER BY id
         LIMIT $1 OFFSET $2`,
        [BATCH_SIZE, offset]
      );

      if (result.rows.length === 0) {
        hasMore = false;
        break;
      }

      // Process each user in the batch
      for (const user of result.rows) {
        try {
          let phoneEncrypted: string | null = null;
          let nameEncrypted: string | null = null;

          // Encrypt phone if present
          if (user.phone) {
            phoneEncrypted = encryptPhone(user.phone);
          }

          // Encrypt name if present
          if (user.name) {
            nameEncrypted = encryptName(user.name);
          }

          // Update the record
          await pool.query(
            `UPDATE users 
             SET phone_encrypted = COALESCE($1, phone_encrypted),
                 name_encrypted = COALESCE($2, name_encrypted)
             WHERE id = $3`,
            [phoneEncrypted, nameEncrypted, user.id]
          );

          stats.encryptedRecords++;

          // Log audit entry
          await pool.query(
            `INSERT INTO encryption_audit_log 
             (operation, table_name, column_name, key_version, performed_by, success)
             VALUES ('encrypt', 'users', 'phone,name', 1, 'migration-script', TRUE)`
          );
        } catch (error) {
          stats.failedRecords++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push({ recordId: user.id, error: errorMessage });

          console.error(`Failed to encrypt user ${user.id}:`, errorMessage);

          // Log audit entry for failure
          await pool.query(
            `INSERT INTO encryption_audit_log 
             (operation, table_name, column_name, key_version, performed_by, success, error_message)
             VALUES ('encrypt', 'users', 'phone,name', 1, 'migration-script', FALSE, $1)`,
            [errorMessage]
          );
        }
      }

      offset += BATCH_SIZE;
      console.log(`Processed ${Math.min(offset, stats.totalRecords)} / ${stats.totalRecords} users`);
    }

    // Update migration status
    await pool.query(
      `UPDATE encryption_migration_status 
       SET status = 'completed', 
           completed_at = NOW(),
           total_records = $1,
           encrypted_records = $2,
           failed_records = $3
       WHERE table_name = 'users'`,
      [stats.totalRecords, stats.encryptedRecords, stats.failedRecords]
    );

    console.log(`Users migration completed: ${stats.encryptedRecords} encrypted, ${stats.failedRecords} failed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Users migration failed:', errorMessage);

    await pool.query(
      `UPDATE encryption_migration_status 
       SET status = 'failed', error_message = $1 
       WHERE table_name = 'users'`,
      [errorMessage]
    );

    throw error;
  }

  return stats;
}

/**
 * Migrate farms table: encrypt location coordinates
 */
async function migrateFarms(pool: Pool): Promise<MigrationStats> {
  const stats: MigrationStats = {
    tableName: 'farms',
    totalRecords: 0,
    encryptedRecords: 0,
    failedRecords: 0,
    errors: [],
  };

  try {
    // Update migration status
    await pool.query(
      `UPDATE encryption_migration_status 
       SET status = 'in_progress', started_at = NOW() 
       WHERE table_name = 'farms'`
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM farms WHERE location IS NOT NULL`
    );
    stats.totalRecords = parseInt(countResult.rows[0].count, 10);

    console.log(`Migrating ${stats.totalRecords} farm records...`);

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch of farms with location converted to lat/lon
      const result = await pool.query(
        `SELECT 
           id,
           ST_Y(location::geometry) as latitude,
           ST_X(location::geometry) as longitude
         FROM farms 
         WHERE location IS NOT NULL
           AND (latitude_encrypted IS NULL OR longitude_encrypted IS NULL)
         ORDER BY id
         LIMIT $1 OFFSET $2`,
        [BATCH_SIZE, offset]
      );

      if (result.rows.length === 0) {
        hasMore = false;
        break;
      }

      // Process each farm in the batch
      for (const farm of result.rows) {
        try {
          const { latitude, longitude } = farm;

          if (latitude == null || longitude == null) {
            throw new Error('Invalid coordinates');
          }

          // Encrypt coordinates
          const encrypted = encryptCoordinates(
            parseFloat(latitude),
            parseFloat(longitude)
          );

          // Split encrypted coordinates
          const [latEncrypted, lonEncrypted] = encrypted.split('|');

          // Update the record
          await pool.query(
            `UPDATE farms 
             SET latitude_encrypted = $1,
                 longitude_encrypted = $2
             WHERE id = $3`,
            [latEncrypted, lonEncrypted, farm.id]
          );

          stats.encryptedRecords++;

          // Log audit entry
          await pool.query(
            `INSERT INTO encryption_audit_log 
             (operation, table_name, column_name, key_version, performed_by, success)
             VALUES ('encrypt', 'farms', 'location', 1, 'migration-script', TRUE)`
          );
        } catch (error) {
          stats.failedRecords++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push({ recordId: farm.id, error: errorMessage });

          console.error(`Failed to encrypt farm ${farm.id}:`, errorMessage);

          // Log audit entry for failure
          await pool.query(
            `INSERT INTO encryption_audit_log 
             (operation, table_name, column_name, key_version, performed_by, success, error_message)
             VALUES ('encrypt', 'farms', 'location', 1, 'migration-script', FALSE, $1)`,
            [errorMessage]
          );
        }
      }

      offset += BATCH_SIZE;
      console.log(`Processed ${Math.min(offset, stats.totalRecords)} / ${stats.totalRecords} farms`);
    }

    // Update migration status
    await pool.query(
      `UPDATE encryption_migration_status 
       SET status = 'completed', 
           completed_at = NOW(),
           total_records = $1,
           encrypted_records = $2,
           failed_records = $3
       WHERE table_name = 'farms'`,
      [stats.totalRecords, stats.encryptedRecords, stats.failedRecords]
    );

    console.log(`Farms migration completed: ${stats.encryptedRecords} encrypted, ${stats.failedRecords} failed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Farms migration failed:', errorMessage);

    await pool.query(
      `UPDATE encryption_migration_status 
       SET status = 'failed', error_message = $1 
       WHERE table_name = 'farms'`,
      [errorMessage]
    );

    throw error;
  }

  return stats;
}

/**
 * Main migration function
 */
async function main() {
  console.log('Starting PII data encryption migration...');
  console.log('='.repeat(50));

  // Validate environment variables
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  // Create database connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('Database connection established');

    // Migrate users table
    console.log('\n' + '='.repeat(50));
    console.log('Migrating users table...');
    console.log('='.repeat(50));
    const usersStats = await migrateUsers(pool);

    // Migrate farms table
    console.log('\n' + '='.repeat(50));
    console.log('Migrating farms table...');
    console.log('='.repeat(50));
    const farmsStats = await migrateFarms(pool);

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('Migration Summary');
    console.log('='.repeat(50));
    console.log(`Users: ${usersStats.encryptedRecords}/${usersStats.totalRecords} encrypted, ${usersStats.failedRecords} failed`);
    console.log(`Farms: ${farmsStats.encryptedRecords}/${farmsStats.totalRecords} encrypted, ${farmsStats.failedRecords} failed`);

    if (usersStats.errors.length > 0 || farmsStats.errors.length > 0) {
      console.log('\nErrors:');
      [...usersStats.errors, ...farmsStats.errors].forEach((err) => {
        console.log(`  - Record ${err.recordId}: ${err.error}`);
      });
    }

    console.log('\nMigration completed successfully!');
    console.log('Next steps:');
    console.log('1. Verify encryption: SELECT * FROM encryption_status;');
    console.log('2. Test application with encrypted data');
    console.log('3. After verification, run cleanup script to drop original columns');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { migrateUsers, migrateFarms };
