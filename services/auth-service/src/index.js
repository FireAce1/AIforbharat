/**
 * Auth Service Entry Point
 * Initializes Express server and Redis connection
 */

require('dotenv').config();
const express = require('express');
const { initRedisClient, closeRedisClient } = require('./config/redis');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

// Placeholder for auth routes
app.get('/api/v1/auth/status', (req, res) => {
  res.json({ message: 'Auth service is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize server
async function startServer() {
  try {
    // Initialize Redis connection
    await initRedisClient();
    console.log('Redis connection initialized');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Auth service listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await closeRedisClient();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await closeRedisClient();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
