import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import {
  otpRateLimiter,
  apiRateLimiter,
  mlRateLimiter,
  strictRateLimiter,
  publicRateLimiter,
  rateLimitHeaders,
} from '../rateLimiter';

describe('Rate Limiter Middleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(rateLimitHeaders);
  });

  describe('OTP Rate Limiter', () => {
    beforeEach(() => {
      app.post('/test-otp', otpRateLimiter, (req: Request, res: Response) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within limit (5 per hour per phone)', async () => {
      const phone = '+919876543210';

      // Make 5 requests - all should succeed
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/test-otp')
          .send({ phone });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.headers['x-ratelimit-limit']).toBe('5');
        expect(response.headers['x-ratelimit-remaining']).toBe(String(4 - i));
      }
    });

    it('should block requests exceeding limit', async () => {
      const phone = '+919876543211';

      // Make 5 successful requests
      for (let i = 0; i < 5; i++) {
        await request(app).post('/test-otp').send({ phone });
      }

      // 6th request should be blocked
      const response = await request(app)
        .post('/test-otp')
        .send({ phone });

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too Many Requests');
      expect(response.body.retryAfter).toBeGreaterThan(0);
      expect(response.headers['retry-after']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
    });

    it('should track different phone numbers separately', async () => {
      const phone1 = '+919876543212';
      const phone2 = '+919876543213';

      // Make 5 requests for phone1
      for (let i = 0; i < 5; i++) {
        await request(app).post('/test-otp').send({ phone: phone1 });
      }

      // phone1 should be blocked
      const response1 = await request(app)
        .post('/test-otp')
        .send({ phone: phone1 });
      expect(response1.status).toBe(429);

      // phone2 should still work
      const response2 = await request(app)
        .post('/test-otp')
        .send({ phone: phone2 });
      expect(response2.status).toBe(200);
    });

    it('should include rate limit headers in response', async () => {
      const phone = '+919876543214';

      const response = await request(app)
        .post('/test-otp')
        .send({ phone });

      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBe('4');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('API Rate Limiter', () => {
    beforeEach(() => {
      app.get('/test-api', apiRateLimiter, (req: Request, res: Response) => {
        res.json({ success: true });
      });
    });

    it('should allow 1000 requests per hour per user', async () => {
      // Make 10 requests - all should succeed
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/test-api');

        expect(response.status).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBe('1000');
      }
    });

    it('should include correct remaining count', async () => {
      const response1 = await request(app).get('/test-api');
      expect(response1.headers['x-ratelimit-remaining']).toBe('999');

      const response2 = await request(app).get('/test-api');
      expect(response2.headers['x-ratelimit-remaining']).toBe('998');
    });
  });

  describe('ML Rate Limiter', () => {
    beforeEach(() => {
      app.post('/test-ml', mlRateLimiter, (req: Request, res: Response) => {
        res.json({ success: true });
      });
    });

    it('should allow 50 requests per hour per user', async () => {
      // Make 10 requests - all should succeed
      for (let i = 0; i < 10; i++) {
        const response = await request(app).post('/test-ml').send({});

        expect(response.status).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBe('50');
      }
    });

    it('should block after 50 requests', async () => {
      // Make 50 successful requests
      for (let i = 0; i < 50; i++) {
        await request(app).post('/test-ml').send({});
      }

      // 51st request should be blocked
      const response = await request(app).post('/test-ml').send({});

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too Many Requests');
      expect(response.body.limit).toBe(50);
      expect(response.body.remaining).toBe(0);
    });
  });

  describe('Strict Rate Limiter', () => {
    beforeEach(() => {
      app.post('/test-strict', strictRateLimiter, (req: Request, res: Response) => {
        res.json({ success: true });
      });
    });

    it('should allow 10 requests per hour per user', async () => {
      // Make 10 requests - all should succeed
      for (let i = 0; i < 10; i++) {
        const response = await request(app).post('/test-strict').send({});

        expect(response.status).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBe('10');
      }
    });

    it('should block after 10 requests', async () => {
      // Make 10 successful requests
      for (let i = 0; i < 10; i++) {
        await request(app).post('/test-strict').send({});
      }

      // 11th request should be blocked
      const response = await request(app).post('/test-strict').send({});

      expect(response.status).toBe(429);
      expect(response.body.limit).toBe(10);
    });
  });

  describe('Public Rate Limiter', () => {
    beforeEach(() => {
      app.get('/test-public', publicRateLimiter, (req: Request, res: Response) => {
        res.json({ success: true });
      });
    });

    it('should allow 100 requests per hour per IP', async () => {
      // Make 10 requests - all should succeed
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/test-public');

        expect(response.status).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBe('100');
      }
    });
  });

  describe('Rate Limit Headers', () => {
    beforeEach(() => {
      app.get('/test-headers', apiRateLimiter, (req: Request, res: Response) => {
        res.json({ success: true });
      });
    });

    it('should include all required rate limit headers', async () => {
      const response = await request(app).get('/test-headers');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should include Retry-After header when rate limited', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 1000; i++) {
        await request(app).get('/test-headers');
      }

      const response = await request(app).get('/test-headers');

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('Error Response Format', () => {
    beforeEach(() => {
      app.post('/test-error', otpRateLimiter, (req: Request, res: Response) => {
        res.json({ success: true });
      });
    });

    it('should return proper error format when rate limited', async () => {
      const phone = '+919876543215';

      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        await request(app).post('/test-error').send({ phone });
      }

      const response = await request(app)
        .post('/test-error')
        .send({ phone });

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('retryAfter');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('remaining');
      expect(response.body).toHaveProperty('resetTime');

      expect(response.body.error).toBe('Too Many Requests');
      expect(response.body.remaining).toBe(0);
      expect(response.body.limit).toBe(5);
    });
  });
});
