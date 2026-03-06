import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  sentryDsn: process.env.SENTRY_DSN || '',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'krishiai_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20, // Connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  
  externalApis: {
    agmarknet: {
      url: process.env.AGMARKNET_API_URL || '',
      apiKey: process.env.AGMARKNET_API_KEY || '',
    },
    enam: {
      url: process.env.ENAM_API_URL || '',
      apiKey: process.env.ENAM_API_KEY || '',
    },
  },
  
  cron: {
    priceUpdate: process.env.PRICE_UPDATE_CRON || '0 6 * * *', // 6:00 AM IST daily
  },
  
  cache: {
    priceTtl: parseInt(process.env.PRICE_CACHE_TTL || '3600', 10), // 1 hour
    forecastTtl: parseInt(process.env.FORECAST_CACHE_TTL || '21600', 10), // 6 hours
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
