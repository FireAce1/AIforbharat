# Project Structure

## Repository Organization

This is a specification and planning repository for the KrishiAI platform. It contains comprehensive documentation for building an AI-powered rural development platform.

## Current Structure

```
.
├── .kiro/
│   └── steering/          # AI assistant guidance documents
├── RURAL_AI_PLATFORM_SPEC.md      # Complete product specification
├── IMPLEMENTATION_ROADMAP.md      # Phase-by-phase implementation plan
└── TECHNICAL_ARCHITECTURE.md      # Technical design and architecture
```

## Expected Implementation Structure

When implementing the platform, follow this microservices architecture:

```
krishiai/
├── services/
│   ├── crop-service/          # Crop recommendation, disease detection
│   ├── market-service/        # Price forecasting, marketplace
│   ├── climate-service/       # Weather, water optimization
│   ├── govt-service/          # Schemes, chatbot
│   ├── community-service/     # Village dashboard, FPO tools
│   └── auth-service/          # Authentication, user management
├── mobile/
│   └── krishiai-app/          # React Native mobile application
├── ml-models/
│   ├── crop-recommender/      # XGBoost model
│   ├── disease-detector/      # MobileNetV3 model
│   ├── pest-identifier/       # YOLOv5-nano model
│   ├── price-forecaster/      # ARIMA + LSTM model
│   └── chatbot-nlp/           # IndicBERT model
├── infrastructure/
│   ├── k8s/                   # Kubernetes manifests
│   ├── terraform/             # Infrastructure as Code
│   └── docker/                # Dockerfiles
├── data-pipelines/
│   ├── ingestion/             # IMD, ISRO, Agmarknet scrapers
│   ├── processing/            # ETL pipelines
│   └── training/              # ML training pipelines
└── docs/
    ├── api/                   # API documentation
    ├── architecture/          # Architecture diagrams
    └── guides/                # Developer guides
```

## Key Architectural Patterns

- **Microservices**: Each service is independently deployable
- **Event-Driven**: Services communicate via message queues (RabbitMQ/Kafka)
- **API Gateway**: Kong for routing, authentication, rate limiting
- **Offline-First**: Mobile app works without internet, syncs when available
- **Edge Computing**: AI models run on-device (TensorFlow Lite)

## Database Organization

- **PostgreSQL**: User data, farms, crops, transactions (with TimescaleDB for time-series)
- **MongoDB**: Logs, chat messages, unstructured data
- **Redis**: Caching, session management, job queues
- **S3/MinIO**: Images, ML models, videos

## Naming Conventions

- **Services**: kebab-case (e.g., `crop-service`)
- **API Endpoints**: `/api/v1/resource/action`
- **Database Tables**: snake_case (e.g., `market_prices`)
- **Environment Variables**: UPPER_SNAKE_CASE (e.g., `DB_HOST`)
- **Kubernetes Resources**: kebab-case with service prefix (e.g., `crop-service-deployment`)
