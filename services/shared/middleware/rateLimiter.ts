import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate Limiter Configuration for KrishiAI Platform
 * 
 * Implements rate limiting as per Requirements 1.5 and 15.1:
 * - OTP endpoint: 5 requests per hour per phone
 * - API endpoints: 1000 requests per hour per user
 * - ML inference: 50 requests per hour per user
 */

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Custom key generator for phone-based rate limiting
 * Extracts phone number from request body
 */
const phoneKeyGenerator = (req: Request): string => {
  const phone = req.body?.phone || req.query?.phone || 'unknown';
  return `phone:${phone}`;
};

/**
 * Custom key generator for user-based rate limiting
 * Extracts user ID from JWT token (req.user)
 */
const userKeyGenerator = (req: Request): string => {
  const userId = (req as any).user?.id || req.ip || 'anonymous';
  return `user:${userId}`;
};

/**
 * Custom handler for rate limit exceeded
 * Returns 429 status with Retry-After header and detailed error message
 */
const rateLimitHandler = (req: Request, res: Response) => {
  const retryAfter = Math.ceil(req.rateLimit.resetTime!.getTime() / 1000 - Date.now() / 1000);
  
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: retryAfter,
    limit: req.rateLimit.limit,
    remaining: 0,
    resetTime: req.rateLimit.resetTime
  });
};

/**
 * OTP Rate Limiter
 * Limits: 5 requests per hour per phone number
 * Use case: Prevent OTP spam and abuse
 */
export const otpRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: 'Too many OTP requests from this phone number. Please try again after an hour.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: phoneKeyGenerator,
  handler: rateLimitHandler,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * API Rate Limiter
 * Limits: 1000 requests per hour per user
 * Use case: General API protection for authenticated endpoints
 */
export const apiRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour
  message: 'Too many API requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: rateLimitHandler,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * ML Inference Rate Limiter
 * Limits: 50 requests per hour per user
 * Use case: Protect expensive ML inference endpoints (disease detection, crop recommendation)
 */
export const mlRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 requests per hour
  message: 'Too many ML inference requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: rateLimitHandler,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Strict Rate Limiter for sensitive operations
 * Limits: 10 requests per hour per user
 * Use case: Password reset, account deletion, etc.
 */
export const strictRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Too many requests for this sensitive operation. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: rateLimitHandler,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Public Rate Limiter for unauthenticated endpoints
 * Limits: 100 requests per hour per IP
 * Use case: Health checks, public documentation, etc.
 */
export const publicRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour per IP
  message: 'Too many requests from this IP. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Custom rate limiter factory
 * Creates a rate limiter with custom configuration
 */
export const createRateLimiter = (config: Partial<RateLimitConfig>): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: config.windowMs || 60 * 60 * 1000,
    max: config.max || 100,
    message: config.message || 'Too many requests. Please try again later.',
    standardHeaders: config.standardHeaders !== false,
    legacyHeaders: config.legacyHeaders || false,
    handler: rateLimitHandler,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
  });
};

/**
 * Rate limit headers middleware
 * Adds custom rate limit headers to all responses
 */
export const rateLimitHeaders = (req: Request, res: Response, next: Function) => {
  // Add custom headers if rate limit info is available
  if (req.rateLimit) {
    res.setHeader('X-RateLimit-Limit', req.rateLimit.limit.toString());
    res.setHeader('X-RateLimit-Remaining', req.rateLimit.remaining.toString());
    
    if (req.rateLimit.resetTime) {
      res.setHeader('X-RateLimit-Reset', Math.ceil(req.rateLimit.resetTime.getTime() / 1000).toString());
    }
  }
  
  next();
};

export default {
  otpRateLimiter,
  apiRateLimiter,
  mlRateLimiter,
  strictRateLimiter,
  publicRateLimiter,
  createRateLimiter,
  rateLimitHeaders,
};
