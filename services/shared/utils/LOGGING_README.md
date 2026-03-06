# Structured Logging Implementation

## Overview

This document describes the structured logging implementation for KrishiAI platform services using Winston with daily log rotation.

## Features

✅ **JSON Format Logging** - Structured logs with timestamp, level, service, message, and context  
✅ **Request ID Tracing** - Unique request ID added to all logs for request tracing  
✅ **Separate Log Files** - Error logs (error.log) separate from combined logs (combined.log)  
✅ **Daily Log Rotation** - Automatic rotation with 30-day retention  
✅ **Security Event Logging** - Logs security events without storing sensitive data  
✅ **Business Event Logging** - Tracks important business events  
✅ **Console Logging** - Human-readable console output in development  

## Architecture

```
Request → requestIdMiddleware → loggingMiddleware → Service Logic
                ↓                       ↓
          Adds Request ID        Logs Request/Response
                ↓                       ↓
          All logs include         Structured JSON logs
          request ID for            with sanitization
          tracing
```

## Usage

### 1. Create Logger in Service

```typescript
// services/your-service/src/utils/logger.ts
import { createLogger } from '../../shared/utils/logger';
import { config } from '../config';

const logger = createLogger({
  service: 'your-service',
  level: config.logging.level || 'info',
  nodeEnv: config.nodeEnv,
});

export default logger;
```

### 2. Add Middleware to Express App

```typescript
// services/your-service/src/index.ts
import express from 'express';
import logger from './utils/logger';
import { requestIdMiddleware, loggingMiddleware } from '../../shared/middleware';

const app = express();

// Request ID middleware - MUST be first
app.use(requestIdMiddleware);

// Structured logging middleware
app.use(loggingMiddleware(logger));

// ... rest of your middleware and routes
```

### 3. Log Events in Your Code

```typescript
import logger from './utils/logger';
import { logBusinessEvent, logSecurityEvent } from '../../shared/utils/logger';

// Standard logging
logger.info('User action completed', { userId, action: 'crop_recommendation' });
logger.error('Database query failed', { error: error.message, query });

// Business events (important events like user registration, OTP sent, etc.)
logBusinessEvent(logger, 'user_registration', {
  userId: user.id,
  phone: user.phone.substring(0, 6) + '****', // Mask sensitive data
});

logBusinessEvent(logger, 'otp_sent', {
  phone: phone.substring(0, 6) + '****',
  expirySeconds: 300,
});

logBusinessEvent(logger, 'disease_detection', {
  userId,
  cropId,
  disease: result.disease,
  confidence: result.confidence,
});

// Security events (rate limits, auth failures, etc.)
logSecurityEvent(logger, 'rate_limit_exceeded', {
  phone: phone.substring(0, 6) + '****',
  attempts: 5,
  limit: 5,
  resource: 'otp_generation',
});

logSecurityEvent(logger, 'invalid_token', {
  userId,
  endpoint: req.path,
});
```

### 4. Use Request Logger in Route Handlers

```typescript
import { createRequestLogger } from '../../shared/middleware';

app.post('/api/v1/resource', async (req, res) => {
  // Create child logger with request ID
  const reqLogger = createRequestLogger(logger, req);
  
  reqLogger.info('Processing request', { userId: req.user.id });
  
  try {
    // Your logic here
    reqLogger.info('Request processed successfully');
    res.json({ success: true });
  } catch (error) {
    reqLogger.error('Request failed', { error: error.message });
    res.status(500).json({ error: 'Internal error' });
  }
});
```

## Log Format

### JSON Format (Production)

```json
{
  "timestamp": "2026-01-15 10:30:45",
  "level": "info",
  "service": "auth-service",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Business event",
  "event": "user_registration",
  "userId": "user-123",
  "phone": "+91987****"
}
```

### Console Format (Development)

```
2026-01-15 10:30:45 [auth-service] [a1b2c3d4-e5f6-7890-abcd-ef1234567890] info: Business event {"event":"user_registration","userId":"user-123","phone":"+91987****"}
```

## Log Files

### Location
- `logs/error-YYYY-MM-DD.log` - Error level logs only
- `logs/combined-YYYY-MM-DD.log` - All log levels

### Rotation Policy
- **Frequency**: Daily (new file each day)
- **Retention**: 30 days
- **Max Size**: 20MB per file
- **Format**: JSON

### Example File Names
```
logs/error-2026-01-15.log
logs/error-2026-01-16.log
logs/combined-2026-01-15.log
logs/combined-2026-01-16.log
```

## Security Features

### Automatic Data Sanitization

The `sanitizeLogData()` function automatically removes or masks sensitive fields:

```typescript
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
```

### Example

```typescript
// Input
const data = {
  userId: '123',
  phone: '+919876543210',
  otp: '123456',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
};

// After sanitization
const sanitized = sanitizeLogData(data);
// {
//   userId: '123',
//   phone: '+919876543210',
//   otp: '[REDACTED]',
//   token: '[REDACTED]'
// }
```

### Manual Masking

For fields not automatically sanitized (like phone numbers), manually mask:

```typescript
logBusinessEvent(logger, 'otp_sent', {
  phone: phone.substring(0, 6) + '****', // +91987**** instead of full number
});
```

## Important Events to Log

### Authentication Service
- ✅ `user_registration` - New user created
- ✅ `otp_sent` - OTP sent to phone
- ✅ `otp_verified` - OTP successfully verified
- ✅ `rate_limit_exceeded` - Rate limit violation (security event)
- ✅ `invalid_token` - Invalid JWT token (security event)

### Crop Service
- ✅ `crop_recommendation` - Crop recommendation generated
- ✅ `disease_detection` - Disease detected from image
- ✅ `yield_prediction` - Yield prediction calculated

### Market Service
- ✅ `price_alert_triggered` - Price alert sent to user
- ✅ `price_forecast_generated` - Price forecast calculated

### Climate Service
- ✅ `weather_alert_sent` - Critical weather alert sent
- ✅ `irrigation_recommendation` - Water advisory generated

### Government Service
- ✅ `scheme_notification_sent` - Scheme deadline reminder sent
- ✅ `chatbot_query` - Chatbot query processed

### Sync Events (Mobile)
- ✅ `sync_completed` - Offline sync completed successfully
- ✅ `sync_failed` - Sync failed after retries

## Request ID Tracing

Request IDs enable tracing a single request across multiple services and log entries.

### How It Works

1. **Request ID Generation**: `requestIdMiddleware` generates a UUID for each request
2. **Header Propagation**: Request ID added to `X-Request-ID` response header
3. **Log Inclusion**: All logs include the request ID in their context
4. **Cross-Service Tracing**: Pass request ID to downstream services

### Example Trace

```
# Request starts
2026-01-15 10:30:45 [auth-service] [req-123] info: Request started {"method":"POST","path":"/api/v1/auth/send-otp"}

# OTP generation
2026-01-15 10:30:45 [auth-service] [req-123] info: OTP generation requested {"phone":"+91987****"}

# SMS sent
2026-01-15 10:30:46 [auth-service] [req-123] info: Business event {"event":"otp_sent","phone":"+91987****"}

# Request completed
2026-01-15 10:30:46 [auth-service] [req-123] info: Request completed {"statusCode":200,"duration":"1200ms"}
```

## Log Levels

Use appropriate log levels for different scenarios:

- **error**: Errors that need immediate attention (database failures, external API failures)
- **warn**: Warning conditions (rate limits, deprecated API usage, fallback to cache)
- **info**: Important informational messages (business events, request completion)
- **debug**: Detailed debugging information (only in development)

```typescript
logger.error('Database connection failed', { error: error.message });
logger.warn('Using cached data due to API failure', { api: 'IMD' });
logger.info('User registered successfully', { userId });
logger.debug('Cache hit', { key: cacheKey });
```

## Performance Considerations

### Async Logging

Winston logs asynchronously by default, so logging doesn't block request processing.

### Log Rotation

Daily rotation prevents log files from growing too large:
- Max 20MB per file
- Automatic compression of old logs
- Automatic deletion after 30 days

### Production Optimization

In production:
- Console logging is disabled (only file logging)
- Log level set to 'info' (debug logs excluded)
- JSON format for efficient parsing by log aggregators

## Integration with ELK Stack

The JSON format is designed for easy integration with Elasticsearch, Logstash, and Kibana:

```
Winston → JSON Logs → Filebeat → Logstash → Elasticsearch → Kibana
```

### Logstash Configuration Example

```ruby
input {
  file {
    path => "/var/log/krishiai/*/combined-*.log"
    codec => "json"
  }
}

filter {
  # Logs are already in JSON format, no parsing needed
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "krishiai-logs-%{+YYYY.MM.dd}"
  }
}
```

## Testing

### Unit Tests

```typescript
import { sanitizeLogData } from '../logger';

describe('sanitizeLogData', () => {
  it('should redact sensitive fields', () => {
    const data = {
      userId: '123',
      password: 'secret123',
      token: 'jwt-token',
    };
    
    const result = sanitizeLogData(data);
    
    expect(result.userId).toBe('123');
    expect(result.password).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
  });
});
```

### Integration Tests

```typescript
import request from 'supertest';
import app from '../app';

describe('Request ID Middleware', () => {
  it('should add X-Request-ID header to response', async () => {
    const response = await request(app).get('/health');
    
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

## Troubleshooting

### Logs Not Appearing

1. Check log directory exists: `mkdir -p logs`
2. Check file permissions: `chmod 755 logs`
3. Check log level configuration
4. Verify Winston is installed: `npm list winston`

### Request ID Missing

1. Ensure `requestIdMiddleware` is added BEFORE other middleware
2. Check middleware order in app.ts/index.ts
3. Verify `@krishiai/shared` package is properly linked

### Large Log Files

1. Check rotation configuration (should be 20MB max)
2. Verify old logs are being deleted (30-day retention)
3. Consider reducing log level in production (info instead of debug)

## Dependencies

```json
{
  "winston": "^3.11.0",
  "winston-daily-rotate-file": "^4.7.1",
  "uuid": "^9.0.1"
}
```

## References

- [Winston Documentation](https://github.com/winstonjs/winston)
- [Winston Daily Rotate File](https://github.com/winstonjs/winston-daily-rotate-file)
- [Requirements 15.6](../../.kiro/specs/krishiai-mvp/requirements.md#requirement-15-security-requirements)

---

**Last Updated**: January 2026  
**Status**: Implemented  
**Task**: 14.2 Set up structured logging
