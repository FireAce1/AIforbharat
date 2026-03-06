import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiry: process.env.JWT_EXPIRY || '7d',
  otpExpiry: parseInt(process.env.OTP_EXPIRY || '300'), // 5 minutes in seconds
  otpRateLimit: parseInt(process.env.OTP_RATE_LIMIT || '5'), // 5 requests per hour
  otpResendDelay: parseInt(process.env.OTP_RESEND_DELAY || '30'), // 30 seconds
  sentryDsn: process.env.SENTRY_DSN || '',
  smsGateway: {
    provider: process.env.SMS_PROVIDER || 'twilio',
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_PHONE_NUMBER || '',
    // Alternative: MSG91 configuration
    msg91ApiKey: process.env.MSG91_API_KEY || '',
    msg91SenderId: process.env.MSG91_SENDER_ID || '',
  },
};
