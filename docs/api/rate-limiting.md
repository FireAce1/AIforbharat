# Rate Limiting

## Overview

KrishiAI implements rate limiting to ensure fair usage, prevent abuse, and maintain system stability. Rate limits are applied per user (identified by JWT token) or per phone number (for authentication endpoints).

## Rate Limit Policies

### Authentication Endpoints

| Endpoint | Limit | Window | Identifier |
|----------|-------|--------|------------|
| POST /auth/send-otp | 5 requests | 1 hour | Phone number |
| POST /auth/verify-otp | 10 requests | 1 hour | Phone number |
| POST /auth/refresh | 20 requests | 1 hour | User ID |

### Standard API Endpoints

| Service | Limit | Window | Identifier |
|---------|-------|--------|------------|
| Crop Service | 1,000 requests | 1 hour | User ID |
| Market Service | 1,000 requests | 1 hour | User ID |
| Climate Service | 1,000 requests | 1 hour | User ID |
| Government Service | 1,000 requests | 1 hour | User ID |
| Chatbot Service | 1,000 requests | 1 hour | User ID |

### ML Inference Endpoints

| Endpoint | Limit | Window | Identifier |
|----------|-------|--------|------------|
| POST /crop/disease/detect | 50 requests | 1 hour | User ID |
| POST /crop/recommend | 100 requests | 1 hour | User ID |
| POST /chatbot/query | 200 requests | 1 hour | User ID |

## Rate Limit Headers

All API responses include rate limit information in the response headers:

### Response Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1704070800
X-RateLimit-Window: 3600
```

| Header | Description | Example |
|--------|-------------|---------|
| X-RateLimit-Limit | Maximum requests allowed in window | 1000 |
| X-RateLimit-Remaining | Requests remaining in current window | 995 |
| X-RateLimit-Reset | Unix timestamp when limit resets | 1704070800 |
| X-RateLimit-Window | Window duration in seconds | 3600 |

### Example Response

```bash
HTTP/1.1 200 OK
Content-Type: application/json
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1704070800
X-RateLimit-Window: 3600

{
  "data": { ... }
}
```

## Rate Limit Exceeded Response

When rate limit is exceeded, the API returns a 429 Too Many Requests response:

### Response Format

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "limit": 1000,
      "window": "1 hour",
      "retryAfter": 3456,
      "resetAt": "2026-01-05T12:00:00.000Z"
    }
  }
}
```

### Response Headers

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 3456
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704070800
X-RateLimit-Window: 3600
```

| Header | Description | Example |
|--------|-------------|---------|
| Retry-After | Seconds to wait before retrying | 3456 |

## Rate Limiting by Endpoint Type

### OTP Endpoints (Strict Limits)

OTP endpoints have the strictest rate limits to prevent abuse and SMS spam:

**POST /auth/send-otp**
- **Limit**: 5 requests per hour per phone number
- **Minimum Resend Interval**: 30 seconds
- **Reason**: Prevent SMS spam and abuse

```bash
# Example: Sending OTP
curl -X POST "https://api.krishiai.com/api/v1/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'

# Response headers
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1704070800
X-RateLimit-Window: 3600
```

**Rate Limit Exceeded Example**:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many OTP requests. Please try again later.",
    "details": {
      "limit": 5,
      "window": "1 hour",
      "retryAfter": 3456,
      "phone": "+919876543210"
    }
  }
}
```

### Standard API Endpoints (Moderate Limits)

Standard CRUD operations have moderate limits suitable for typical usage:

**Limit**: 1,000 requests per hour per user

```bash
# Example: Getting crop recommendations
curl -X GET "https://api.krishiai.com/api/v1/crop/recommend" \
  -H "Authorization: Bearer <token>"

# Response headers
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1704070800
```

### ML Inference Endpoints (Conservative Limits)

ML inference endpoints have lower limits due to computational cost:

**POST /crop/disease/detect**
- **Limit**: 50 requests per hour per user
- **Reason**: High computational cost of image inference

**POST /crop/recommend**
- **Limit**: 100 requests per hour per user
- **Reason**: Complex ML model inference

**POST /chatbot/query**
- **Limit**: 200 requests per hour per user
- **Reason**: NLP model inference

```bash
# Example: Disease detection
curl -X POST "https://api.krishiai.com/api/v1/crop/disease/detect" \
  -H "Authorization: Bearer <token>" \
  -F "image=@plant.jpg"

# Response headers
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 49
X-RateLimit-Reset: 1704070800
```

## Rate Limiting Algorithm

KrishiAI uses the **Sliding Window** algorithm for rate limiting:

### How It Works

1. **Window Creation**: A time window (e.g., 1 hour) is created for each user/phone
2. **Request Counting**: Each request increments the counter for that window
3. **Limit Check**: If counter exceeds limit, request is rejected with 429
4. **Window Sliding**: Old requests outside the window are automatically removed
5. **Reset**: Counter resets when window expires

### Example Timeline

```
Time:     00:00  00:15  00:30  00:45  01:00  01:15
Requests:   5      3      2      1      0      2
Counter:    5      8     10     11      6      8
Limit:     10     10     10     10     10     10
Status:    OK     OK     OK   REJECT   OK     OK
```

At 00:45, the 11th request is rejected because the counter (11) exceeds the limit (10).
At 01:00, requests from 00:00 slide out of the window, so the counter drops to 6.

## Handling Rate Limits in Client Applications

### Best Practices

1. **Monitor headers**: Check X-RateLimit-Remaining to track usage
2. **Implement backoff**: Wait for Retry-After seconds before retrying
3. **Cache responses**: Cache API responses to reduce requests
4. **Batch requests**: Combine multiple operations when possible
5. **Handle 429 gracefully**: Show user-friendly message and retry automatically

### Example Implementation (JavaScript)

```javascript
async function makeRequest(url, options, retries = 3) {
  try {
    const response = await fetch(url, options);
    
    // Log rate limit info
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const limit = response.headers.get('X-RateLimit-Limit');
    console.log(`Rate limit: ${remaining}/${limit} remaining`);
    
    // Handle rate limit exceeded
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      
      if (retries > 0) {
        console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
        await sleep(retryAfter * 1000);
        return makeRequest(url, options, retries - 1);
      } else {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
    }
    
    // Warn if approaching limit
    if (remaining && parseInt(remaining) < 10) {
      console.warn(`Warning: Only ${remaining} requests remaining`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Usage
const data = await makeRequest('https://api.krishiai.com/api/v1/crop/recommend', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Example Implementation (Python)

```python
import time
import requests

def make_request(url, headers, max_retries=3):
    retries = 0
    
    while retries < max_retries:
        response = requests.get(url, headers=headers)
        
        # Log rate limit info
        remaining = response.headers.get('X-RateLimit-Remaining')
        limit = response.headers.get('X-RateLimit-Limit')
        print(f"Rate limit: {remaining}/{limit} remaining")
        
        # Handle rate limit exceeded
        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 60))
            
            if retries < max_retries - 1:
                print(f"Rate limited. Retrying after {retry_after} seconds...")
                time.sleep(retry_after)
                retries += 1
                continue
            else:
                raise Exception('Rate limit exceeded. Please try again later.')
        
        # Warn if approaching limit
        if remaining and int(remaining) < 10:
            print(f"Warning: Only {remaining} requests remaining")
        
        response.raise_for_status()
        return response.json()
    
    raise Exception('Max retries exceeded')

# Usage
data = make_request(
    'https://api.krishiai.com/api/v1/crop/recommend',
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
)
```

## Rate Limit Exemptions

### Whitelisted IPs

Certain IP addresses may be whitelisted for higher limits:
- Internal monitoring systems
- Trusted partner integrations
- Load testing environments

Contact support@krishiai.com to request whitelisting.

### Premium Tier (Future)

Future premium tiers may offer higher rate limits:
- **Free Tier**: Current limits (1,000 req/hour)
- **Premium Tier**: 10,000 req/hour (planned)
- **Enterprise Tier**: Custom limits (planned)

## Monitoring Rate Limit Usage

### Dashboard

View your rate limit usage in the developer dashboard:
- https://dashboard.krishiai.com/rate-limits

### Metrics

Track the following metrics:
- **Total Requests**: Total requests made in current window
- **Remaining Requests**: Requests remaining before limit
- **Reset Time**: When the current window resets
- **429 Responses**: Number of rate limit exceeded responses

### Alerts

Set up alerts for:
- Approaching rate limit (e.g., 90% usage)
- Rate limit exceeded
- Unusual spike in requests

## Rate Limit FAQs

### Q: What happens if I exceed the rate limit?

A: You'll receive a 429 Too Many Requests response. Wait for the Retry-After period and try again.

### Q: Do rate limits reset at a fixed time?

A: No, rate limits use a sliding window. The window moves with your requests.

### Q: Are rate limits per user or per device?

A: Rate limits are per user (identified by JWT token) for authenticated endpoints, and per phone number for OTP endpoints.

### Q: Can I request higher rate limits?

A: Yes, contact support@krishiai.com with your use case. Premium tiers with higher limits are planned.

### Q: Do failed requests count toward the rate limit?

A: Yes, all requests (successful or failed) count toward the rate limit, except for 429 responses themselves.

### Q: How can I check my current rate limit usage?

A: Check the X-RateLimit-Remaining header in any API response, or view the developer dashboard.

### Q: Are there different limits for different endpoints?

A: Yes, ML inference endpoints have lower limits (50-200 req/hour) due to computational cost, while standard endpoints have higher limits (1,000 req/hour).

### Q: What if I need to make a burst of requests?

A: Consider caching responses, batching operations, or implementing request queuing in your application.

## Support

For rate limiting questions:
- Documentation: https://docs.krishiai.com/rate-limiting
- Support: support@krishiai.com
- Status: https://status.krishiai.com
