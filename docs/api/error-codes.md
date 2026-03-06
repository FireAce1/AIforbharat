# Error Codes Reference

## Overview

All KrishiAI API errors follow a consistent format with standardized error codes, HTTP status codes, and detailed error messages. This document provides a complete reference of all error codes used across the platform.

## Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "fieldName",
      "constraint": "Validation constraint",
      "additionalInfo": "Any additional context"
    }
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| error.code | string | Standardized error code (see tables below) |
| error.message | string | Human-readable error message |
| error.details | object | Additional error context (optional) |

## HTTP Status Codes

| Status Code | Meaning | Usage |
|-------------|---------|-------|
| 400 | Bad Request | Invalid request format or validation error |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., duplicate) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Service temporarily unavailable |

## Authentication Errors (Auth Service)

### VALIDATION_ERROR
- **HTTP Status**: 400
- **Description**: Request validation failed
- **Common Causes**: Invalid phone number format, missing required fields
- **Solution**: Check request body against API schema

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid phone number format",
    "details": {
      "field": "phone",
      "constraint": "Must match pattern: +91[6-9]\\d{9}"
    }
  }
}
```

### INVALID_OTP
- **HTTP Status**: 400
- **Description**: OTP code is incorrect or has expired
- **Common Causes**: Wrong OTP entered, OTP expired (>5 minutes)
- **Solution**: Request a new OTP

```json
{
  "error": {
    "code": "INVALID_OTP",
    "message": "Invalid or expired OTP code",
    "details": {
      "field": "code",
      "reason": "OTP does not match or has expired"
    }
  }
}
```

### OTP_NOT_FOUND
- **HTTP Status**: 404
- **Description**: No OTP found for the provided phone number
- **Common Causes**: OTP not requested, OTP already used
- **Solution**: Send OTP first using /auth/send-otp

```json
{
  "error": {
    "code": "OTP_NOT_FOUND",
    "message": "No OTP found for this phone number",
    "details": {
      "field": "phone",
      "reason": "Please request a new OTP"
    }
  }
}
```

### RATE_LIMIT_EXCEEDED
- **HTTP Status**: 429
- **Description**: Too many requests within the rate limit window
- **Common Causes**: Exceeded 5 OTP requests per hour
- **Solution**: Wait for the retry-after period

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many OTP requests. Please try again later.",
    "details": {
      "limit": 5,
      "window": "1 hour",
      "retryAfter": 3456
    }
  }
}
```

### INVALID_TOKEN
- **HTTP Status**: 401
- **Description**: JWT token is invalid or malformed
- **Common Causes**: Token tampered with, wrong secret key
- **Solution**: Re-authenticate to get a new token

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired token",
    "details": {
      "reason": "Token has expired or is malformed"
    }
  }
}
```

### TOKEN_EXPIRED
- **HTTP Status**: 401
- **Description**: JWT token has expired (>7 days old)
- **Common Causes**: Token not refreshed within 7 days
- **Solution**: Re-authenticate or use /auth/refresh

```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Token has expired",
    "details": {
      "expiredAt": "2026-01-08T00:00:00.000Z",
      "currentTime": "2026-01-10T00:00:00.000Z"
    }
  }
}
```

### UNAUTHORIZED
- **HTTP Status**: 401
- **Description**: Missing or invalid authorization header
- **Common Causes**: No Authorization header, wrong format
- **Solution**: Include valid Bearer token in Authorization header

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization header",
    "details": {
      "expected": "Authorization: Bearer <token>"
    }
  }
}
```

## Crop Service Errors

### FARM_NOT_FOUND
- **HTTP Status**: 404
- **Description**: Farm profile not found for user
- **Common Causes**: User hasn't created farm profile
- **Solution**: Create farm profile first

```json
{
  "error": {
    "code": "FARM_NOT_FOUND",
    "message": "Farm profile not found",
    "details": {
      "userId": "12345678-90ab-cdef-1234-567890abcdef",
      "action": "Create farm profile in app settings"
    }
  }
}
```

### INVALID_IMAGE
- **HTTP Status**: 400
- **Description**: Uploaded image is invalid or corrupted
- **Common Causes**: Wrong file format, corrupted file, file too large
- **Solution**: Upload valid image (JPEG/PNG, <10MB)

```json
{
  "error": {
    "code": "INVALID_IMAGE",
    "message": "Invalid image file",
    "details": {
      "field": "image",
      "acceptedFormats": ["image/jpeg", "image/png"],
      "maxSize": "10MB"
    }
  }
}
```

### MODEL_INFERENCE_ERROR
- **HTTP Status**: 500
- **Description**: ML model inference failed
- **Common Causes**: Model not loaded, inference timeout
- **Solution**: Retry request, contact support if persists

```json
{
  "error": {
    "code": "MODEL_INFERENCE_ERROR",
    "message": "Failed to process image with AI model",
    "details": {
      "model": "disease_detector",
      "reason": "Inference timeout after 5 seconds"
    }
  }
}
```

### LOW_CONFIDENCE
- **HTTP Status**: 200
- **Description**: Model prediction has low confidence (<90%)
- **Common Causes**: Poor image quality, unclear disease symptoms
- **Solution**: Retake photo with better lighting and focus

```json
{
  "disease": "Unknown",
  "confidence": 0.65,
  "warning": {
    "code": "LOW_CONFIDENCE",
    "message": "Low confidence prediction. Please retake photo.",
    "suggestions": [
      "Ensure good lighting",
      "Focus on affected area",
      "Avoid blurry images"
    ]
  }
}
```

## Market Service Errors

### NO_MARKETS_FOUND
- **HTTP Status**: 404
- **Description**: No markets found within search radius
- **Common Causes**: Remote location, large search radius
- **Solution**: Increase search radius or check location

```json
{
  "error": {
    "code": "NO_MARKETS_FOUND",
    "message": "No markets found within 50km",
    "details": {
      "location": {
        "latitude": 19.0760,
        "longitude": 72.8777
      },
      "radius": 50,
      "suggestion": "Try increasing search radius"
    }
  }
}
```

### PRICE_DATA_UNAVAILABLE
- **HTTP Status**: 503
- **Description**: Price data temporarily unavailable
- **Common Causes**: External API failure, data update in progress
- **Solution**: Retry after a few minutes, cached data may be available

```json
{
  "error": {
    "code": "PRICE_DATA_UNAVAILABLE",
    "message": "Price data temporarily unavailable",
    "details": {
      "reason": "External API failure",
      "lastUpdate": "2026-01-05T06:00:00.000Z",
      "retryAfter": 300
    }
  }
}
```

### FORECAST_NOT_AVAILABLE
- **HTTP Status**: 404
- **Description**: Price forecast not available for crop
- **Common Causes**: Insufficient historical data, crop not supported
- **Solution**: Check supported crops list

```json
{
  "error": {
    "code": "FORECAST_NOT_AVAILABLE",
    "message": "Price forecast not available for this crop",
    "details": {
      "crop": "exotic_fruit",
      "reason": "Insufficient historical data",
      "supportedCrops": ["tomato", "onion", "potato", "wheat", "rice"]
    }
  }
}
```

## Climate Service Errors

### WEATHER_DATA_UNAVAILABLE
- **HTTP Status**: 503
- **Description**: Weather data temporarily unavailable
- **Common Causes**: IMD API failure, data update in progress
- **Solution**: Retry after a few minutes, cached data may be available

```json
{
  "error": {
    "code": "WEATHER_DATA_UNAVAILABLE",
    "message": "Weather data temporarily unavailable",
    "details": {
      "reason": "IMD API failure",
      "lastUpdate": "2026-01-05T06:00:00.000Z",
      "cachedDataAvailable": true,
      "retryAfter": 300
    }
  }
}
```

### LOCATION_OUT_OF_RANGE
- **HTTP Status**: 400
- **Description**: Location is outside service coverage area
- **Common Causes**: Location outside India
- **Solution**: Provide location within India

```json
{
  "error": {
    "code": "LOCATION_OUT_OF_RANGE",
    "message": "Location is outside service coverage area",
    "details": {
      "location": {
        "latitude": 51.5074,
        "longitude": -0.1278
      },
      "coverageArea": "India",
      "suggestion": "Service is currently available only in India"
    }
  }
}
```

### CROP_NOT_FOUND
- **HTTP Status**: 404
- **Description**: Crop information not found for water advisory
- **Common Causes**: No active crop in farm profile
- **Solution**: Add crop information to farm profile

```json
{
  "error": {
    "code": "CROP_NOT_FOUND",
    "message": "No active crop found for water advisory",
    "details": {
      "farmId": "12345678-90ab-cdef-1234-567890abcdef",
      "action": "Add crop information in farm profile"
    }
  }
}
```

## Government Service Errors

### NO_SCHEMES_FOUND
- **HTTP Status**: 404
- **Description**: No schemes match the search criteria
- **Common Causes**: Very specific filters, no eligible schemes
- **Solution**: Broaden search criteria

```json
{
  "error": {
    "code": "NO_SCHEMES_FOUND",
    "message": "No schemes found matching your criteria",
    "details": {
      "filters": {
        "state": "Maharashtra",
        "cropType": "exotic_fruit",
        "maxLandSize": 0.5
      },
      "suggestion": "Try removing some filters"
    }
  }
}
```

### SCHEME_NOT_FOUND
- **HTTP Status**: 404
- **Description**: Scheme with specified ID not found
- **Common Causes**: Invalid scheme ID, scheme expired
- **Solution**: Check scheme ID or search for active schemes

```json
{
  "error": {
    "code": "SCHEME_NOT_FOUND",
    "message": "Scheme not found",
    "details": {
      "schemeId": "12345678-90ab-cdef-1234-567890abcdef",
      "reason": "Scheme may have expired or been removed"
    }
  }
}
```

### SUBSCRIPTION_EXISTS
- **HTTP Status**: 409
- **Description**: User already subscribed to scheme alerts
- **Common Causes**: Duplicate subscription request
- **Solution**: No action needed, already subscribed

```json
{
  "error": {
    "code": "SUBSCRIPTION_EXISTS",
    "message": "Already subscribed to this scheme",
    "details": {
      "schemeId": "12345678-90ab-cdef-1234-567890abcdef",
      "subscribedAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

## Chatbot Service Errors

### INTENT_NOT_RECOGNIZED
- **HTTP Status**: 200
- **Description**: Chatbot couldn't understand the query (confidence <85%)
- **Common Causes**: Unclear query, unsupported intent
- **Solution**: Rephrase query or use specific keywords

```json
{
  "response": "मुझे आपका सवाल समझ नहीं आया। कृपया दोबारा पूछें या सहायता अनुभाग देखें।",
  "intent": "fallback",
  "confidence": 0.45,
  "suggestions": [
    "मौसम कैसा है?",
    "टमाटर का भाव क्या है?",
    "कौन सी फसल बोऊं?"
  ]
}
```

### VOICE_PROCESSING_ERROR
- **HTTP Status**: 500
- **Description**: Voice input processing failed
- **Common Causes**: Audio quality issues, unsupported format
- **Solution**: Retry with clearer audio

```json
{
  "error": {
    "code": "VOICE_PROCESSING_ERROR",
    "message": "Failed to process voice input",
    "details": {
      "reason": "Audio quality too low",
      "acceptedFormats": ["audio/wav", "audio/mp3"],
      "maxDuration": "60 seconds"
    }
  }
}
```

## General Errors

### INTERNAL_SERVER_ERROR
- **HTTP Status**: 500
- **Description**: Unexpected server error
- **Common Causes**: Unhandled exception, database error
- **Solution**: Retry request, contact support if persists

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "requestId": "req_12345678",
      "timestamp": "2026-01-05T10:30:00.000Z",
      "support": "Contact support@krishiai.com with request ID"
    }
  }
}
```

### SERVICE_UNAVAILABLE
- **HTTP Status**: 503
- **Description**: Service temporarily unavailable
- **Common Causes**: Maintenance, high load, dependency failure
- **Solution**: Retry after specified time

```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service temporarily unavailable",
    "details": {
      "reason": "Scheduled maintenance",
      "retryAfter": 1800,
      "estimatedResolution": "2026-01-05T12:00:00.000Z"
    }
  }
}
```

### DATABASE_ERROR
- **HTTP Status**: 500
- **Description**: Database operation failed
- **Common Causes**: Connection timeout, query error
- **Solution**: Retry request, contact support if persists

```json
{
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database operation failed",
    "details": {
      "operation": "SELECT",
      "reason": "Connection timeout",
      "requestId": "req_12345678"
    }
  }
}
```

### CACHE_ERROR
- **HTTP Status**: 500
- **Description**: Cache operation failed
- **Common Causes**: Redis connection error
- **Solution**: Request will proceed without cache, retry if needed

```json
{
  "error": {
    "code": "CACHE_ERROR",
    "message": "Cache operation failed",
    "details": {
      "operation": "GET",
      "reason": "Redis connection timeout",
      "fallback": "Fetching from database"
    }
  }
}
```

## Error Code Summary Table

| Error Code | HTTP Status | Service | Description |
|------------|-------------|---------|-------------|
| VALIDATION_ERROR | 400 | All | Request validation failed |
| INVALID_OTP | 400 | Auth | OTP incorrect or expired |
| OTP_NOT_FOUND | 404 | Auth | No OTP for phone number |
| RATE_LIMIT_EXCEEDED | 429 | All | Rate limit exceeded |
| INVALID_TOKEN | 401 | All | Invalid JWT token |
| TOKEN_EXPIRED | 401 | All | JWT token expired |
| UNAUTHORIZED | 401 | All | Missing/invalid auth |
| FARM_NOT_FOUND | 404 | Crop | Farm profile not found |
| INVALID_IMAGE | 400 | Crop | Invalid image file |
| MODEL_INFERENCE_ERROR | 500 | Crop | ML inference failed |
| LOW_CONFIDENCE | 200 | Crop | Low prediction confidence |
| NO_MARKETS_FOUND | 404 | Market | No markets in radius |
| PRICE_DATA_UNAVAILABLE | 503 | Market | Price data unavailable |
| FORECAST_NOT_AVAILABLE | 404 | Market | Forecast not available |
| WEATHER_DATA_UNAVAILABLE | 503 | Climate | Weather data unavailable |
| LOCATION_OUT_OF_RANGE | 400 | Climate | Location outside coverage |
| CROP_NOT_FOUND | 404 | Climate | No active crop found |
| NO_SCHEMES_FOUND | 404 | Government | No matching schemes |
| SCHEME_NOT_FOUND | 404 | Government | Scheme not found |
| SUBSCRIPTION_EXISTS | 409 | Government | Already subscribed |
| INTENT_NOT_RECOGNIZED | 200 | Chatbot | Intent not understood |
| VOICE_PROCESSING_ERROR | 500 | Chatbot | Voice processing failed |
| INTERNAL_SERVER_ERROR | 500 | All | Unexpected server error |
| SERVICE_UNAVAILABLE | 503 | All | Service unavailable |
| DATABASE_ERROR | 500 | All | Database operation failed |
| CACHE_ERROR | 500 | All | Cache operation failed |

## Handling Errors in Client Applications

### Best Practices

1. **Check HTTP status code first**: Determine error category (4xx vs 5xx)
2. **Parse error.code**: Use error code for programmatic handling
3. **Display error.message**: Show user-friendly message to users
4. **Use error.details**: Extract additional context for debugging
5. **Implement retry logic**: Retry on 5xx errors with exponential backoff
6. **Log errors**: Log error details for debugging and monitoring

### Example Error Handling (JavaScript)

```javascript
try {
  const response = await fetch('https://api.krishiai.com/api/v1/crop/recommend', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    
    switch (error.error.code) {
      case 'UNAUTHORIZED':
      case 'TOKEN_EXPIRED':
        // Redirect to login
        redirectToLogin();
        break;
        
      case 'RATE_LIMIT_EXCEEDED':
        // Wait and retry
        const retryAfter = error.error.details.retryAfter;
        await sleep(retryAfter * 1000);
        return retry();
        
      case 'FARM_NOT_FOUND':
        // Redirect to farm profile creation
        redirectToFarmProfile();
        break;
        
      case 'INTERNAL_SERVER_ERROR':
      case 'SERVICE_UNAVAILABLE':
        // Retry with exponential backoff
        return retryWithBackoff();
        
      default:
        // Show error message to user
        showError(error.error.message);
    }
  }
  
  const data = await response.json();
  return data;
  
} catch (error) {
  // Network error or parsing error
  console.error('Request failed:', error);
  showError('Network error. Please check your connection.');
}
```

## Support

For error-related questions:
- Documentation: https://docs.krishiai.com/errors
- Support: support@krishiai.com
- Status Page: https://status.krishiai.com
