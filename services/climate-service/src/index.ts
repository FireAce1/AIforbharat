import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import database from './config/database';
import redis from './config/redis';
import logger from './utils/logger';
import healthRoutes from './routes/health';
import weatherRoutes from './routes/weather';
import waterRoutes from './routes/water';
import alertRoutes from './routes/alerts';
import weatherUpdateJob from './jobs/weatherUpdateJob';
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
  environment: config.server.env,
  serviceName: 'climate-service',
  release: process.env.RELEASE_VERSION,
  tracesSampleRate: config.server.env === 'production' ? 0.1 : 1.0,
  profilesSampleRate: config.server.env === 'production' ? 0.1 : 1.0,
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
app.use(createMetricsMiddleware('climate-service'));

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/climate/weather', weatherRoutes);
app.use('/api/v1/climate/water', waterRoutes);
app.use('/api/v1/climate/alerts', alertRoutes);

// Metrics endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'KrishiAI Climate Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      ready: '/ready',
      weather: '/api/v1/climate/weather',
      water: '/api/v1/climate/water',
      alerts: '/api/v1/climate/alerts',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Sentry error handler - must be before other error handlers
app.use(sentryErrorHandler());

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.server.env === 'production' 
        ? 'Internal server error' 
        : err.message,
    },
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing connections...');
  
  try {
    // Stop cron jobs
    weatherUpdateJob.stop();
    
    // Close database connection
    await database.close();
    
    // Close Redis connection
    await redis.close();
    
    // Flush Sentry events
    await flushSentry(2000);
    
    logger.info('All connections closed, exiting...');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
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
    // Test database connection
    const dbConnected = await database.testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Connect to Redis
    await redis.connect();
    logger.info('Redis connected successfully');

    // Start weather update cron job
    weatherUpdateJob.start();

    // Start HTTP server
    app.listen(config.server.port, () => {
      logger.info(`Climate Service started`, {
        port: config.server.port,
        env: config.server.env,
      });
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
