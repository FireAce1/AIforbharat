import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export interface LoggerOptions {
  service: string;
  level?: string;
  nodeEnv?: string;
}

/**
 * Create a structured logger with Winston
 * 
 * Features:
 * - JSON format logging with timestamp, level, service, message, context
 * - Request ID support for tracing
 * - Separate error logs (error.log) from combined logs (combined.log)
 * - Daily log rotation (keep 30 days)
 * - Security event logging without sensitive data
 * - Console logging in development
 * 
 * @param options - Logger configuration options
 * @returns Configured Winston logger instance
 */
export function createLogger(options: LoggerOptions): winston.Logger {
  const { service, level = 'info', nodeEnv = process.env.NODE_ENV || 'development' } = options;

  // JSON format for structured logging
  const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  );

  // Human-readable format for console in development
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, service, requestId, ...meta }) => {
      let metaStr = '';
      if (Object.keys(meta).length > 0) {
        metaStr = ` ${JSON.stringify(meta)}`;
      }
      const reqId = requestId ? ` [${requestId}]` : '';
      return `${timestamp} [${service}]${reqId} ${level}: ${message}${metaStr}`;
    })
  );

  // Daily rotate file transport for error logs
  const errorFileTransport = new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d',
    format: jsonFormat,
  });

  // Daily rotate file transport for combined logs
  const combinedFileTransport = new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: jsonFormat,
  });

  // Create logger with default metadata
  const logger = winston.createLogger({
    level: nodeEnv === 'production' ? level : 'debug',
    format: jsonFormat,
    defaultMeta: { service },
    transports: [errorFileTransport, combinedFileTransport],
  });

  // Add console transport in development
  if (nodeEnv !== 'production') {
    logger.add(
      new winston.transports.Console({
        format: consoleFormat,
      })
    );
  }

  return logger;
}

/**
 * Sanitize sensitive data from log context
 * Removes or masks sensitive fields like passwords, tokens, OTPs
 * 
 * @param data - Data object to sanitize
 * @returns Sanitized data object
 */
export function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'otp',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'cookie',
    'session',
  ];

  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    
    // Check if field is sensitive
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    }
    
    // Recursively sanitize nested objects
    else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Log security event without storing sensitive data
 * 
 * @param logger - Winston logger instance
 * @param event - Security event name
 * @param context - Event context (will be sanitized)
 */
export function logSecurityEvent(
  logger: winston.Logger,
  event: string,
  context: Record<string, any>
): void {
  const sanitizedContext = sanitizeLogData(context);
  logger.warn('Security event', {
    event,
    ...sanitizedContext,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log important business events
 * 
 * @param logger - Winston logger instance
 * @param event - Event name
 * @param context - Event context
 */
export function logBusinessEvent(
  logger: winston.Logger,
  event: string,
  context: Record<string, any>
): void {
  logger.info('Business event', {
    event,
    ...context,
    timestamp: new Date().toISOString(),
  });
}

export default createLogger;
