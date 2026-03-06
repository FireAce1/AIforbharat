/**
 * Prometheus Metrics Middleware for Express
 * 
 * Automatically tracks HTTP request metrics for all routes
 */

import { Request, Response, NextFunction } from 'express';
import { recordHttpRequest } from './metrics';

/**
 * Create metrics middleware for a service
 * 
 * @param serviceName - Name of the service (e.g., 'auth-service', 'crop-service')
 * @returns Express middleware function
 */
export function createMetricsMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Capture the original end function
    const originalEnd = res.end;

    // Override res.end to record metrics when response is sent
    res.end = function (this: Response, ...args: any[]): Response {
      // Calculate duration in seconds
      const durationSeconds = (Date.now() - startTime) / 1000;

      // Get route pattern (e.g., /api/v1/users/:id instead of /api/v1/users/123)
      const route = req.route?.path || req.path;

      // Record metrics
      recordHttpRequest(
        req.method,
        route,
        res.statusCode,
        durationSeconds,
        serviceName
      );

      // Call the original end function
      return originalEnd.apply(this, args);
    };

    next();
  };
}
