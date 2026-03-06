import { Router, Request, Response } from 'express';
import { schemeService, SchemeFilter } from '../services/schemeService';
import { logger } from '../utils/logger';
import { redisClient } from '../config/redis';
import CacheMiddleware, { CachePresets } from '../../../shared/middleware/cacheMiddleware';
import { apiRateLimiter } from '../../../shared/middleware/rateLimiter';
import Joi from 'joi';

const router = Router();

// Initialize cache middleware
const cacheMiddleware = new CacheMiddleware(redisClient, 'govt');

/**
 * Validation schema for scheme search
 */
const searchSchemaValidator = Joi.object({
  keyword: Joi.string().min(2).max(100).optional(),
  landSize: Joi.number().min(0).max(1000).optional(),
  cropType: Joi.string().max(50).optional(),
  state: Joi.string().max(50).optional(),
  district: Joi.string().max(50).optional(),
  farmerCategory: Joi.string().valid('small', 'marginal', 'medium', 'large').optional(),
  language: Joi.string().valid('hi', 'mr', 'en').optional().default('en')
});

/**
 * Validation schema for scheme subscription
 */
const subscriptionSchemaValidator = Joi.object({
  userId: Joi.string().uuid().required(),
  schemeId: Joi.string().uuid().required()
});

/**
 * GET /api/v1/govt/schemes
 * Search and filter government schemes
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.get('/', apiRateLimiter, cacheMiddleware.cache(CachePresets.SCHEMES), async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const { error, value } = searchSchemaValidator.validate(req.query);
    
    if (error) {
      logger.warn('Invalid scheme search parameters:', error.details);
      return res.status(400).json({
        success: false,
        error: 'Invalid search parameters',
        details: error.details.map(d => d.message)
      });
    }

    const filter: SchemeFilter = value;

    logger.info('Searching schemes with filter:', filter);

    const schemes = await schemeService.searchSchemes(filter);

    res.json({
      success: true,
      count: schemes.length,
      data: schemes
    });
  } catch (error) {
    logger.error('Error in GET /schemes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search schemes'
    });
  }
});

/**
 * GET /api/v1/govt/schemes/:id
 * Get scheme details by ID
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.get('/:id', apiRateLimiter, cacheMiddleware.cache(CachePresets.SCHEMES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const language = (req.query.language as 'hi' | 'mr' | 'en') || 'en';

    // Validate language parameter
    if (!['hi', 'mr', 'en'].includes(language)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid language parameter. Must be hi, mr, or en'
      });
    }

    logger.info(`Getting scheme ${id} in language ${language}`);

    const scheme = await schemeService.getSchemeById(id, language);

    if (!scheme) {
      return res.status(404).json({
        success: false,
        error: 'Scheme not found'
      });
    }

    res.json({
      success: true,
      data: scheme
    });
  } catch (error) {
    logger.error('Error in GET /schemes/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheme details'
    });
  }
});

/**
 * GET /api/v1/govt/schemes/eligible/:userId
 * Get schemes eligible for a specific user based on their farm profile
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.get('/eligible/:userId', apiRateLimiter, cacheMiddleware.cache(CachePresets.SCHEMES), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const language = (req.query.language as 'hi' | 'mr' | 'en') || 'en';

    logger.info(`Getting eligible schemes for user ${userId}`);

    // TODO: Fetch user's farm profile from database
    // For now, we'll use query parameters as a workaround
    const filter: SchemeFilter = {
      landSize: req.query.landSize ? parseFloat(req.query.landSize as string) : undefined,
      cropType: req.query.cropType as string,
      state: req.query.state as string,
      farmerCategory: req.query.farmerCategory as string,
      language: language
    };

    const schemes = await schemeService.searchSchemes(filter);

    // Filter only eligible schemes
    const eligibleSchemes = schemes.filter(s => s.eligibility_match);

    res.json({
      success: true,
      count: eligibleSchemes.length,
      data: eligibleSchemes
    });
  } catch (error) {
    logger.error('Error in GET /schemes/eligible/:userId:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get eligible schemes'
    });
  }
});

/**
 * POST /api/v1/govt/schemes/alerts/subscribe
 * Subscribe to deadline alerts for a specific scheme
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.post('/alerts/subscribe', apiRateLimiter, cacheMiddleware.invalidate(['schemes:*', 'eligible:*']), async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = subscriptionSchemaValidator.validate(req.body);
    
    if (error) {
      logger.warn('Invalid subscription parameters:', error.details);
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription parameters',
        details: error.details.map(d => d.message)
      });
    }

    const { userId, schemeId } = value;

    logger.info(`Subscribing user ${userId} to scheme ${schemeId}`);

    const subscription = await schemeService.subscribeToScheme(userId, schemeId);

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to scheme deadline alerts',
      data: subscription
    });
  } catch (error) {
    logger.error('Error in POST /schemes/alerts/subscribe:', error);
    
    // Handle duplicate subscription error
    if (error instanceof Error && error.message.includes('duplicate')) {
      return res.status(409).json({
        success: false,
        error: 'Already subscribed to this scheme'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to scheme alerts'
    });
  }
});

export default router;


/**
 * GET /api/v1/govt/cache/metrics
 * Get cache performance metrics
 */
router.get('/cache/metrics', async (req: Request, res: Response) => {
  const metrics = cacheMiddleware.getMetrics();
  
  res.json({
    success: true,
    data: {
      ...metrics,
      hit_rate_percentage: cacheMiddleware.getHitRate().toFixed(2),
    },
  });
});
