import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3004', 10),
    env: process.env.NODE_ENV || 'development',
  },
  sentryDsn: process.env.SENTRY_DSN || '',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'krishiai_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  imd: {
    apiUrl: process.env.IMD_API_URL || 'https://api.imd.gov.in/v1',
    apiKey: process.env.IMD_API_KEY || '',
    updateInterval: parseInt(process.env.IMD_UPDATE_INTERVAL || '6', 10),
  },
  isro: {
    apiUrl: process.env.ISRO_API_URL || 'https://mosdac.gov.in/api/v1',
    apiKey: process.env.ISRO_API_KEY || '',
  },
  cron: {
    weatherUpdate: process.env.WEATHER_UPDATE_CRON || '0 */6 * * *',
  },
  cache: {
    weatherTTL: parseInt(process.env.WEATHER_CACHE_TTL || '21600', 10), // 6 hours
    advisoryTTL: parseInt(process.env.ADVISORY_CACHE_TTL || '3600', 10), // 1 hour
  },
  thresholds: {
    criticalRainfall: parseFloat(process.env.CRITICAL_RAINFALL_MM || '100'),
    criticalTempHigh: parseFloat(process.env.CRITICAL_TEMP_HIGH_C || '45'),
    criticalTempLow: parseFloat(process.env.CRITICAL_TEMP_LOW_C || '5'),
    criticalWindSpeed: parseFloat(process.env.CRITICAL_WIND_SPEED_KMH || '60'),
  },
  sms: {
    gatewayUrl: process.env.SMS_GATEWAY_URL || '',
    accountSid: process.env.SMS_GATEWAY_ACCOUNT_SID || '',
    apiKey: process.env.SMS_GATEWAY_API_KEY || '',
    fromNumber: process.env.SMS_FROM_NUMBER || '',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
