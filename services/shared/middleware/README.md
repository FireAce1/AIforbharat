# Shared Middleware

This directory contains reusable middleware components for KrishiAI backend services.

## Cache Middleware

Comprehensive Redis caching middleware for Express/Node.js services.

### Features

- **Automatic Cache Key Generation**: Creates consistent cache keys based on service, endpoint, and parameters
- **Configurable TTL**: Set different TTLs for different endpoint types
- **Cache Headers**: Adds X-Cache-Status (HIT/MISS) and X-Cache-Key headers for debugging
- **Cache Invalidation**: Pattern-based invalidation on write operations
- **Performance Metrics**: Track cache hits, misses, invalidations, and hit rate

### Installation

```typescript
import CacheMiddleware, { CachePresets } from '../../../shared/middleware/cacheMiddleware';
import { redisClient } from '../config/redis';

// Initialize cache middleware
const cacheMiddleware = new CacheMiddleware(redisClient.getClient(), 'service-name');
```

### Usage

#### Caching GET Requests

```typescript
// Use preset configuration
router.get('/prices', cacheMiddleware.cache(CachePresets.PRICES), async (req, res) => {
  // Handler code
});

// Custom TTL
router.get('/custom', cacheMiddleware.cache({ ttl: 7200 }), async (req, res) => {
  // Handler code
});

// Exclude specific params from cache key
router.get('/search', cacheMiddleware.cache({
  ttl: 3600,
  excludeParams: ['page', 'limit']
}), async (req, res) => {
  // Handler code
});
```

#### Cache Invalidation on Write Operations

```typescript
// Invalidate related caches on POST/PUT/DELETE
router.post('/alerts', cacheMiddleware.invalidate(['prices:*', 'forecast:*']), async (req, res) => {
  // Handler code
});

router.delete('/alerts/:id', cacheMiddleware.invalidate(['alerts:*']), async (req, res) => {
  // Handler code
});
```

#### Get Cache Metrics

```typescript
router.get('/cache/metrics', async (req, res) => {
  const metrics = cacheMiddleware.getMetrics();
  
  res.json({
    success: true,
    data: {
      ...metrics,
      hit_rate_percentage: cacheMiddleware.getHitRate().toFixed(2),
    },
  });
});
```

### Cache Presets

Predefined configurations for common use cases:

```typescript
CachePresets = {
  PRICES: { ttl: 3600 },           // 1 hour - Market prices
  WEATHER: { ttl: 21600 },         // 6 hours - Weather forecasts
  SCHEMES: { ttl: 86400 },         // 24 hours - Government schemes
  CROP_RECOMMENDATIONS: { ttl: 86400 }, // 24 hours - Crop recommendations
  SHORT: { ttl: 300 },             // 5 minutes - Short-lived data
  MEDIUM: { ttl: 3600 },           // 1 hour - Medium-lived data
  LONG: { ttl: 86400 },            // 24 hours - Long-lived data
}
```

### Cache Key Format

Cache keys follow the pattern: `service:endpoint:params_hash`

Examples:
- `market:prices:a3f2b1c4`
- `climate:weather:forecast:7d8e9f0a`
- `govt:schemes:b2c3d4e5`

### Cache Headers

Responses include debugging headers:

```
X-Cache-Status: HIT | MISS
X-Cache-Key: service:endpoint:params_hash
```

### Metrics

Track cache performance:

```typescript
const metrics = cacheMiddleware.getMetrics();
// {
//   hits: 1250,
//   misses: 350,
//   invalidations: 45,
//   hit_rate_percentage: "78.13"
// }
```

### Best Practices

1. **Choose Appropriate TTLs**: Match TTL to data update frequency
2. **Invalidate on Writes**: Always invalidate related caches on POST/PUT/DELETE
3. **Monitor Hit Rates**: Aim for >70% hit rate for frequently accessed endpoints
4. **Use Presets**: Use predefined presets for consistency across services
5. **Exclude Dynamic Params**: Exclude pagination/sorting params from cache keys

### Testing

```bash
# Test cache HIT/MISS
curl -i http://localhost:3000/api/v1/market/prices?crop_name=Tomato&latitude=19.0760&longitude=72.8777

# Check metrics
curl http://localhost:3000/api/v1/market/cache/metrics
```

### Troubleshooting

**Low Hit Rate (<50%)**:
- Check if cache keys are consistent
- Verify TTL is appropriate for data update frequency
- Ensure params are sorted consistently

**High Memory Usage**:
- Reduce TTLs for less frequently accessed data
- Implement cache size limits
- Monitor Redis memory usage

**Stale Data**:
- Verify cache invalidation patterns
- Check TTL configuration
- Ensure write operations trigger invalidation

## Future Middleware

Additional middleware components planned:
- Rate limiting middleware
- Authentication middleware
- Request validation middleware
- Error handling middleware
- Logging middleware
