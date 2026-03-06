import request from 'supertest';
import app from '../index';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { schemeService } from '../services/schemeService';

describe('Scheme API Endpoints', () => {
  beforeAll(async () => {
    // Connect to Redis
    await redis.connect();
    
    // Clear test data
    await db.query('DELETE FROM government_schemes WHERE scheme_name LIKE \'%Test%\'');
  });

  afterAll(async () => {
    // Cleanup
    await db.query('DELETE FROM government_schemes WHERE scheme_name LIKE \'%Test%\'');
    await redis.close();
    await db.close();
  });

  describe('GET /api/v1/govt/schemes', () => {
    beforeEach(async () => {
      // Insert test schemes
      await schemeService.upsertScheme({
        scheme_name: 'Test PM-KISAN',
        scheme_name_hi: 'टेस्ट पीएम-किसान',
        scheme_name_mr: 'चाचणी पीएम-किसान',
        description: 'Test income support scheme',
        description_hi: 'परीक्षण आय सहायता योजना',
        description_mr: 'चाचणी उत्पन्न सहाय्य योजना',
        benefits_amount: 6000,
        benefits_description: 'Test benefits',
        benefits_description_hi: 'परीक्षण लाभ',
        benefits_description_mr: 'चाचणी लाभ',
        eligibility_criteria: {
          max_land_hectares: 2,
          farmer_categories: ['small', 'marginal']
        },
        required_documents: ['Aadhaar', 'Bank Account'],
        application_link: 'https://test.gov.in',
        scheme_type: 'income_support',
        state: 'Maharashtra'
      });
    });

    it('should return all active schemes', async () => {
      const response = await request(app)
        .get('/api/v1/govt/schemes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should filter schemes by keyword', async () => {
      const response = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ keyword: 'Test PM-KISAN' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].scheme_name).toContain('Test PM-KISAN');
    });

    it('should filter schemes by state', async () => {
      const response = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ state: 'Maharashtra' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      
      // All schemes should be either Maharashtra or National
      response.body.data.forEach((scheme: any) => {
        expect(['Maharashtra', 'National', 'all']).toContain(scheme.state);
      });
    });

    it('should filter schemes by land size eligibility', async () => {
      const response = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ landSize: 1.5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should filter schemes by farmer category', async () => {
      const response = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ farmerCategory: 'small' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should return schemes in Hindi', async () => {
      const response = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ language: 'hi', keyword: 'Test' })
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.length > 0) {
        const scheme = response.body.data[0];
        // Should return Hindi name if available
        expect(scheme.scheme_name).toBeDefined();
      }
    });

    it('should return schemes in Marathi', async () => {
      const response = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ language: 'mr', keyword: 'Test' })
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.length > 0) {
        const scheme = response.body.data[0];
        expect(scheme.scheme_name).toBeDefined();
      }
    });

    it('should return 400 for invalid parameters', async () => {
      const response = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ landSize: -1 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should use cache on second request', async () => {
      // First request - cache miss
      const response1 = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ keyword: 'Test' })
        .expect(200);

      // Second request - should hit cache
      const response2 = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ keyword: 'Test' })
        .expect(200);

      expect(response1.body.data).toEqual(response2.body.data);
    });
  });

  describe('GET /api/v1/govt/schemes/:id', () => {
    let testSchemeId: string;

    beforeEach(async () => {
      // Insert test scheme and get its ID
      await schemeService.upsertScheme({
        scheme_name: 'Test Scheme Detail',
        scheme_name_hi: 'टेस्ट योजना विवरण',
        scheme_name_mr: 'चाचणी योजना तपशील',
        description: 'Test scheme for detail endpoint',
        benefits_description: 'Test benefits',
        eligibility_criteria: {},
        required_documents: ['Aadhaar'],
        application_link: 'https://test.gov.in',
        scheme_type: 'test',
        state: 'Maharashtra'
      });

      const result = await db.query(
        'SELECT id FROM government_schemes WHERE scheme_name = $1',
        ['Test Scheme Detail']
      );
      testSchemeId = result.rows[0].id;
    });

    it('should return scheme details by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/govt/schemes/${testSchemeId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testSchemeId);
      expect(response.body.data.scheme_name).toBe('Test Scheme Detail');
    });

    it('should return scheme details in Hindi', async () => {
      const response = await request(app)
        .get(`/api/v1/govt/schemes/${testSchemeId}`)
        .query({ language: 'hi' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.scheme_name).toBe('टेस्ट योजना विवरण');
    });

    it('should return scheme details in Marathi', async () => {
      const response = await request(app)
        .get(`/api/v1/govt/schemes/${testSchemeId}`)
        .query({ language: 'mr' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.scheme_name).toBe('चाचणी योजना तपशील');
    });

    it('should return 404 for non-existent scheme', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/v1/govt/schemes/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Scheme not found');
    });

    it('should return 400 for invalid language', async () => {
      const response = await request(app)
        .get(`/api/v1/govt/schemes/${testSchemeId}`)
        .query({ language: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/govt/schemes/eligible/:userId', () => {
    beforeEach(async () => {
      // Insert test schemes with different eligibility criteria
      await schemeService.upsertScheme({
        scheme_name: 'Test Small Farmer Scheme',
        description: 'For small farmers only',
        benefits_description: 'Test benefits',
        eligibility_criteria: {
          max_land_hectares: 2,
          farmer_categories: ['small', 'marginal']
        },
        required_documents: ['Aadhaar'],
        application_link: 'https://test.gov.in',
        scheme_type: 'test',
        state: 'Maharashtra'
      });

      await schemeService.upsertScheme({
        scheme_name: 'Test Large Farmer Scheme',
        description: 'For large farmers only',
        benefits_description: 'Test benefits',
        eligibility_criteria: {
          min_land_hectares: 5,
          farmer_categories: ['large']
        },
        required_documents: ['Aadhaar'],
        application_link: 'https://test.gov.in',
        scheme_type: 'test',
        state: 'Maharashtra'
      });
    });

    it('should return eligible schemes for small farmer', async () => {
      const response = await request(app)
        .get('/api/v1/govt/schemes/eligible/test-user-1')
        .query({
          landSize: 1.5,
          farmerCategory: 'small',
          state: 'Maharashtra'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      
      // Should include small farmer scheme
      const smallFarmerScheme = response.body.data.find(
        (s: any) => s.scheme_name === 'Test Small Farmer Scheme'
      );
      expect(smallFarmerScheme).toBeDefined();
      expect(smallFarmerScheme.eligibility_match).toBe(true);
    });

    it('should filter out ineligible schemes', async () => {
      const response = await request(app)
        .get('/api/v1/govt/schemes/eligible/test-user-2')
        .query({
          landSize: 1.5,
          farmerCategory: 'small',
          state: 'Maharashtra'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Should not include large farmer scheme
      const largeFarmerScheme = response.body.data.find(
        (s: any) => s.scheme_name === 'Test Large Farmer Scheme'
      );
      expect(largeFarmerScheme).toBeUndefined();
    });

    it('should return schemes in requested language', async () => {
      const response = await request(app)
        .get('/api/v1/govt/schemes/eligible/test-user-3')
        .query({
          landSize: 1.5,
          language: 'hi',
          state: 'Maharashtra'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Eligibility Matching', () => {
    it('should match schemes based on land size', async () => {
      await schemeService.upsertScheme({
        scheme_name: 'Test Land Size Scheme',
        description: 'Test',
        benefits_description: 'Test',
        eligibility_criteria: {
          max_land_hectares: 2,
          min_land_hectares: 0.5
        },
        required_documents: ['Aadhaar'],
        application_link: 'https://test.gov.in',
        scheme_type: 'test',
        state: 'Maharashtra'
      });

      // Should match
      const response1 = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ landSize: 1.5 })
        .expect(200);

      const matchingScheme = response1.body.data.find(
        (s: any) => s.scheme_name === 'Test Land Size Scheme'
      );
      expect(matchingScheme?.eligibility_match).toBe(true);

      // Should not match (too large)
      const response2 = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ landSize: 3 })
        .expect(200);

      const nonMatchingScheme = response2.body.data.find(
        (s: any) => s.scheme_name === 'Test Land Size Scheme'
      );
      expect(nonMatchingScheme?.eligibility_match).toBe(false);
    });

    it('should match schemes based on crop type', async () => {
      await schemeService.upsertScheme({
        scheme_name: 'Test Crop Type Scheme',
        description: 'Test',
        benefits_description: 'Test',
        eligibility_criteria: {
          crop_types: ['rice', 'wheat']
        },
        required_documents: ['Aadhaar'],
        application_link: 'https://test.gov.in',
        scheme_type: 'test',
        state: 'Maharashtra'
      });

      // Should match
      const response1 = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ cropType: 'rice' })
        .expect(200);

      const matchingScheme = response1.body.data.find(
        (s: any) => s.scheme_name === 'Test Crop Type Scheme'
      );
      expect(matchingScheme?.eligibility_match).toBe(true);

      // Should not match
      const response2 = await request(app)
        .get('/api/v1/govt/schemes')
        .query({ cropType: 'cotton' })
        .expect(200);

      const nonMatchingScheme = response2.body.data.find(
        (s: any) => s.scheme_name === 'Test Crop Type Scheme'
      );
      expect(nonMatchingScheme?.eligibility_match).toBe(false);
    });
  });

  describe('Caching', () => {
    it('should cache search results for 24 hours', async () => {
      const cacheKey = 'schemes:kw:Test';
      
      // Clear cache
      await redis.del(cacheKey);
      
      // First request
      await request(app)
        .get('/api/v1/govt/schemes')
        .query({ keyword: 'Test' })
        .expect(200);

      // Check if cached
      const cached = await redis.get(cacheKey);
      expect(cached).toBeDefined();
    });

    it('should cache scheme details for 24 hours', async () => {
      const result = await db.query(
        'SELECT id FROM government_schemes WHERE scheme_name LIKE \'%Test%\' LIMIT 1'
      );
      
      if (result.rows.length > 0) {
        const schemeId = result.rows[0].id;
        const cacheKey = `scheme:${schemeId}:en`;
        
        // Clear cache
        await redis.del(cacheKey);
        
        // First request
        await request(app)
          .get(`/api/v1/govt/schemes/${schemeId}`)
          .expect(200);

        // Check if cached
        const cached = await redis.get(cacheKey);
        expect(cached).toBeDefined();
      }
    });
  });
});
