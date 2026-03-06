# Redis Caching Infrastructure Setup

## Overview

Redis caching infrastructure has been successfully configured for the KrishiAI auth-service with connection pooling, standardized key naming conventions, and TTL policies.

## Components Implemented

### 1. Redis Configuration (`src/config/redis.js`)

- Connection pooling with automatic retry strategy
- Exponential backoff for reconnection attempts
- Event handlers for connection lifecycle
- Graceful shutdown support

**Configuration:**
- Host: `localhost` (configurable via `REDIS_HOST`)
- Port: `6379` (configurable via `REDIS_PORT`)
- Password: Protected (configurable via `REDIS_PASSWORD`)
- Database: `0` (configurable via `REDIS_DB`)
- Connection timeout: 10 seconds
- Keep-alive: 5 seconds

### 2. Cache Utility Module (`src/utils/cache.js`)

Comprehensive Redis operations with standardized interface:

**Key Naming Convention:**
- Format: `service:resource:id`
- Examples:
  - `auth:otp:+919876543210`
  - `auth:session:user-uuid-123`
  - `crop:recommendation:farm-uuid-456`

**TTL Policies:**
- OTP: 300 seconds (5 minutes)
- API Response: 3600 seconds (1 hour)
- Session: 604800 seconds (7 days)

**Available Operations:**
- Basic: `get`, `set`, `del`, `delMultiple`
- JSON: `getJSON`, `setJSON`
- Key Management: `exists`, `expire`, `ttl`, `keys`
- Counters: `incr`, `incrWithExpiry`
- Utility: `flushDB`

### 3. Service Integration (`src/index.js`)

- Redis client initialization on server startup
- Graceful shutdown handling (SIGTERM, SIGINT)
- Error handling and logging

## Usage Examples

### Store OTP with 5-minute expiry
```javascript
const cache = require('./utils/cache');

const key = cache.generateKey('auth', 'otp', phone);
await cache.set(key, otpCode, cache.TTL.OTP);
```

### Implement Rate Limiting
```javascript
const rateLimitKey = cache.generateKey('auth', 'ratelimit', phone);
const count = await cache.incrWithExpiry(rateLimitKey, 3600);

if (count > 5) {
  throw new Error('Rate limit exceeded');
}
```

### Store User Session
```javascript
const sessionKey = cache.generateKey('auth', 'session', userId);
await cache.setJSON(sessionKey, sessionData, cache.TTL.SESSION);
```

## Testing

Run the Redis test suite:
```bash
node test-redis.js
```

**Test Coverage:**
- ✓ Connection initialization
- ✓ Basic SET/GET operations
- ✓ JSON operations
- ✓ TTL management
- ✓ Counter operations
- ✓ Rate limiting scenarios
- ✓ Key pattern matching
- ✓ DELETE operations

## Environment Variables

Required environment variables in `.env`:
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=krishiai_redis_password
REDIS_DB=0
```

## Dependencies

- `redis@^4.6.10` - Official Redis client for Node.js

## Docker Setup

Redis is configured in `docker-compose.yml`:
- Image: `redis:7-alpine`
- Port: `6379`
- Persistence: Append-only file (AOF)
- Password protected
- Health checks enabled

## Connection Pooling

The Redis client maintains connection pooling automatically:
- Maximum 20 concurrent connections (as per requirements)
- Automatic connection reuse
- Connection lifecycle management
- Retry strategy with exponential backoff

## Error Handling

All cache operations include graceful error handling:
- Errors are logged but don't throw exceptions
- Returns null/false/empty values on failure
- Application continues to function if Redis is unavailable

## Security

- Password authentication enabled
- Connection over localhost (production should use TLS)
- No sensitive data logged
- Automatic key expiration prevents data accumulation

## Performance Considerations

- Connection pooling reduces overhead
- TTL policies prevent memory bloat
- Efficient key naming for pattern matching
- JSON operations use native serialization

## Next Steps

This Redis infrastructure is ready for:
1. OTP storage and verification (Task 2.2)
2. JWT token blacklisting (Task 2.4)
3. Rate limiting implementation (Task 2.2)
4. Session management
5. API response caching

## Validation

✓ Requirements 15.1 - Security: Caching infrastructure supports secure data handling
✓ Design Section 9.1 - Caching Strategy: Implements Redis with TTL policies and key conventions
