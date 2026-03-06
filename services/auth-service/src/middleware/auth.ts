import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from './errorHandler';
import { JWTPayload } from '../types';
import redisClient from '../config/redis';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: JWTPayload;
  token?: string;
}

/**
 * Middleware to authenticate JWT tokens
 * - Extracts Bearer token from Authorization header
 * - Verifies token signature and expiration
 * - Checks if token is blacklisted (for logout functionality)
 * - Attaches decoded user payload to request
 */
export const authenticateJWT = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('No token provided', 401));
  }

  const token = authHeader.substring(7);
  req.token = token; // Store token for potential blacklisting

  try {
    // Verify token signature and expiration
    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      logger.warn(`Blacklisted token attempted access: ${decoded.userId}`);
      return next(new AppError('Token has been revoked', 401));
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token expired', 401));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token', 401));
    }
    logger.error('JWT authentication error:', error);
    return next(new AppError('Authentication failed', 401));
  }
};

/**
 * Check if a token is blacklisted in Redis
 * @param token - JWT token to check
 * @returns true if blacklisted, false otherwise
 */
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const blacklistKey = `blacklist:token:${token}`;
    const result = await redisClient.get(blacklistKey);
    return result !== null;
  } catch (error) {
    logger.error('Error checking token blacklist:', error);
    // Fail open - if Redis is down, allow the request
    // This prevents Redis outages from blocking all authenticated requests
    return false;
  }
};

/**
 * Add a token to the blacklist
 * Token will be blacklisted until its natural expiration
 * @param token - JWT token to blacklist
 * @param expiresAt - Token expiration timestamp
 */
export const blacklistToken = async (token: string, expiresAt: number): Promise<void> => {
  try {
    const blacklistKey = `blacklist:token:${token}`;
    const now = Math.floor(Date.now() / 1000);
    const ttl = expiresAt - now;

    if (ttl > 0) {
      // Store token in blacklist with TTL matching token expiration
      await redisClient.setEx(blacklistKey, ttl, 'revoked');
      logger.info(`Token blacklisted with TTL: ${ttl} seconds`);
    }
  } catch (error) {
    logger.error('Error blacklisting token:', error);
    throw new AppError('Failed to revoke token', 500);
  }
};
