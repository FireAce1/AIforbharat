"""
Comprehensive Redis caching middleware for FastAPI services

Features:
- Automatic cache key generation based on service:endpoint:params_hash
- Configurable TTL per endpoint
- X-Cache-Status header (HIT/MISS) for debugging
- Cache invalidation on POST/PUT/DELETE operations
- Cache hit/miss metrics tracking
"""

import hashlib
import json
from typing import Optional, Callable, List, Dict, Any
from functools import wraps
from fastapi import Request, Response
from fastapi.responses import JSONResponse
import redis
import logging

logger = logging.getLogger(__name__)


class CacheMetrics:
    """Track cache performance metrics"""
    
    def __init__(self):
        self.hits = 0
        self.misses = 0
        self.invalidations = 0
    
    def get_hit_rate(self) -> float:
        """Calculate cache hit rate percentage"""
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0
    
    def reset(self):
        """Reset all metrics"""
        self.hits = 0
        self.misses = 0
        self.invalidations = 0


class CacheMiddleware:
    """Redis caching middleware for FastAPI"""
    
    def __init__(self, redis_client: redis.Redis, service_name: str):
        self.redis_client = redis_client
        self.service_name = service_name
        self.metrics = CacheMetrics()
    
    def _generate_cache_key(
        self,
        endpoint: str,
        params: Dict[str, Any],
        key_prefix: Optional[str] = None,
        exclude_params: Optional[List[str]] = None
    ) -> str:
        """
        Generate cache key from endpoint and parameters
        
        Format: service:endpoint:params_hash
        """
        # Filter out excluded params
        filtered_params = {
            k: v for k, v in params.items()
            if not exclude_params or k not in exclude_params
        }
        
        # Sort params for consistent key generation
        sorted_params = dict(sorted(filtered_params.items()))
        
        # Generate hash of params
        params_str = json.dumps(sorted_params, sort_keys=True)
        params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]
        
        # Format: service:endpoint:params_hash
        prefix = key_prefix or self.service_name
        endpoint_clean = endpoint.replace('/api/v1/', '').replace('/', ':')
        
        return f"{prefix}:{endpoint_clean}:{params_hash}"
    
    def cache(
        self,
        ttl: int = 3600,
        key_prefix: Optional[str] = None,
        exclude_params: Optional[List[str]] = None
    ):
        """
        Decorator for caching GET requests
        
        Args:
            ttl: Time to live in seconds
            key_prefix: Optional prefix for cache keys
            exclude_params: Query params to exclude from cache key
        """
        def decorator(func: Callable):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Extract request from kwargs
                request: Optional[Request] = kwargs.get('request')
                
                if not request or request.method != 'GET':
                    # Don't cache non-GET requests
                    return await func(*args, **kwargs)
                
                try:
                    # Generate cache key
                    params = dict(request.query_params)
                    cache_key = self._generate_cache_key(
                        request.url.path,
                        params,
                        key_prefix,
                        exclude_params
                    )
                    
                    # Try to get from cache
                    cached_data = self.redis_client.get(cache_key)
                    
                    if cached_data:
                        # Cache HIT
                        self.metrics.hits += 1
                        data = json.loads(cached_data)
                        
                        logger.info(f"Cache HIT: {cache_key}")
                        
                        return JSONResponse(
                            content=data,
                            headers={
                                'X-Cache-Status': 'HIT',
                                'X-Cache-Key': cache_key
                            }
                        )
                    
                    # Cache MISS - execute function
                    self.metrics.misses += 1
                    result = await func(*args, **kwargs)
                    
                    # Store in cache
                    try:
                        if isinstance(result, JSONResponse):
                            # Extract content from JSONResponse
                            cache_data = result.body.decode('utf-8')
                        else:
                            cache_data = json.dumps(result)
                        
                        self.redis_client.setex(cache_key, ttl, cache_data)
                        logger.info(f"Cache MISS: {cache_key} (stored with TTL={ttl}s)")
                    except Exception as e:
                        logger.error(f"Cache set error: {e}")
                    
                    # Add cache headers to response
                    if isinstance(result, JSONResponse):
                        result.headers['X-Cache-Status'] = 'MISS'
                        result.headers['X-Cache-Key'] = cache_key
                        return result
                    else:
                        return JSONResponse(
                            content=result,
                            headers={
                                'X-Cache-Status': 'MISS',
                                'X-Cache-Key': cache_key
                            }
                        )
                
                except Exception as e:
                    logger.error(f"Cache middleware error: {e}")
                    # Continue without caching on error
                    return await func(*args, **kwargs)
            
            return wrapper
        return decorator
    
    def invalidate_pattern(self, patterns: List[str]) -> int:
        """
        Invalidate cache keys matching patterns
        
        Args:
            patterns: List of patterns to match (e.g., ['crop:recommend:*'])
        
        Returns:
            Number of keys invalidated
        """
        total_invalidated = 0
        
        try:
            for pattern in patterns:
                full_pattern = f"{self.service_name}:{pattern}"
                
                # Scan for matching keys
                cursor = 0
                keys_to_delete = []
                
                while True:
                    cursor, keys = self.redis_client.scan(
                        cursor,
                        match=full_pattern,
                        count=100
                    )
                    keys_to_delete.extend(keys)
                    
                    if cursor == 0:
                        break
                
                # Delete keys
                if keys_to_delete:
                    deleted = self.redis_client.delete(*keys_to_delete)
                    total_invalidated += deleted
                    self.metrics.invalidations += deleted
                    logger.info(f"Invalidated {deleted} cache keys matching pattern: {pattern}")
        
        except Exception as e:
            logger.error(f"Cache invalidation error: {e}")
        
        return total_invalidated
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get cache metrics"""
        return {
            'hits': self.metrics.hits,
            'misses': self.metrics.misses,
            'invalidations': self.metrics.invalidations,
            'hit_rate': round(self.metrics.get_hit_rate(), 2)
        }
    
    def reset_metrics(self):
        """Reset cache metrics"""
        self.metrics.reset()


# Cache configuration presets
class CachePresets:
    """Predefined cache configurations for different endpoint types"""
    
    # Market prices: 1 hour TTL
    PRICES = {'ttl': 3600, 'key_prefix': 'market'}
    
    # Weather forecasts: 6 hours TTL
    WEATHER = {'ttl': 21600, 'key_prefix': 'climate'}
    
    # Government schemes: 24 hours TTL
    SCHEMES = {'ttl': 86400, 'key_prefix': 'govt'}
    
    # Crop recommendations: 24 hours TTL
    CROP_RECOMMENDATIONS = {'ttl': 86400, 'key_prefix': 'crop'}
    
    # Short-lived cache: 5 minutes TTL
    SHORT = {'ttl': 300}
    
    # Medium-lived cache: 1 hour TTL
    MEDIUM = {'ttl': 3600}
    
    # Long-lived cache: 24 hours TTL
    LONG = {'ttl': 86400}
