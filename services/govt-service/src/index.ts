import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { logger } from './utils/logger';
import { redis } from './config/redis';
import healthRoutes from './routes/health';
import schemeRoutes from './routes/schemes';
import { scheduleNotificationJob } from './jobs/notificationJob';
import { register, createMetricsMiddleware } from '@krishiai/shared/monitoring';
import { requestIdMiddleware, loggingMiddleware } from '../../shared/middleware';
import { 
  initializeSentry,
  sentryRequestHandler, 
  sentryContextMiddleware, 
  sentryErrorHandler,
  captureException,
  flushSentry
} from '../../shared/utils/sentry';

// Initialize Sentry before creating app
initializeSentry({
  dsn: config.sentryDsn,
  environment: config.nodeEnv,
  serviceName: 'govt-service',
  release: process.env.RELEASE_VERSION,
  tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
  profilesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
});

const app: Application = express();

// Sentry request handler - must be first
app.use(sentryRequestHandler());

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request ID middleware - must be early to ensure all logs have request ID
app.use(requestIdMiddleware);

// Sentry context middleware - after request ID
app.use(sentryContextMiddleware);

// Structured logging middleware with request ID
app.use(loggingMiddleware(logger));

// Prometheus metrics middleware
app.use(createMetricsMiddleware('govt-service'));

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/govt/schemes', schemeRoutes);

// Metrics endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'KrishiAI Government Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      schemes: '/api/v1/govt/schemes'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Sentry error handler - must be before other error handlers
app.use(sentryErrorHandler());

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
const PORT = config.port || 3004;

// Initialize Redis connection
redis.connect().then(() => {
  logger.info('Redis connected successfully');
  
  // Schedule notification job
  scheduleNotificationJob();
  
  app.listen(PORT, () => {
    logger.info(`Government Service listening on port ${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
  });
}).catch((error) => {
  logger.error('Failed to connect to Redis:', error);
  logger.warn('Starting server without Redis cache');
  
  // Schedule notification job even without Redis
  scheduleNotificationJob();
  
  app.listen(PORT, () => {
    logger.info(`Government Service listening on port ${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await flushSentry(2000);
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await flushSentry(2000);
  process.exit(0);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  captureException(new Error(`Unhandled Rejection: ${reason}`), {
    endpoint: 'unhandledRejection',
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  captureException(error, { endpoint: 'uncaughtException' });
  process.exit(1);
});

export default app;
