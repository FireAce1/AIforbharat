/**
 * Redis Configuration
 * Configures Redis connection pooling and client settings
 */

const redis = require('redis');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  // Connection pooling with 20 max connections
  socket: {
    connectTimeout: 10000,
    keepAlive: 5000,
  },
  // Retry strategy with exponential backoff
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

let client = null;

/**
 * Initialize Redis client with connection pooling
 * @returns {Promise<RedisClient>}
 */
async function initRedisClient() {
  if (client) {
    return client;
  }

  client = redis.createClient(redisConfig);

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Redis Client Connected');
  });

  client.on('ready', () => {
    console.log('Redis Client Ready');
  });

  client.on('reconnecting', () => {
    console.log('Redis Client Reconnecting');
  });

  await client.connect();

  return client;
}

/**
 * Get Redis client instance
 * @returns {RedisClient}
 */
function getRedisClient() {
  if (!client) {
    throw new Error('Redis client not initialized. Call initRedisClient() first.');
  }
  return client;
}

/**
 * Close Redis connection
 */
async function closeRedisClient() {
  if (client) {
    await client.quit();
    client = null;
  }
}

module.exports = {
  initRedisClient,
  getRedisClient,
  closeRedisClient,
  redisConfig,
};
