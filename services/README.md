# KrishiAI Services

This directory contains all backend microservices for the KrishiAI platform.

## Services

- **auth-service**: User authentication and authorization (Node.js + Express)
- **crop-service**: Crop recommendations and disease detection (Python + FastAPI)
- **market-service**: Market price intelligence and forecasting (Node.js + Express)
- **climate-service**: Weather forecasts and water advisory (Node.js + Express)
- **govt-service**: Government schemes and chatbot (Node.js + Express)

## Development

Each service is independently deployable and has its own package.json/requirements.txt.

```bash
# Run all services in development mode
npm run dev

# Run specific service
cd services/auth-service && npm run dev
```
