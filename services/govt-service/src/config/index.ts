import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  sentryDsn: process.env.SENTRY_DSN || '',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'krishiai_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20, // connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  
  scraping: {
    userAgent: process.env.SCRAPING_USER_AGENT || 'KrishiAI-Bot/1.0',
    timeout: parseInt(process.env.SCRAPING_TIMEOUT || '30000', 10),
  },
  
  cache: {
    ttl: {
      schemes: parseInt(process.env.CACHE_TTL_SCHEMES || '86400', 10), // 24 hours
    },
  },
  
  sms: {
    gatewayUrl: process.env.SMS_GATEWAY_URL || 'https://api.twilio.com/2010-04-01',
    accountSid: process.env.SMS_GATEWAY_ACCOUNT_SID || '',
    apiKey: process.env.SMS_GATEWAY_API_KEY || '',
    fromNumber: process.env.SMS_FROM_NUMBER || '',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
