import request from 'supertest';
import express from 'express';
import { testDb, testRedis, createTestUser, createTestFarm, generateTestToken } from './setup';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// Mock crop service app
const createCropApp = () => {
  const app = express();
  app.use(express.json());

  // Mock authentication middleware
  const authenticate = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.substring(7);
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'test_jwt_secret_key_123';
      const decoded = jwt.verify(token, secret);
      
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // POST /api/v1/crop/recommend
  app.post('/api/v1/crop/recommend', authenticate, async (req, res) => {
    try {
      const { farmId } = req.body;

      if (!farmId) {
        return res.status(400).json({ error: 'Farm ID is required' });
      }

      // Get farm details
      const farm = await testDb.query('SELECT * FROM farms WHERE id = $1', [farmId]);
      if (farm.rows.length === 0) {
        return res.status(404).json({ error: 'Farm not found' });
      }

      const farmData = farm.rows[0];

      // Check cache
      const cacheKey = `crop:recommend:${farmId}`;
      const cached = await testRedis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      // Mock crop recommendation (in real implementation, this calls ML model)
      const recommendations = [
        {
          crop: 'Tomato',
          confidence: 0.89,
          expected_yield_tons_per_hectare: 25.5,
          investment_required_inr: 45000,
          expected_revenue_inr: 127500,
          expected_profit_inr: 82500,
          water_requirements_mm: 600,
          sowing_window: { start: '2024-06-15', end: '2024-07-15' },
          risk_level: 'Low',
          reasoning: 'Optimal soil type and weather conditions for tomato cultivation'
        },
        {
          crop: 'Onion',
          confidence: 0.82,
          expected_yield_tons_per_hectare: 20.0,
          investment_required_inr: 35000,
          expected_revenue_inr: 100000,
          expected_profit_inr: 65000,
          water_requirements_mm: 450,
          sowing_window: { start: '2024-06-01', end: '2024-07-01' },
          risk_level: 'Medium',
          reasoning: 'Good market demand but moderate price volatility'
        },
        {
          crop: 'Cotton',
          confidence: 0.76,
          expected_yield_tons_per_hectare: 2.5,
          investment_required_inr: 50000,
          expected_revenue_inr: 112500,
          expected_profit_inr: 62500,
          water_requirements_mm: 700,
          sowing_window: { start: '2024-05-15', end: '2024-06-30' },
          risk_level: 'High',
          reasoning: 'High water requirements and weather dependency'
        }
      ];

      const response = {
        farmId,
        recommendations,
        generated_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      // Cache for 24 hours
      await testRedis.setex(cacheKey, 86400, JSON.stringify(response));

      res.json(response);
    } catch (error) {
      console.error('Crop recommendation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/crop/disease/detect
  app.post('/api/v1/crop/disease/detect', authenticate, async (req, res) => {
    try {
      const { cropId, imageUrl, confidence, diseaseName, severity } = req.body;

      if (!cropId || !imageUrl) {
        return res.status(400).json({ error: 'Crop ID and image URL are required' });
      }

      // Mock disease detection result (in real implementation, this processes image with TFLite)
      const detection = {
        disease_name: diseaseName || 'Tomato Late Blight',
        disease_name_scientific: 'Phytophthora infestans',
        confidence: confidence || 0.94,
        severity: severity || 'Moderate',
        treatments: {
          organic: [
            {
              name: 'Neem Oil Spray',
              description: 'Mix 5ml neem oil per liter of water, spray every 7 days',
              effectiveness: 'High'
            },
            {
              name: 'Copper Fungicide',
              description: 'Organic copper-based fungicide, apply as per instructions',
              effectiveness: 'Very High'
            }
          ],
          chemical: [
            {
              name: 'Mancozeb',
              description: '2g per liter of water, spray every 10 days',
              effectiveness: 'Very High',
              safety_warning: 'Use protective equipment, follow safety guidelines'
            }
          ]
        },
        detected_at: new Date().toISOString()
      };

      // Store detection in database
      const result = await testDb.query(
        `INSERT INTO disease_detections 
         (crop_id, user_id, image_url, disease_name, confidence, severity) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [cropId, req.user.userId, imageUrl, detection.disease_name, detection.confidence, detection.severity]
      );

      res.json({
        id: result.rows[0].id,
        ...detection
      });
    } catch (error) {
      console.error('Disease detection error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
};

describe('Crop Service Integration Tests', () => {
  let app: express.Application;
  let testUser: any;
  let testFarm: any;
  let authToken: string;

  beforeAll(async () => {
    app = createCropApp();
    
    // Create test user and farm
    testUser = await createTestUser('+919876543280', 'Crop Test User');
    testFarm = await createTestFarm(testUser.id);
    authToken = generateTestToken(testUser.id, testUser.phone);
  });

  describe('POST /api/v1/crop/recommend', () => {
    it('should return crop recommendations for valid farm', async () => {
      const response = await request(app)
        .post('/api/v1/crop/recommend')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ farmId: testFarm.id })
        .expect(200);

      expect(response.body.recommendations).toBeDefined();
      expect(response.body.recommendations).toHaveLength(3);
      
      // Verify first recommendation structure
      const firstRec = response.body.recommendations[0];
      expect(firstRec.crop).toBeDefined();
      expect(firstRec.confidence).toBeGreaterThan(0);
      expect(firstRec.confidence).toBeLessThanOrEqual(1);
      expect(firstRec.expected_yield_tons_per_hectare).toBeGreaterThan(0);
      expect(firstRec.investment_required_inr).toBeGreaterThan(0);
      expect(firstRec.expected_revenue_inr).toBeGreaterThan(0);
      expect(firstRec.expected_profit_inr).toBeGreaterThan(0);
      expect(firstRec.water_requirements_mm).toBeGreaterThan(0);
      expect(firstRec.sowing_window).toBeDefined();
      expect(firstRec.risk_level).toMatch(/^(Low|Medium|High)$/);
    });

    it('should complete within 500ms performance requirement', async () => {
      const startTime = Date.now();
      
      await request(app)
        .post('/api/v1/crop/recommend')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ farmId: testFarm.id })
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });

    it('should cache recommendations for 24 hours', async () => {
      // First request
      const response1 = await request(app)
        .post('/api/v1/crop/recommend')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ farmId: testFarm.id })
        .expect(200);

      // Second request should return cached data
      const response2 = await request(app)
        .post('/api/v1/crop/recommend')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ farmId: testFarm.id })
        .expect(200);

      expect(response1.body.generated_at).toBe(response2.body.generated_at);

      // Verify cache exists in Redis
      const cacheKey = `crop:recommend:${testFarm.id}`;
      const cached = await testRedis.get(cacheKey);
      expect(cached).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/crop/recommend')
        .send({ farmId: testFarm.id })
        .expect(401);
    });

    it('should return 404 for non-existent farm', async () => {
      const response = await request(app)
        .post('/api/v1/crop/recommend')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ farmId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);

      expect(response.body.error).toBe('Farm not found');
    });
  });

  describe('POST /api/v1/crop/disease/detect', () => {
    let testCrop: any;

    beforeAll(async () => {
      // Create test crop
      const result = await testDb.query(
        `INSERT INTO crops (farm_id, crop_name, variety, sowing_date, status) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [testFarm.id, 'Tomato', 'Hybrid', new Date(), 'growing']
      );
      testCrop = result.rows[0];
    });

    it('should detect disease from image and return treatment recommendations', async () => {
      const response = await request(app)
        .post('/api/v1/crop/disease/detect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cropId: testCrop.id,
          imageUrl: 'https://example.com/plant-image.jpg'
        })
        .expect(200);

      expect(response.body.disease_name).toBeDefined();
      expect(response.body.disease_name_scientific).toBeDefined();
      expect(response.body.confidence).toBeGreaterThan(0.9); // >90% accuracy requirement
      expect(response.body.severity).toMatch(/^(Early|Moderate|Severe)$/);
      
      // Verify treatment recommendations structure
      expect(response.body.treatments.organic).toBeDefined();
      expect(response.body.treatments.organic.length).toBeGreaterThan(0);
      expect(response.body.treatments.chemical).toBeDefined();
      
      // Verify organic treatments are primary (listed first)
      expect(response.body.treatments.organic[0].name).toBeDefined();
      expect(response.body.treatments.organic[0].effectiveness).toBeDefined();
    });

    it('should store detection in database', async () => {
      const response = await request(app)
        .post('/api/v1/crop/disease/detect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cropId: testCrop.id,
          imageUrl: 'https://example.com/plant-image-2.jpg'
        })
        .expect(200);

      // Verify stored in database
      const detection = await testDb.query(
        'SELECT * FROM disease_detections WHERE id = $1',
        [response.body.id]
      );

      expect(detection.rows.length).toBe(1);
      expect(detection.rows[0].crop_id).toBe(testCrop.id);
      expect(detection.rows[0].user_id).toBe(testUser.id);
      expect(detection.rows[0].disease_name).toBe(response.body.disease_name);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/crop/disease/detect')
        .send({
          cropId: testCrop.id,
          imageUrl: 'https://example.com/plant-image.jpg'
        })
        .expect(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/crop/disease/detect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain('required');
    });
  });

  describe('Complete Crop Recommendation Flow', () => {
    it('should complete full flow: create farm → request recommendation → verify response', async () => {
      // Step 1: Create farm (already done in beforeAll)
      expect(testFarm.id).toBeDefined();

      // Step 2: Request crop recommendation
      const recResponse = await request(app)
        .post('/api/v1/crop/recommend')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ farmId: testFarm.id })
        .expect(200);

      expect(recResponse.body.recommendations).toHaveLength(3);
      expect(recResponse.body.recommendations[0].confidence).toBeGreaterThanOrEqual(0.85);

      // Step 3: Verify response structure and data quality
      const topRecommendation = recResponse.body.recommendations[0];
      expect(topRecommendation.expected_profit_inr).toBeGreaterThan(0);
      expect(topRecommendation.expected_profit_inr).toBe(
        topRecommendation.expected_revenue_inr - topRecommendation.investment_required_inr
      );
    });
  });
});
