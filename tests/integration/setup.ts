import { Pool } from 'pg';
import Redis from 'ioredis';

// Test database configuration
export const testDbConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5433'),
  database: process.env.TEST_DB_NAME || 'krishiai_test',
  user: process.env.TEST_DB_USER || 'krishiai_test',
  password: process.env.TEST_DB_PASSWORD || 'test_password_123'
};

// Test Redis configuration
export const testRedisConfig = {
  host: process.env.TEST_REDIS_HOST || 'localhost',
  port: parseInt(process.env.TEST_REDIS_PORT || '6380'),
  password: process.env.TEST_REDIS_PASSWORD || 'test_redis_password'
};

// Global test database pool
export let testDb: Pool;
export let testRedis: Redis;

// Setup before all tests
beforeAll(async () => {
  // Initialize database connection
  testDb = new Pool(testDbConfig);
  
  // Test database connection
  try {
    await testDb.query('SELECT NOW()');
    console.log('✓ Test database connected');
  } catch (error) {
    console.error('✗ Test database connection failed:', error);
    throw error;
  }

  // Initialize Redis connection
  testRedis = new Redis(testRedisConfig);
  
  // Test Redis connection
  try {
    await testRedis.ping();
    console.log('✓ Test Redis connected');
  } catch (error) {
    console.error('✗ Test Redis connection failed:', error);
    throw error;
  }
});

// Cleanup after each test
afterEach(async () => {
  // Clear Redis cache
  await testRedis.flushdb();
  
  // Clean up test data (except seed data)
  await testDb.query('DELETE FROM disease_detections');
  await testDb.query('DELETE FROM crops');
  await testDb.query('DELETE FROM farms WHERE user_id NOT IN (SELECT id FROM users WHERE phone IN (\'+919876543210\', \'+919876543211\'))');
  await testDb.query('DELETE FROM otp_codes');
  await testDb.query('DELETE FROM users WHERE phone NOT IN (\'+919876543210\', \'+919876543211\')');
});

// Cleanup after all tests
afterAll(async () => {
  // Close connections
  await testDb.end();
  await testRedis.quit();
  console.log('✓ Test connections closed');
});

// Helper function to create test user
export async function createTestUser(phone: string, name: string = 'Test User', language: string = 'hi') {
  const result = await testDb.query(
    'INSERT INTO users (phone, name, language) VALUES ($1, $2, $3) RETURNING *',
    [phone, name, language]
  );
  return result.rows[0];
}

// Helper function to create test farm
export async function createTestFarm(userId: string, data: any = {}) {
  const {
    latitude = 19.0760,
    longitude = 72.8777,
    size_hectares = 1.5,
    soil_type = 'Black',
    irrigation_type = 'Borewell'
  } = data;

  const result = await testDb.query(
    `INSERT INTO farms (user_id, location, size_hectares, soil_type, irrigation_type) 
     VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6) 
     RETURNING *`,
    [userId, longitude, latitude, size_hectares, soil_type, irrigation_type]
  );
  return result.rows[0];
}

// Helper function to generate test JWT token
export function generateTestToken(userId: string, phone: string): string {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_123';
  return jwt.sign({ userId, phone }, secret, { expiresIn: '7d' });
}

// Helper function to wait for async operations
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
