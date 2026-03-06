# KrishiAI API Documentation

## Overview

This directory contains comprehensive API documentation for all KrishiAI platform services. The documentation follows OpenAPI 3.0 specification and includes request/response schemas, authentication instructions, error codes, and rate limiting information.

## Services

The KrishiAI platform consists of the following microservices:

1. **Auth Service** - User authentication and authorization
2. **Crop Service** - Crop recommendations, disease detection, yield prediction
3. **Market Service** - Market prices, forecasting, profit calculation
4. **Climate Service** - Weather forecasts, water advisory, climate risk
5. **Government Service** - Government schemes, eligibility filtering, notifications
6. **Chatbot Service** - Voice and text-based conversational interface

## Documentation Files

- `openapi.yaml` - Complete OpenAPI 3.0 specification for all services
- `auth-service.md` - Detailed Auth Service documentation
- `crop-service.md` - Detailed Crop Service documentation
- `market-service.md` - Detailed Market Service documentation
- `climate-service.md` - Detailed Climate Service documentation
- `govt-service.md` - Detailed Government Service documentation
- `chatbot-service.md` - Detailed Chatbot Service documentation
- `authentication.md` - Authentication and authorization guide
- `error-codes.md` - Complete error code reference
- `rate-limiting.md` - Rate limiting policies and headers

## Quick Start

### Base URLs

**Development**:
```
http://localhost:3000/api/v1  # Auth Service
http://localhost:3001/api/v1  # Crop Service
http://localhost:3002/api/v1  # Market Service
http://localhost:3003/api/v1  # Climate Service
http://localhost:3004/api/v1  # Government Service
http://localhost:3005/api/v1  # Chatbot Service
```

**Production**:
```
https://api.krishiai.com/api/v1
```

### Authentication

All API endpoints (except authentication endpoints) require a valid JWT token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

See [authentication.md](./authentication.md) for detailed authentication flow.

### Example Request

```bash
curl -X GET "https://api.krishiai.com/api/v1/crop/recommend" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

## Interactive API Documentation

Access the interactive Swagger UI documentation at:

**Development**: http://localhost:8080/api-docs
**Production**: https://api.krishiai.com/api-docs

## Rate Limiting

All API endpoints are rate-limited to ensure fair usage:

- **OTP endpoints**: 5 requests per hour per phone number
- **Standard API endpoints**: 1,000 requests per hour per user
- **ML inference endpoints**: 50 requests per hour per user

See [rate-limiting.md](./rate-limiting.md) for detailed information.

## Error Handling

All API responses follow a consistent error format:

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

See [error-codes.md](./error-codes.md) for complete error code reference.

## Support

For API support and questions:
- Email: api-support@krishiai.com
- Documentation: https://docs.krishiai.com
- GitHub Issues: https://github.com/krishiai/platform/issues

## Version History

- **v1.0.0** (January 2026) - Initial MVP release
  - Auth Service with OTP-based authentication
  - Crop Service with AI recommendations and disease detection
  - Market Service with price forecasting
  - Climate Service with weather and water advisory
  - Government Service with scheme discovery
  - Chatbot Service with multilingual support
