# KrishiAI Platform

AI-powered rural development platform designed to democratize agricultural intelligence for 150M+ Indian farmers.

## 🌾 Overview

KrishiAI provides offline-first, voice-enabled agricultural intelligence optimized for low-end Android devices. The platform aims to increase farmer income by 40%, reduce waste by 30%, and build climate resilience through data-driven decision support.

## 🏗️ Architecture

This is a monorepo containing:

- **services/**: Backend microservices (Node.js, Python)
- **mobile/**: React Native mobile application
- **ml-models/**: Machine learning models and training pipelines
- **infrastructure/**: Kubernetes, Terraform, Docker configurations
- **data-pipelines/**: ETL and data ingestion pipelines

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Python 3.9+ (for ML services)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd krishiai-platform

# Run setup script
chmod +x setup.sh
./setup.sh
```

The setup script will:
- Create directory structure
- Install dependencies
- Start Docker containers (PostgreSQL, Redis, MongoDB, RabbitMQ)
- Initialize databases

### Development

```bash
# Start all services in development mode
npm run dev

# Start Docker services
npm run docker:up

# View logs
npm run docker:logs

# Stop Docker services
npm run docker:down

# Run tests
npm test

# Run linting
npm run lint
```

## 📁 Project Structure

```
krishiai-platform/
├── services/              # Backend microservices
│   ├── auth-service/      # Authentication & authorization
│   ├── crop-service/      # Crop recommendations & disease detection
│   ├── market-service/    # Market intelligence & price forecasting
│   ├── climate-service/   # Weather & water advisory
│   └── govt-service/      # Government schemes & chatbot
├── mobile/
│   └── krishiai-app/      # React Native mobile app
├── ml-models/             # ML models & training
│   ├── crop-recommender/  # XGBoost crop recommendation
│   ├── disease-detector/  # MobileNetV3 disease detection
│   ├── price-forecaster/  # ARIMA + LSTM price forecasting
│   └── chatbot-nlp/       # IndicBERT multilingual chatbot
├── infrastructure/        # IaC & deployment
│   ├── k8s/              # Kubernetes manifests
│   ├── terraform/        # Infrastructure provisioning
│   └── docker/           # Dockerfiles
├── data-pipelines/       # ETL pipelines
└── docs/                 # Documentation
```

## 🛠️ Technology Stack

- **Mobile**: React Native, Redux, WatermelonDB, TensorFlow Lite
- **Backend**: Node.js (Express), Python (FastAPI)
- **Database**: PostgreSQL + TimescaleDB, Redis, MongoDB
- **AI/ML**: TensorFlow, PyTorch, MobileNetV3, XGBoost, IndicBERT
- **Infrastructure**: Docker, Kubernetes, AWS/GCP

## 📊 Database Services

After running setup, the following services are available:

- **PostgreSQL (TimescaleDB)**: `localhost:5432`
- **Redis**: `localhost:6379`
- **MongoDB**: `localhost:27017`
- **RabbitMQ**: `localhost:5672` (Management UI: `http://localhost:15672`)

See `setup.sh` output for credentials.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests for specific service
npm test --workspace=services/auth-service

# Run with coverage
npm test -- --coverage
```

## 📖 Documentation

- [Product Overview](.kiro/steering/product.md)
- [Technical Architecture](.kiro/steering/tech.md)
- [Project Structure](.kiro/steering/structure.md)
- [Requirements](.kiro/specs/krishiai-mvp/requirements.md)
- [Design Document](.kiro/specs/krishiai-mvp/design.md)
- [Implementation Tasks](.kiro/specs/krishiai-mvp/tasks.md)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🌟 Key Features

- ✅ Offline-first architecture
- ✅ Voice input/output in Hindi & Marathi
- ✅ On-device AI (TensorFlow Lite)
- ✅ Real-time market intelligence
- ✅ Weather & water optimization
- ✅ Government scheme discovery
- ✅ Multilingual chatbot

## 📞 Support

For issues and questions, please open a GitHub issue or contact the development team.

---

Built with ❤️ for Indian farmers 🌾
