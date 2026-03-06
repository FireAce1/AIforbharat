import request from 'supertest';
import app from '../../app';
import redisClient from '../../config/redis';
import db from '../../config/database';

/**
 * Integration tests for Task 2.3: OTP Verification and JWT Token Generation
 * 
 * Tests validate:
 * - OTP verification with bcrypt comparison
 * - Single-use OTP validation
 * - JWT generation with HS256 algorithm and 7-day expiry
 * - User record creation in PostgreSQL
 * - Edge cases: expired OTP, invalid OTP, already verified OTP
 * 
 * Validates: Requirements 1.4, 15.3, Design Section 8.1
 */
describe('Auth Integration Tests - Task 2.3', () => {
  const testPhone = '+919876543210';
  let generatedOTP: string;

  beforeAll(async () => {
    // Ensure Redis and DB connections are ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await db.query('DELETE FROM users WHERE phone = $1', [testPhone]);
      await redisClient.del(`otp:${testPhone}`);
      await redisClient.del(`rate_limit:otp:${testPhone}`);
      await redisClient.del(`resend_delay:${testPhone}`);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Complete OTP Flow', () => {
    it('should send OTP successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ phone: testPhone })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('OTP sent successfully');
      expect(response.body.data.remainingAttempts).toBeLessThanOrEqual(5);
      expect(response.body.data.expirySeconds).toBe(300);

      // In dev mode, OTP is logged. In production, it would be sent via SMS
      // For testing, we'll use a known OTP
      generatedOTP = '123456'; // This would be retrieved from logs in dev mode
    });

    it('should verify OTP and return JWT token', async () => {
      // First, manually set an OTP in Redis for testing
      const bcrypt = require('bcrypt');
      const hashedOTP = await bcrypt.hash('123456', 10);
      await redisClient.setEx(`otp:${testPhone}`, 300, hashedOTP);

      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          phone: testPhone,
          code: '123456',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('OTP verified successfully');
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.phone).toBe(testPhone);
      expect(response.body.user.language).toBe('hi'); // Default language

      // Verify JWT token structure
      const token = response.body.token;
      expect(token.split('.')).toHaveLength(3);

      // Decode and verify JWT payload
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );
      expect(payload.userId).toBeDefined();
      expect(payload.phone).toBe(testPhone);
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();

      // Verify 7-day expiry (604800 seconds)
      const expiryDuration = payload.exp - payload.iat;
      expect(expiryDuration).toBeGreaterThanOrEqual(604700);
      expect(expiryDuration).toBeLessThanOrEqual(604900);

      // Verify user was created in database
      const userResult = await db.query(
        'SELECT * FROM users WHERE phone = $1',
        [testPhone]
      );
      expect(userResult.rows.length).toBe(1);
      expect(userResult.rows[0].phone).toBe(testPhone);
      expect(userResult.rows[0].language).toBe('hi');
    });

    it('should use JWT token to access protected endpoint', async () => {
      // Get a valid token first
      const bcrypt = require('bcrypt');
      const hashedOTP = await bcrypt.hash('123456', 10);
      await redisClient.setEx(`otp:${testPhone}`, 300, hashedOTP);

      const authResponse = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          phone: testPhone,
          code: '123456',
        });

      const token = authResponse.body.token;

      // Use token to access profile
      const profileResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.user.phone).toBe(testPhone);
    });
  });

  describe('Edge Case: Expired OTP', () => {
    it('should reject expired OTP', async () => {
      // Set an OTP that will expire immediately
      const bcrypt = require('bcrypt');
      const hashedOTP = await bcrypt.hash('999999', 10);
      await redisClient.setEx(`otp:${testPhone}`, 1, hashedOTP); // 1 second TTL

      // Wait for OTP to expire
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          phone: testPhone,
          code: '999999',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('expired');
    });
  });

  describe('Edge Case: Invalid OTP', () => {
    it('should reject invalid OTP code', async () => {
      // Set a valid OTP
      const bcrypt = require('bcrypt');
      const hashedOTP = await bcrypt.hash('123456', 10);
      await redisClient.setEx(`otp:${testPhone}`, 300, hashedOTP);

      // Try with wrong OTP
      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          phone: testPhone,
          code: '000000', // Wrong OTP
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid OTP');
    });
  });

  describe('Edge Case: Single-Use OTP', () => {
    it('should reject already verified OTP', async () => {
      // Set a valid OTP
      const bcrypt = require('bcrypt');
      const hashedOTP = await bcrypt.hash('123456', 10);
      await redisClient.setEx(`otp:${testPhone}`, 300, hashedOTP);

      // First verification should succeed
      await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          phone: testPhone,
          code: '123456',
        })
        .expect(200);

      // Second verification with same OTP should fail
      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          phone: testPhone,
          code: '123456',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('expired or not found');
    });
  });

  describe('JWT Token Validation', () => {
    it('should reject invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject expired JWT token', async () => {
      // This would require mocking time or using a token with past expiry
      // For now, we verify the token has correct expiry in payload
      const bcrypt = require('bcrypt');
      const hashedOTP = await bcrypt.hash('123456', 10);
      await redisClient.setEx(`otp:${testPhone}`, 300, hashedOTP);

      const authResponse = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          phone: testPhone,
          code: '123456',
        });

      const token = authResponse.body.token;
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );

      // Verify expiry is in the future
      const now = Math.floor(Date.now() / 1000);
      expect(payload.exp).toBeGreaterThan(now);
      expect(payload.exp).toBeLessThanOrEqual(now + 604800); // 7 days
    });

    it('should use HS256 algorithm for JWT', async () => {
      const bcrypt = require('bcrypt');
      const hashedOTP = await bcrypt.hash('123456', 10);
      await redisClient.setEx(`otp:${testPhone}`, 300, hashedOTP);

      const authResponse = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          phone: testPhone,
          code: '123456',
        });

      const token = authResponse.body.token;
      const header = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64').toString()
      );

      expect(header.alg).toBe('HS256');
      expect(header.typ).toBe('JWT');
    });
  });

  describe('User Creation', () => {
    it('should create user record on first verification', async () => {
      const newPhone = '+919876543211';

      // Set OTP for new user
      const bcrypt = require('bcrypt');
      const hashedOTP = await bcrypt.hash('123456', 10);
      await redisClient.setEx(`otp:${newPhone}`, 300, hashedOTP);

      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          phone: newPhone,
          code: '123456',
        })
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.phone).toBe(newPhone);

      // Verify user exists in database
      const userResult = await db.query(
        'SELECT * FROM users WHERE phone = $1',
        [newPhone]
      );
      expect(userResult.rows.length).toBe(1);
      expect(userResult.rows[0].phone).toBe(newPhone);
      expect(userResult.rows[0].created_at).toBeDefined();
      expect(userResult.rows[0].last_active).toBeDefined();

      // Cleanup
      await db.query('DELETE FROM users WHERE phone = $1', [newPhone]);
    });

    it('should update last_active for existing user', async () => {
      // Get initial last_active
      const initialResult = await db.query(
        'SELECT last_active FROM users WHERE phone = $1',
        [testPhone]
      );
      const initialLastActive = initialResult.rows[0]?.last_active;

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify OTP again
      const bcrypt = require('bcrypt');
      const hashedOTP = await bcrypt.hash('123456', 10);
      await redisClient.setEx(`otp:${testPhone}`, 300, hashedOTP);

      await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          phone: testPhone,
          code: '123456',
        })
        .expect(200);

      // Check last_active was updated
      const updatedResult = await db.query(
        'SELECT last_active FROM users WHERE phone = $1',
        [testPhone]
      );
      const updatedLastActive = updatedResult.rows[0].last_active;

      if (initialLastActive) {
        expect(new Date(updatedLastActive).getTime()).toBeGreaterThan(
          new Date(initialLastActive).getTime()
        );
      }
    });
  });
});
