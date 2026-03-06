import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { getRequestId } from './requestId';
import { sanitizeLogData } from '../utils/logger';

/**
 * Middleware to log HTTP requests with request ID
 * 
 * Logs:
 * - Request start (method, path, request ID)
 * - Request completion (status, duration, request ID)
 * - Request errors (with sanitized context)
 * 
 * @param logger - Winston logger instance
 * @returns Express middleware function
 */
export function loggingMiddleware(logger: winston.Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = getRequestId(req);
    const startTime = Date.now();

    // Log request start
    logger.info('Request started', {
      requestId,
      method: req.method,
      path: req.path,
      query: sanitizeLogData(req.query),
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Capture response finish event
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

      logger.log(logLevel, 'Request completed', {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    });

    // Capture response error event
    res.on('error', (error: Error) => {
      logger.error('Request error', {
        requestId,
        method: req.method,
        path: req.path,
        error: error.message,
        stack: error.stack,
      });
    });

    next();
  };
}

/**
 * Create a child logger with request ID
 * 
 * @param logger - Parent Winston logger instance
 * @param req - Express request object
 * @returns Child logger with request ID in default metadata
 */
export function createRequestLogger(logger: winston.Logger, req: Request): winston.Logger {
  const requestId = getRequestId(req);
  return logger.child({ requestId });
}

export default loggingMiddleware;
