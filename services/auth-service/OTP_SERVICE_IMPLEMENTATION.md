# OTP Service Implementation

## Overview

This document describes the implementation of the OTP (One-Time Password) generation and SMS delivery service for the KrishiAI authentication system.

## Features Implemented

### 1. Secure OTP Generation
- Uses `crypto.randomInt(100000, 999999)` for cryptographically secure 6-digit OTP generation
- OTPs are hashed using bcrypt (10 salt rounds) before storage
- Stored in Redis with 300-second (5 minutes) TTL

### 2. SMS Gateway Integration
- Integrated with Twilio SDK for SMS delivery
- Supports fallback to MSG91 (configuration ready)
- Development mode: logs OTP instead of sending SMS when credentials not configured

### 3. Rate Limiting
- Maximum 5 OTP requests per phone number per hour
- Rate limit counter stored in Redis with 3600-second (1 hour) expiry
- Returns 429 status code when limit exceeded

### 4. Resend Delay
- 30-second delay enforced between consecutive OTP requests
- Prevents spam and abuse
- Timestamp stored in Redis

### 5. SMS Delivery with Retry Logic
- Maximum 3 retry attempts for SMS delivery
- Exponential backoff: 2s, 4s, 8s between retries
- Comprehensive error handling and logging

### 6. Structured Logging
- Winston logger integration
- Logs all OTP lifecycle events:
  - Generation requests
  - Rate limit checks
  - SMS delivery attempts and results
  - Verification attempts
  - Errors and warnings

### 7. Single-Use OTP
- OTP is deleted from Redis immediately after successful verification
- Prevents replay attacks

## Architecture

```
┌─────────────────┐
│  AuthController │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AuthService    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────┐      ┌──────────┐
│   OTPService    │─────▶│  Redis   │      │  Twilio  │
│                 │      │  Cache   │      │   SMS    │
│ - Generate OTP  │      └──────────┘      └──────────┘
│ - Send SMS      │
│ - Verify OTP    │      ┌──────────┐
│ - Rate Limit    │─────▶│  Logger  │
└─────────────────┘      └──────────┘
```

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# OTP Configuration
OTP_EXPIRY=300              # 5 minutes
OTP_RATE_LIMIT=5            # 5 requests per hour
OTP_RESEND_DELAY=30         # 30 seconds

# Twilio SMS Gateway
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Alternative: MSG91
# SMS_PROVIDER=msg91
# MSG91_API_KEY=your_api_key
# MSG91_SENDER_ID=your_sender_id
```

## API Endpoints

### 1. Send OTP

**Endpoint:** `POST /api/v1/auth/send-otp`

**Request Body:**
```json
{
  "phone": "+919876543210"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "remainingAttempts": 4,
    "expirySeconds": 300
  }
}
```

**Error Responses:**

Rate Limit Exceeded (429):
```json
{
  "success": false,
  "message": "Too many OTP requests. Please try again after 1 hour."
}
```

Resend Delay Not Met (429):
```json
{
  "success": false,
  "message": "Please wait 25 seconds before requesting a new OTP."
}
```

SMS Delivery Failed (503):
```json
{
  "success": false,
  "message": "Failed to send OTP. Please try again later."
}
```

### 2. Verify OTP

**Endpoint:** `POST /api/v1/auth/verify-otp`

**Request Body:**
```json
{
  "phone": "+919876543210",
  "code": "123456"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "phone": "+919876543210",
    "language": "hi",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**

OTP Expired (400):
```json
{
  "success": false,
  "message": "OTP expired or not found. Please request a new OTP."
}
```

Invalid OTP (400):
```json
{
  "success": false,
  "message": "Invalid OTP. Please check and try again."
}
```

## Redis Keys

The OTP service uses the following Redis key patterns:

1. **OTP Storage:** `otp:{phone}` - Stores hashed OTP (TTL: 300s)
2. **Rate Limiting:** `rate_limit:otp:{phone}` - Tracks request count (TTL: 3600s)
3. **Resend Delay:** `resend_delay:{phone}` - Stores last request timestamp (TTL: 30s)

## Security Features

1. **Cryptographic OTP Generation:** Uses `crypto.randomInt()` instead of `Math.random()`
2. **Hashed Storage:** OTPs are bcrypt-hashed before storage in Redis
3. **Single-Use:** OTP is deleted after successful verification
4. **Rate Limiting:** Prevents brute force attacks
5. **Resend Delay:** Prevents spam and abuse
6. **Expiry:** OTPs expire after 5 minutes
7. **Secure Logging:** OTP values are never logged in production

## Logging Events

The service logs the following events with structured metadata:

### Info Level
- OTP generation requested
- OTP sent successfully
- OTP verified successfully
- New user created
- Twilio client initialized

### Debug Level
- OTP generated (length only, not value)
- OTP stored in Redis
- Rate limit incremented
- SMS delivery attempt

### Warn Level
- Rate limit exceeded
- Resend delay not met
- SMS delivery attempt failed
- OTP not found or expired
- Invalid OTP provided

### Error Level
- SMS delivery failed after all retries
- Redis connection errors
- Database errors

## Testing

### Development Mode

When Twilio credentials are not configured, the service operates in development mode:
- OTPs are logged to console instead of being sent via SMS
- All other functionality (rate limiting, expiry, verification) works normally

### Manual Testing

1. Start Redis and PostgreSQL
2. Start the auth service: `npm run dev`
3. Send OTP request:
```bash
curl -X POST http://localhost:3001/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```
4. Check logs for OTP (in dev mode)
5. Verify OTP:
```bash
curl -X POST http://localhost:3001/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "code": "123456"}'
```

## Production Deployment

### Prerequisites
1. Twilio account with verified phone number
2. Redis instance (production-ready)
3. PostgreSQL database
4. Environment variables configured

### Deployment Checklist
- [ ] Configure Twilio credentials
- [ ] Set up Redis with persistence
- [ ] Configure rate limiting parameters
- [ ] Set up monitoring and alerting
- [ ] Test SMS delivery in production
- [ ] Monitor SMS delivery success rate
- [ ] Set up log aggregation

## Monitoring

### Key Metrics to Monitor

1. **OTP Generation Rate:** Requests per minute/hour
2. **SMS Delivery Success Rate:** Successful deliveries / total attempts
3. **OTP Verification Success Rate:** Valid verifications / total attempts
4. **Rate Limit Hits:** Number of rate limit violations
5. **SMS Delivery Latency:** Time to deliver SMS
6. **Redis Connection Health:** Connection errors and latency

### Alerts to Configure

1. SMS delivery success rate < 95%
2. OTP verification failure rate > 10%
3. Rate limit hits > 100/hour (potential abuse)
4. Redis connection failures
5. Twilio API errors

## Cost Optimization

### SMS Costs
- Twilio: ~$0.0075 per SMS (India)
- MSG91: ~$0.003 per SMS (India)

### Optimization Strategies
1. Implement resend delay to reduce unnecessary SMS
2. Use rate limiting to prevent abuse
3. Consider voice OTP for high-value transactions
4. Monitor and block suspicious phone numbers
5. Use local SMS providers (MSG91) for lower costs

## Future Enhancements

1. **Voice OTP:** Add voice call option for OTP delivery
2. **WhatsApp OTP:** Integrate WhatsApp Business API
3. **Email OTP:** Add email as alternative delivery method
4. **Adaptive Rate Limiting:** Adjust limits based on user behavior
5. **Fraud Detection:** ML-based suspicious activity detection
6. **Multi-Factor Authentication:** Add additional security layers
7. **OTP Analytics:** Dashboard for OTP metrics and insights

## Compliance

### DPDP Act 2023 (India)
- User consent obtained before sending SMS
- Phone numbers stored securely
- OTP data retained only for necessary duration (5 minutes)
- Audit logs maintained for security events

### TRAI Regulations
- SMS sent only to opted-in users
- Sender ID registered with telecom operators
- Opt-out mechanism provided

## Troubleshooting

### Common Issues

**Issue:** OTP not received
- Check Twilio credentials
- Verify phone number format (+91...)
- Check SMS delivery logs
- Verify Twilio account balance

**Issue:** Rate limit exceeded
- Check Redis for rate limit keys
- Verify rate limit configuration
- Clear rate limit: `redis-cli DEL rate_limit:otp:{phone}`

**Issue:** OTP expired
- Verify Redis TTL configuration
- Check system time synchronization
- Increase OTP_EXPIRY if needed

**Issue:** SMS delivery failed
- Check Twilio API status
- Verify network connectivity
- Check Twilio error logs
- Verify phone number is not blocked

## Support

For issues or questions:
1. Check logs: `npm run logs`
2. Verify configuration: `.env` file
3. Test Redis connection: `npm run test:redis`
4. Contact Twilio support for SMS issues
5. Review this documentation

---

**Implementation Date:** January 2026  
**Version:** 1.0.0  
**Status:** Production Ready  
**Validates:** Requirements 1.1, 1.2, 1.5, Design Section 8.1
