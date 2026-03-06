import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { database } from './config/database';
import { redisClient } from './config/redis';
import { cronService } from './services/cronService';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
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
  serviceName: 'market-service',
  release: process.env.RELEASE_VERSION,
  tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
  profilesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
});

// Import routes
import healthRoutes from './routes/health';
import adminRoutes from './routes/admin';
import marketRoutes from './routes/market';

const app: Application = express();

// Sentry request handler - must be first
app.use(sentryRequestHandler());

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request ID middleware - must be early to ensure all logs have request ID
app.use(requestIdMiddleware);

// Sentry context middleware - after request ID
app.use(sentryContextMiddleware);

// Structured logging middleware with request ID
app.use(loggingMiddleware(logger));

// Prometheus metrics middleware
app.use(createMetricsMiddleware('market-service'));

// Routes
app.use('/', healthRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/market', marketRoutes);

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

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing connections...');
  
  try {
    cronService.stopAll();
    await database.close();
    await redisClient.close();
    await flushSentry(2000);
    logger.info('All connections closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    captureException(error as Error, { endpoint: 'gracefulShutdown' });
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

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

// Start server
const startServer = async () => {
  try {
    // Connect to Redis
    await redisClient.connect();
    
    // Initialize cron jobs
    cronService.init();
    
    // Start Express server
    app.listen(config.port, () => {
      logger.info(`Market Service started on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();

export default app;
