import express, { Application, Request, Response } from 'express';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { securityMiddleware } from './middleware/validator';
import logger from './utils/logger';
import { register, createMetricsMiddleware } from '@krishiai/shared/monitoring';
import { requestIdMiddleware, loggingMiddleware } from '../../shared/middleware';
import { 
  sentryRequestHandler, 
  sentryContextMiddleware, 
  sentryErrorHandler 
} from '../../shared/utils/sentry';

const app: Application = express();

// Sentry request handler - must be first
app.use(sentryRequestHandler());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request ID middleware - must be early to ensure all logs have request ID
app.use(requestIdMiddleware);

// Sentry context middleware - after request ID
app.use(sentryContextMiddleware);

// Structured logging middleware with request ID
app.use(loggingMiddleware(logger));

// Security middleware (SQL injection and XSS prevention)
app.use(securityMiddleware);

// Prometheus metrics middleware
app.use(createMetricsMiddleware('auth-service'));

// Routes
app.use('/api/v1', routes);

// Metrics endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Sentry error handler - must be before other error handlers
app.use(sentryErrorHandler());

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
