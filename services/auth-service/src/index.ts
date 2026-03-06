import { config } from './config';
import { connectRedis } from './config/redis';
import db from './config/database';
import logger from './utils/logger';
import { initializeSentry, captureException, flushSentry } from '../../shared/utils/sentry';

// Initialize Sentry before importing app
initializeSentry({
  dsn: config.sentryDsn,
  environment: config.nodeEnv,
  serviceName: 'auth-service',
  release: process.env.RELEASE_VERSION,
  tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
  profilesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
});

import app from './app';

const startServer = async () => {
  try {
    // Test database connection
    const client = await db.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection established');

    // Connect to Redis
    await connectRedis();

    // Start server
    app.listen(config.port, () => {
      logger.info(`Auth service running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  captureException(new Error(`Unhandled Rejection: ${reason}`), {
    endpoint: 'unhandledRejection',
  });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  captureException(error, {
    endpoint: 'uncaughtException',
  });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await flushSentry(2000);
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await flushSentry(2000);
  process.exit(0);
});

startServer();
