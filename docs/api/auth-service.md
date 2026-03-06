# Auth Service API Documentation

## Overview

The Auth Service handles user authentication and authorization using phone-based OTP verification and JWT tokens. This passwordless authentication approach is designed for farmers with limited digital literacy.

**Base URL**: `/api/v1/auth`

## Endpoints

### POST /send-otp

Send an OTP to the user's phone number via SMS.

**Rate Limit**: 5 requests per hour per phone number

**Request**:
```json
{
  "phone": "+919876543210"
}
```

**Response** (200 OK):
```json
{
  "message": "OTP sent successfully",
  "expiresIn": 300
}
```

**Errors**:
- `400 VALIDATION_ERROR`: Invalid phone number format
- `429 RATE_LIMIT_EXCEEDED`: Too many OTP requests

---

### POST /verify-otp

Verify the OTP code and receive a JWT token.

**Request**:
```json
{
  "phone": "+919876543210",
  "code": "123456"
}
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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

**Errors**:
- `400 INVALID_OTP`: OTP incorrect or expired
- `404 OTP_NOT_FOUND`: No OTP found for phone number

---

### POST /refresh

Refresh an existing JWT token.

**Headers**:
```
Authorization: Bearer <your-current-token>
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800
}
```

**Errors**:
- `401 INVALID_TOKEN`: Invalid or expired token

---

### GET /profile

Get the authenticated user's profile.

**Headers**:
```
Authorization: Bearer <your-jwt-token>
```

**Response** (200 OK):
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

**Errors**:
- `401 UNAUTHORIZED`: Missing or invalid token

## Authentication Flow

See [authentication.md](./authentication.md) for detailed authentication flow and best practices.

## Rate Limiting

See [rate-limiting.md](./rate-limiting.md) for rate limit policies and handling.
