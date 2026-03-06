# Authentication Guide

## Overview

KrishiAI uses phone-based authentication with OTP (One-Time Password) verification and JWT (JSON Web Token) for session management. This approach is designed for farmers with limited digital literacy and provides secure, passwordless authentication.

## Authentication Flow

```
┌─────────┐                ┌──────────────┐                ┌─────────┐
│  User   │                │ Auth Service │                │   SMS   │
└────┬────┘                └──────┬───────┘                └────┬────┘
     │                            │                             │
     │  1. Send OTP               │                             │
     ├───────────────────────────>│                             │
     │  POST /auth/send-otp       │                             │
     │  { phone: "+919876543210" }│                             │
     │                            │                             │
     │                            │  2. Generate & Send OTP     │
     │                            ├────────────────────────────>│
     │                            │                             │
     │  3. OTP Response           │                             │
     │<───────────────────────────┤                             │
     │  { message: "OTP sent" }   │                             │
     │                            │                             │
     │  4. Verify OTP             │                             │
     ├───────────────────────────>│                             │
     │  POST /auth/verify-otp     │                             │
     │  { phone: "+919876543210", │                             │
     │    code: "123456" }        │                             │
     │                            │                             │
     │  5. JWT Token              │                             │
     │<───────────────────────────┤                             │
     │  { token: "eyJhbGc...",    │                             │
     │    user: {...} }           │                             │
     │                            │                             │
     │  6. Access Protected API   │                             │
     ├───────────────────────────>│                             │
     │  GET /crop/recommend       │                             │
     │  Authorization: Bearer ... │                             │
     │                            │                             │
     │  7. API Response           │                             │
     │<───────────────────────────┤                             │
     │                            │                             │
```

## Step 1: Send OTP

Request an OTP to be sent to the user's phone number.

### Endpoint

```
POST /api/v1/auth/send-otp
```

### Request Body

```json
{
  "phone": "+919876543210"
}
```

### Request Schema

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| phone | string | Yes | `/^\+91[6-9]\d{9}$/` | Indian phone number with +91 country code |

### Response (200 OK)

```json
{
  "message": "OTP sent successfully",
  "expiresIn": 300
}
```

### Response Schema

| Field | Type | Description |
|-------|------|-------------|
| message | string | Success message |
| expiresIn | number | OTP expiry time in seconds (300 = 5 minutes) |

### Error Responses

**400 Bad Request** - Invalid phone number format
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

**429 Too Many Requests** - Rate limit exceeded
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

### Rate Limiting

- **Limit**: 5 OTP requests per hour per phone number
- **Window**: 1 hour (3600 seconds)
- **Resend Interval**: 30 seconds minimum between requests

### Example Request

```bash
curl -X POST "https://api.krishiai.com/api/v1/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210"
  }'
```

## Step 2: Verify OTP

Verify the OTP code and receive a JWT token for authenticated requests.

### Endpoint

```
POST /api/v1/auth/verify-otp
```

### Request Body

```json
{
  "phone": "+919876543210",
  "code": "123456"
}
```

### Request Schema

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| phone | string | Yes | `/^\+91[6-9]\d{9}$/` | Indian phone number with +91 country code |
| code | string | Yes | 6 digits | OTP code received via SMS |

### Response (200 OK)

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3OC05MGFiLWNkZWYtMTIzNC01Njc4OTBhYmNkZWYiLCJwaG9uZSI6Iis5MTk4NzY1NDMyMTAiLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MTcwNDY3MjAwMH0.abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
  "user": {
    "id": "12345678-90ab-cdef-1234-567890abcdef",
    "phone": "+919876543210",
    "name": null,
    "language": "hi",
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  "expiresIn": 604800
}
```

### Response Schema

| Field | Type | Description |
|-------|------|-------------|
| token | string | JWT token for authenticated requests |
| user | object | User profile information |
| user.id | string (UUID) | Unique user identifier |
| user.phone | string | User's phone number |
| user.name | string \| null | User's name (null if not set) |
| user.language | string | Preferred language (hi/mr) |
| user.createdAt | string (ISO 8601) | Account creation timestamp |
| expiresIn | number | Token expiry time in seconds (604800 = 7 days) |

### Error Responses

**400 Bad Request** - Invalid OTP code
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

**404 Not Found** - OTP not found
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

### Example Request

```bash
curl -X POST "https://api.krishiai.com/api/v1/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "code": "123456"
  }'
```

## Step 3: Using JWT Token

Include the JWT token in the Authorization header for all authenticated requests.

### Header Format

```
Authorization: Bearer <your-jwt-token>
```

### Example Authenticated Request

```bash
curl -X GET "https://api.krishiai.com/api/v1/crop/recommend" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

### Token Expiry

- **Expiry Time**: 7 days (604800 seconds)
- **Refresh**: Use the `/auth/refresh` endpoint before expiry
- **Behavior**: After expiry, requests will return 401 Unauthorized

## Token Refresh

Refresh an existing JWT token to extend the session.

### Endpoint

```
POST /api/v1/auth/refresh
```

### Request Headers

```
Authorization: Bearer <your-current-token>
```

### Response (200 OK)

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new-token-here",
  "expiresIn": 604800
}
```

### Error Responses

**401 Unauthorized** - Invalid or expired token
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

### Example Request

```bash
curl -X POST "https://api.krishiai.com/api/v1/auth/refresh" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## User Profile

Get the authenticated user's profile information.

### Endpoint

```
GET /api/v1/auth/profile
```

### Request Headers

```
Authorization: Bearer <your-jwt-token>
```

### Response (200 OK)

```json
{
  "id": "12345678-90ab-cdef-1234-567890abcdef",
  "phone": "+919876543210",
  "name": "राज कुमार",
  "language": "hi",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "lastActive": "2026-01-05T10:30:00.000Z"
}
```

### Example Request

```bash
curl -X GET "https://api.krishiai.com/api/v1/auth/profile" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Security Best Practices

### For Clients

1. **Store tokens securely**: Use secure storage mechanisms (Keychain on iOS, Keystore on Android)
2. **Never log tokens**: Avoid logging JWT tokens in application logs
3. **Implement token refresh**: Refresh tokens before expiry to maintain session
4. **Handle 401 errors**: Redirect to login when receiving 401 Unauthorized
5. **Use HTTPS**: Always use HTTPS in production to prevent token interception

### For Servers

1. **Token signing**: Tokens are signed with HS256 algorithm using a secret key
2. **Token validation**: All protected endpoints validate token signature and expiry
3. **Rate limiting**: OTP endpoints are rate-limited to prevent abuse
4. **OTP security**: OTPs are hashed before storage and expire after 5 minutes
5. **Single-use OTPs**: Each OTP can only be used once

## JWT Token Structure

### Header

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### Payload

```json
{
  "userId": "12345678-90ab-cdef-1234-567890abcdef",
  "phone": "+919876543210",
  "iat": 1704067200,
  "exp": 1704672000
}
```

### Signature

```
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  secret
)
```

## Common Authentication Errors

| Error Code | HTTP Status | Description | Solution |
|------------|-------------|-------------|----------|
| VALIDATION_ERROR | 400 | Invalid request format | Check request body schema |
| INVALID_OTP | 400 | Wrong or expired OTP | Request a new OTP |
| OTP_NOT_FOUND | 404 | No OTP for phone number | Send OTP first |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests | Wait for retry-after period |
| INVALID_TOKEN | 401 | Invalid or expired JWT | Re-authenticate with OTP |
| TOKEN_EXPIRED | 401 | JWT token has expired | Refresh token or re-authenticate |
| UNAUTHORIZED | 401 | Missing or invalid auth | Include valid Bearer token |

## Testing Authentication

### Development Environment

For testing purposes, you can use the following test phone numbers that bypass SMS sending:

```
+919999999991 - Always returns OTP: 111111
+919999999992 - Always returns OTP: 222222
+919999999993 - Always returns OTP: 333333
```

**Note**: Test phone numbers only work in development environment.

### Example Test Flow

```bash
# 1. Send OTP
curl -X POST "http://localhost:3000/api/v1/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919999999991"}'

# 2. Verify OTP (use 111111 for test phone)
curl -X POST "http://localhost:3000/api/v1/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919999999991", "code": "111111"}'

# 3. Use returned token for authenticated requests
curl -X GET "http://localhost:3000/api/v1/auth/profile" \
  -H "Authorization: Bearer <token-from-step-2>"
```

## Support

For authentication issues:
- Check [error-codes.md](./error-codes.md) for detailed error information
- Contact: auth-support@krishiai.com
- Documentation: https://docs.krishiai.com/authentication
