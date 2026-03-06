import request from 'supertest';
import express from 'express';
import { testDb, testRedis, wait } from './setup';

// Mock auth service app
const createAuthApp = () => {
  const app = express();
  app.use(express.json());

  // Mock OTP service
  const otpService = {
    async sendOTP(phone: string): Promise<string> {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store in Redis with 5-minute expiry
      await testRedis.setex(`otp:${phone}`, 300, otp);
      await testRedis.setex(`otp:count:${phone}`, 3600, '1');
      
      return otp;
    },

    async verifyOTP(phone: string, code: string): Promise<boolean> {
      const storedOTP = await testRedis.get(`otp:${phone}`);
      if (!storedOTP || storedOTP !== code) {
        return false;
      }
      
      // Delete OTP after verification (single-use)
      await testRedis.del(`otp:${phone}`);
      return true;
    },

    async checkRateLimit(phone: string): Promise<boolean> {
      const count = await testRedis.get(`otp:count:${phone}`);
      return !count || parseInt(count) < 5;
    },

    async incrementRateLimit(phone: string): Promise<void> {
      await testRedis.incr(`otp:count:${phone}`);
      await testRedis.expire(`otp:count:${phone}`, 3600);
    }
  };

  // POST /api/v1/auth/send-otp
  app.post('/api/v1/auth/send-otp', async (req, res) => {
    try {
      const { phone } = req.body;

      // Validate phone number
      if (!phone || !/^\+91[6-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone number' });
      }

      // Check rate limit
      const canSend = await otpService.checkRateLimit(phone);
      if (!canSend) {
        return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
      }

      // Send OTP
      const otp = await otpService.sendOTP(phone);
      await otpService.incrementRateLimit(phone);

      // In test environment, return OTP for verification
      res.json({ 
        message: 'OTP sent successfully',
        otp: process.env.NODE_ENV === 'test' ? otp : undefined
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/auth/verify-otp
  app.post('/api/v1/auth/verify-otp', async (req, res) => {
    try {
      const { phone, otp } = req.body;

      // Validate inputs
      if (!phone || !otp) {
        return res.status(400).json({ error: 'Phone and OTP are required' });
      }

      // Verify OTP
      const isValid = await otpService.verifyOTP(phone, otp);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid or expired OTP' });
      }

      // Create or get user
      let user = await testDb.query('SELECT * FROM users WHERE phone = $1', [phone]);
      
      if (user.rows.length === 0) {
        user = await testDb.query(
          'INSERT INTO users (phone, language) VALUES ($1, $2) RETURNING *',
          [phone, 'hi']
        );
      }

      const userData = user.rows[0];

      // Generate JWT token
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_123';
      const token = jwt.sign(
        { userId: userData.id, phone: userData.phone },
        secret,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: userData.id,
          phone: userData.phone,
          name: userData.name,
          language: userData.language
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/v1/auth/profile (protected)
  app.get('/api/v1/auth/profile', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.substring(7);
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_123';

      const decoded = jwt.verify(token, secret);
      const user = await testDb.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);

      if (user.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user: user.rows[0] });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  return app;
};

describe('Auth Service Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createAuthApp();
  });

  describe('POST /api/v1/auth/send-otp', () => {
    it('should send OTP for valid phone number', async () => {
      const response = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ phone: '+919876543299' })
        .expect(200);

      expect(response.body.message).toBe('OTP sent successfully');
      expect(response.body.otp).toBeDefined();
      expect(response.body.otp).toMatch(/^\d{6}$/);

      // Verify OTP stored in Redis
      const storedOTP = await testRedis.get('otp:+919876543299');
      expect(storedOTP).toBe(response.body.otp);
    });

    it('should reject invalid phone number', async () => {
      const response = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ phone: '1234567890' })
        .expect(400);

      expect(response.body.error).toBe('Invalid phone number');
    });

    it('should enforce rate limiting (5 OTP per hour)', async () => {
      const phone = '+919876543298';

      // Send 5 OTPs
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/send-otp')
          .send({ phone })
          .expect(200);
      }

      // 6th attempt should fail
      const response = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ phone })
        .expect(429);

      expect(response.body.error).toContain('Rate limit exceeded');
    });

    it('should expire OTP after 5 minutes', async () => {
      const phone = '+919876543297';
      
      // Send OTP
      const sendResponse = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ phone })
        .expect(200);

      const otp = sendResponse.body.otp;

      // Set TTL to 1 second for testing
      await testRedis.expire(`otp:${phone}`, 1);
      await wait(1100);

      // Verify OTP should fail
      const verifyResponse = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ phone, otp })
        .expect(401);

      expect(verifyResponse.body.error).toBe('Invalid or expired OTP');
    });
  });

  describe('POST /api/v1/auth/verify-otp', () => {
    it('should verify correct OTP and return JWT token', async () => {
      const phone = '+919876543296';

      // Send OTP
      const sendResponse = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ phone })
        .expect(200);

      const otp = sendResponse.body.otp;

      // Verify OTP
      const verifyResponse = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ phone, otp })
        .expect(200);

      expect(verifyResponse.body.token).toBeDefined();
      expect(verifyResponse.body.user).toBeDefined();
      expect(verifyResponse.body.user.phone).toBe(phone);
      expect(verifyResponse.body.user.language).toBe('hi');

      // Verify user created in database
      const user = await testDb.query('SELECT * FROM users WHERE phone = $1', [phone]);
      expect(user.rows.length).toBe(1);
    });

    it('should reject incorrect OTP', async () => {
      const phone = '+919876543295';

      // Send OTP
      await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ phone })
        .expect(200);

      // Verify with wrong OTP
      const verifyResponse = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ phone, otp: '000000' })
        .expect(401);

      expect(verifyResponse.body.error).toBe('Invalid or expired OTP');
    });

    it('should enforce single-use OTP', async () => {
      const phone = '+919876543294';

      // Send OTP
      const sendResponse = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ phone })
        .expect(200);

      const otp = sendResponse.body.otp;

      // First verification should succeed
      await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ phone, otp })
        .expect(200);

      // Second verification with same OTP should fail
      const secondVerify = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ phone, otp })
        .expect(401);

      expect(secondVerify.body.error).toBe('Invalid or expired OTP');
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    it('should return user profile with valid JWT token', async () => {
      const phone = '+919876543293';

      // Send and verify OTP
      const sendResponse = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ phone })
        .expect(200);

      const verifyResponse = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ phone, otp: sendResponse.body.otp })
        .expect(200);

      const token = verifyResponse.body.token;

      // Get profile
      const profileResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body.user).toBeDefined();
      expect(profileResponse.body.user.phone).toBe(phone);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .expect(401);

      expect(response.body.error).toBe('No token provided');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('Complete Auth Flow', () => {
    it('should complete full authentication flow', async () => {
      const phone = '+919876543292';

      // Step 1: Send OTP
      const sendResponse = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ phone })
        .expect(200);

      expect(sendResponse.body.message).toBe('OTP sent successfully');
      const otp = sendResponse.body.otp;

      // Step 2: Verify OTP and get JWT
      const verifyResponse = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ phone, otp })
        .expect(200);

      expect(verifyResponse.body.token).toBeDefined();
      const token = verifyResponse.body.token;

      // Step 3: Access protected endpoint with JWT
      const profileResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body.user.phone).toBe(phone);
    });
  });
});
