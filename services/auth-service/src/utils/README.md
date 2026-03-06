# Redis Cache Utilities

This module provides a standardized interface for Redis caching operations in the KrishiAI platform.

## Key Naming Convention

All cache keys follow the pattern: `service:resource:id`

Examples:
- `auth:otp:+919876543210`
- `auth:session:user-uuid-123`
- `crop:recommendation:farm-uuid-456`
- `market:prices:tomato:mumbai`

## TTL Policies

The following TTL (Time To Live) policies are enforced:

- **OTP**: 300 seconds (5 minutes)
- **API Responses**: 3600 seconds (1 hour)
- **Sessions**: 604800 seconds (7 days)

## Usage Examples

### Basic Operations

```javascript
const cache = require('./cache');

// Generate a standardized key
const key = cache.generateKey('auth', 'otp', '+919876543210');
// Result: 'auth:otp:+919876543210'

// Store OTP with 5-minute expiry
await cache.set(key, '123456', cache.TTL.OTP);

// Retrieve OTP
const otp = await cache.get(key);

// Delete OTP after verification
await cache.del(key);
```

### JSON Operations

```javascript
// Store user session as JSON
const sessionKey = cache.generateKey('auth', 'session', userId);
await cache.setJSON(sessionKey, {
  userId: 'user-123',
  phone: '+919876543210',
  language: 'hi',
  loginAt: Date.now()
}, cache.TTL.SESSION);

// Retrieve session
const session = await cache.getJSON(sessionKey);
```

### Rate Limiting

```javascript
// Implement OTP rate limiting (5 requests per hour)
const rateLimitKey = cache.generateKey('auth', 'ratelimit', phone);
const count = await cache.incrWithExpiry(rateLimitKey, 3600); // 1 hour

if (count > 5) {
  throw new Error('Rate limit exceeded. Try again later.');
}
```

### Counter Operations

```javascript
// Increment counter
const counterKey = cache.generateKey('auth', 'login-attempts', userId);
const attempts = await cache.incr(counterKey);

// Set expiry on counter
await cache.expire(counterKey, 900); // 15 minutes
```

### Key Management

```javascript
// Check if key exists
const exists = await cache.exists(key);

// Get remaining TTL
const remainingTTL = await cache.ttl(key);

// Find all OTP keys
const otpKeys = await cache.keys('auth:otp:*');

// Delete multiple keys
await cache.delMultiple(otpKeys);
```

## API Reference

### Key Generation

- `generateKey(service, resource, id)` - Generate standardized cache key

### Basic Operations

- `get(key)` - Get string value
- `getJSON(key)` - Get and parse JSON value
- `set(key, value, ttl)` - Set string value with optional TTL
- `setJSON(key, value, ttl)` - Stringify and set JSON value with optional TTL
- `del(key)` - Delete single key
- `delMultiple(keys)` - Delete multiple keys

### Key Management

- `exists(key)` - Check if key exists
- `expire(key, ttl)` - Set expiration on existing key
- `ttl(key)` - Get remaining TTL for key
- `keys(pattern)` - Find keys matching pattern

### Counter Operations

- `incr(key)` - Increment counter by 1
- `incrWithExpiry(key, ttl)` - Increment counter and set expiry on first increment

### Utility

- `flushDB()` - Clear all keys in current database (use with caution!)

## Connection Pooling

The Redis client is configured with:
- Maximum 20 concurrent connections
- Automatic reconnection with exponential backoff
- Connection timeout: 10 seconds
- Keep-alive: 5 seconds

## Error Handling

All cache operations include error handling and will:
- Log errors to console
- Return null/false/empty values on failure
- Never throw exceptions (fail gracefully)

This ensures that cache failures don't break the application.

## Best Practices

1. Always use `generateKey()` for consistent key naming
2. Set appropriate TTLs to prevent memory bloat
3. Use JSON operations for complex objects
4. Implement rate limiting with `incrWithExpiry()`
5. Clean up keys after use (e.g., delete OTP after verification)
6. Use pattern matching sparingly (can be slow on large datasets)
