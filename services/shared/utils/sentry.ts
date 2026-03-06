import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { Request, Response, NextFunction } from 'express';

interface SentryConfig {
  dsn: string;
  environment: string;
  serviceName: string;
  release?: string;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
}

/**
 * Initialize Sentry for error tracking and performance monitoring
 * @param config Sentry configuration options
 */
export const initializeSentry = (config: SentryConfig): void => {
  if (!config.dsn) {
    console.warn('Sentry DSN not provided. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment || 'development',
    release: config.release || `${config.serviceName}@1.0.0`,
    
    // Performance monitoring
    tracesSampleRate: config.tracesSampleRate || 0.1, // 10% of transactions
    profilesSampleRate: config.profilesSampleRate || 0.1, // 10% of transactions
    
    integrations: [
      new ProfilingIntegration(),
    ],
    
    // Add service name as tag
    initialScope: {
      tags: {
        service: config.serviceName,
      },
    },
    
    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      // Remove sensitive query parameters
      if (event.request?.query_string) {
        const sensitiveParams = ['password', 'token', 'api_key', 'otp'];
        sensitiveParams.forEach(param => {
          if (event.request?.query_string?.includes(param)) {
            event.request.query_string = event.request.query_string.replace(
              new RegExp(`${param}=[^&]*`, 'gi'),
              `${param}=***REDACTED***`
            );
          }
        });
      }
      
      return event;
    },
  });

  console.log(`Sentry initialized for ${config.serviceName} in ${config.environment} environment`);
};

/**
 * Express middleware to capture request context in Sentry
 */
export const sentryRequestHandler = () => {
  return Sentry.Handlers.requestHandler({
    user: ['id', 'phone'],
    request: ['method', 'url', 'headers'],
    transaction: 'methodPath',
  });
};

/**
 * Express middleware to capture errors in Sentry
 */
export const sentryErrorHandler = () => {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture all errors with status code >= 500
      return true;
    },
  });
};

/**
 * Express middleware to add custom context to Sentry
 */
export const sentryContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Add request ID for tracing
  const requestId = req.headers['x-request-id'] as string || 
                    req.headers['x-correlation-id'] as string ||
                    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  Sentry.setTag('request_id', requestId);
  
  // Add user context if available
  if (req.user) {
    Sentry.setUser({
      id: (req.user as any).id,
      phone: (req.user as any).phone,
    });
  }
  
  // Add endpoint context
  Sentry.setContext('request', {
    method: req.method,
    url: req.url,
    endpoint: `${req.method} ${req.route?.path || req.path}`,
  });
  
  next();
};

/**
 * Capture exception with additional context
 */
export const captureException = (
  error: Error,
  context?: {
    userId?: string;
    requestId?: string;
    endpoint?: string;
    payload?: any;
    [key: string]: any;
  }
): string => {
  Sentry.withScope((scope) => {
    if (context) {
      // Add user context
      if (context.userId) {
        scope.setUser({ id: context.userId });
      }
      
      // Add tags
      if (context.requestId) {
        scope.setTag('request_id', context.requestId);
      }
      if (context.endpoint) {
        scope.setTag('endpoint', context.endpoint);
      }
      
      // Add extra context (excluding sensitive data)
      const { userId, requestId, endpoint, payload, ...extraContext } = context;
      
      if (payload) {
        // Sanitize payload before adding to context
        const sanitizedPayload = sanitizePayload(payload);
        scope.setContext('payload', sanitizedPayload);
      }
      
      if (Object.keys(extraContext).length > 0) {
        scope.setContext('additional', extraContext);
      }
    }
    
    Sentry.captureException(error);
  });
  
  return Sentry.lastEventId() || '';
};

/**
 * Add breadcrumb for debugging
 */
export const addBreadcrumb = (
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, any>
): void => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data: data ? sanitizePayload(data) : undefined,
    timestamp: Date.now() / 1000,
  });
};

/**
 * Capture message with context
 */
export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
): string => {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('message_context', sanitizePayload(context));
    }
    Sentry.captureMessage(message, level);
  });
  
  return Sentry.lastEventId() || '';
};

/**
 * Sanitize payload to remove sensitive information
 */
const sanitizePayload = (payload: any): any => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  
  const sensitiveFields = [
    'password',
    'token',
    'api_key',
    'apiKey',
    'secret',
    'otp',
    'phone',
    'email',
    'authorization',
    'cookie',
  ];
  
  const sanitized = Array.isArray(payload) ? [...payload] : { ...payload };
  
  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizePayload(sanitized[key]);
    }
  }
  
  return sanitized;
};

/**
 * Track crash rate metric
 */
export const trackCrashRate = (crashed: boolean): void => {
  Sentry.setTag('crash_occurred', crashed ? 'yes' : 'no');
  
  if (crashed) {
    Sentry.captureMessage('Application crash detected', 'fatal');
  }
};

/**
 * Flush Sentry events (useful for serverless or before shutdown)
 */
export const flushSentry = async (timeout: number = 2000): Promise<boolean> => {
  return await Sentry.close(timeout);
};

export { Sentry };
