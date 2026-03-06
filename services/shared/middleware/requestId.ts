import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware to add request ID to all requests
 * 
 * Adds a unique request ID to each request for tracing across logs.
 * The request ID is:
 * - Generated as a UUID v4
 * - Added to request object as req.id
 * - Added to response headers as X-Request-ID
 * - Available for logging throughout the request lifecycle
 * 
 * Usage:
 * ```typescript
 * import { requestIdMiddleware } from '@shared/middleware/requestId';
 * app.use(requestIdMiddleware);
 * ```
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check if request ID already exists in headers (from upstream proxy/gateway)
  const existingRequestId = req.headers['x-request-id'] as string;
  
  // Use existing request ID or generate new one
  const requestId = existingRequestId || uuidv4();
  
  // Attach request ID to request object
  (req as any).id = requestId;
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  next();
}

/**
 * Get request ID from request object
 * 
 * @param req - Express request object
 * @returns Request ID string
 */
export function getRequestId(req: Request): string {
  return (req as any).id || 'unknown';
}

export default requestIdMiddleware;
