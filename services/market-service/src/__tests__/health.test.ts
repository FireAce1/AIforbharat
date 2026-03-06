import request from 'supertest';
import express, { Application } from 'express';
import healthRoutes from '../routes/health';

// Mock dependencies
jest.mock('../config/database', () => ({
  database: {
    query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
  },
}));

jest.mock('../config/redis', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../services/cronService', () => ({
  cronService: {
    getStatus: jest.fn().mockReturnValue([
      { name: 'priceUpdate', running: true },
    ]),
  },
}));

describe('Health Routes', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(healthRoutes);
  });

  describe('GET /health', () => {
    it('should return healthy status when all services are up', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'market-service');
      expect(response.body.checks).toHaveProperty('database', 'connected');
      expect(response.body.checks).toHaveProperty('redis', 'connected');
      expect(response.body.checks.cronJobs).toHaveLength(1);
    });
  });

  describe('GET /ready', () => {
    it('should return ready status when database is connected', async () => {
      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ready');
    });
  });
});
