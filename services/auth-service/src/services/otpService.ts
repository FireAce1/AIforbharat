import crypto from 'crypto';
import bcrypt from 'bcrypt';
import twilio from 'twilio';
import { config } from '../config';
import redisClient from '../config/redis';
import logger from '../utils/logger';
import { logBusinessEvent, logSecurityEvent } from '../../shared/utils/logger';
import { AppError } from '../middleware/errorHandler';

export class OTPService {
  private readonly SALT_ROUNDS = 10;
  private readonly OTP_PREFIX = 'otp:';
  private readonly RATE_LIMIT_PREFIX = 'rate_limit:otp:';
  private readonly RESEND_DELAY_PREFIX = 'resend_delay:';
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 2000; // 2 seconds between retries
  
  private twilioClient: twilio.Twilio | null = null;

  constructor() {
    // Initialize Twilio client if credentials are provided
    if (config.smsGateway.accountSid && config.smsGateway.authToken) {
      this.twilioClient = twilio(
        config.smsGateway.accountSid,
        config.smsGateway.authToken
      );
      logger.info('Twilio SMS client initialized');
    } else {
      logger.warn('SMS gateway credentials not configured. OTPs will be logged only.');
    }
  }

  /**
   * Generate a 6-digit OTP using crypto.randomInt for cryptographic security
   */
  private generateOTPCode(): string {
    const otp = crypto.randomInt(100000, 999999);
    return otp.toString();
  }

  /**
   * Check if phone number has exceeded rate limit (5 requests per hour)
   */
  private async checkRateLimit(phone: string): Promise<void> {
    const rateLimitKey = `${this.RATE_LIMIT_PREFIX}${phone}`;
    const attempts = await redisClient.get(rateLimitKey);
    
    if (attempts && parseInt(attempts) >= config.otpRateLimit) {
      // Log security event for rate limit violation
      logSecurityEvent(logger, 'rate_limit_exceeded', {
        phone: phone.substring(0, 6) + '****',
        attempts: parseInt(attempts),
        limit: config.otpRateLimit,
        resource: 'otp_generation',
      });
      
      throw new AppError(
        `Too many OTP requests. Please try again after 1 hour.`,
        429
      );
    }
  }

  /**
   * Check if resend delay (30 seconds) has passed since last OTP request
   */
  private async checkResendDelay(phone: string): Promise<void> {
    const resendDelayKey = `${this.RESEND_DELAY_PREFIX}${phone}`;
    const lastSentTime = await redisClient.get(resendDelayKey);
    
    if (lastSentTime) {
      const timeSinceLastSend = Date.now() - parseInt(lastSentTime);
      const remainingDelay = config.otpResendDelay * 1000 - timeSinceLastSend;
      
      if (remainingDelay > 0) {
        logger.warn(`Resend delay not met for phone: ${phone}`, {
          phone,
          remainingSeconds: Math.ceil(remainingDelay / 1000),
        });
        throw new AppError(
          `Please wait ${Math.ceil(remainingDelay / 1000)} seconds before requesting a new OTP.`,
          429
        );
      }
    }
  }

  /**
   * Increment rate limit counter for phone number
   */
  private async incrementRateLimit(phone: string): Promise<void> {
    const rateLimitKey = `${this.RATE_LIMIT_PREFIX}${phone}`;
    const attempts = await redisClient.get(rateLimitKey);
    const currentAttempts = attempts ? parseInt(attempts) : 0;
    
    // Set expiry to 1 hour (3600 seconds)
    await redisClient.setEx(rateLimitKey, 3600, (currentAttempts + 1).toString());
    
    logger.debug(`Rate limit incremented for phone: ${phone}`, {
      phone,
      attempts: currentAttempts + 1,
      limit: config.otpRateLimit,
    });
  }

  /**
   * Set resend delay timestamp
   */
  private async setResendDelay(phone: string): Promise<void> {
    const resendDelayKey = `${this.RESEND_DELAY_PREFIX}${phone}`;
    await redisClient.setEx(
      resendDelayKey,
      config.otpResendDelay,
      Date.now().toString()
    );
  }

  /**
   * Send SMS via Twilio with retry logic
   */
  private async sendSMS(phone: string, message: string): Promise<boolean> {
    if (!this.twilioClient) {
      // Development mode: log OTP instead of sending
      logger.info(`[DEV MODE] OTP for ${phone}: ${message}`);
      return true;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        logger.debug(`SMS delivery attempt ${attempt} for phone: ${phone}`, {
          phone,
          attempt,
          maxAttempts: this.MAX_RETRY_ATTEMPTS,
        });

        const result = await this.twilioClient.messages.create({
          body: message,
          from: config.smsGateway.from,
          to: phone,
        });

        logger.info(`SMS delivered successfully to phone: ${phone}`, {
          phone,
          messageSid: result.sid,
          status: result.status,
          attempt,
        });

        return true;
      } catch (error) {
        lastError = error as Error;
        
        logger.warn(`SMS delivery attempt ${attempt} failed for phone: ${phone}`, {
          phone,
          attempt,
          error: lastError.message,
        });

        // Wait before retrying (exponential backoff)
        if (attempt < this.MAX_RETRY_ATTEMPTS) {
          const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retry attempts failed
    logger.error(`SMS delivery failed after ${this.MAX_RETRY_ATTEMPTS} attempts for phone: ${phone}`, {
      phone,
      error: lastError?.message,
      attempts: this.MAX_RETRY_ATTEMPTS,
    });

    throw new AppError(
      'Failed to send OTP. Please try again later.',
      503
    );
  }

  /**
   * Generate and send OTP to phone number
   */
  async generateAndSendOTP(phone: string): Promise<void> {
    logger.info(`OTP generation requested for phone: ${phone}`, { phone });

    // Check rate limiting (5 requests per hour)
    await this.checkRateLimit(phone);

    // Check resend delay (30 seconds)
    await this.checkResendDelay(phone);

    // Generate 6-digit OTP using crypto.randomInt
    const otp = this.generateOTPCode();
    
    logger.debug(`OTP generated for phone: ${phone}`, {
      phone,
      otpLength: otp.length,
    });

    // Hash OTP before storing
    const hashedOTP = await bcrypt.hash(otp, this.SALT_ROUNDS);
    
    // Store hashed OTP in Redis with 300-second (5 minutes) TTL
    const otpKey = `${this.OTP_PREFIX}${phone}`;
    await redisClient.setEx(otpKey, config.otpExpiry, hashedOTP);
    
    logger.debug(`OTP stored in Redis for phone: ${phone}`, {
      phone,
      ttl: config.otpExpiry,
    });

    // Increment rate limit counter
    await this.incrementRateLimit(phone);

    // Set resend delay
    await this.setResendDelay(phone);

    // Send OTP via SMS
    const message = `Your KrishiAI verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;
    await this.sendSMS(phone, message);

    // Log OTP sent event
    logBusinessEvent(logger, 'otp_sent', {
      phone: phone.substring(0, 6) + '****', // Partially mask phone for security
      expirySeconds: config.otpExpiry,
    });
  }

  /**
   * Verify OTP for phone number
   */
  async verifyOTP(phone: string, code: string): Promise<boolean> {
    logger.info(`OTP verification requested for phone: ${phone}`, { phone });

    const otpKey = `${this.OTP_PREFIX}${phone}`;
    const hashedOTP = await redisClient.get(otpKey);
    
    if (!hashedOTP) {
      logger.warn(`OTP not found or expired for phone: ${phone}`, { phone });
      throw new AppError('OTP expired or not found. Please request a new OTP.', 400);
    }

    // Compare provided OTP with hashed OTP
    const isValid = await bcrypt.compare(code, hashedOTP);
    
    if (!isValid) {
      logger.warn(`Invalid OTP provided for phone: ${phone}`, { phone });
      throw new AppError('Invalid OTP. Please check and try again.', 400);
    }

    // Delete OTP after successful verification (single-use)
    await redisClient.del(otpKey);
    
    logger.info(`OTP verified successfully for phone: ${phone}`, { phone });

    return true;
  }

  /**
   * Get remaining rate limit attempts for phone number
   */
  async getRemainingAttempts(phone: string): Promise<number> {
    const rateLimitKey = `${this.RATE_LIMIT_PREFIX}${phone}`;
    const attempts = await redisClient.get(rateLimitKey);
    const currentAttempts = attempts ? parseInt(attempts) : 0;
    return Math.max(0, config.otpRateLimit - currentAttempts);
  }
}

export default new OTPService();
