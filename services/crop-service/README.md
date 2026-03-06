# Crop Service

AI-powered crop intelligence service for the KrishiAI platform. Provides crop recommendations, disease detection, and yield predictions.

## Features

- **Crop Recommendations**: XGBoost-based recommendations considering soil, weather, and market conditions
- **Disease Detection**: Integration endpoint for mobile disease detection results
- **Yield Prediction**: Historical data-based yield forecasting
- **Crop Calendar**: Sowing and harvesting schedules

## Technology Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Cache**: Redis
- **ML**: XGBoost, Scikit-learn
- **API Documentation**: OpenAPI (Swagger)

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- Redis 7+

### Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

### Database Setup

```bash
# Run migrations
alembic upgrade head
```

### Running the Service

```bash
# Development mode with auto-reload
uvicorn src.main:app --reload --host 0.0.0.0 --port 8001

# Production mode
uvicorn src.main:app --host 0.0.0.0 --port 8001 --workers 4
```

## API Documentation

Once running, access the interactive API documentation at:
- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

## Project Structure

```
crop-service/
├── src/
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Configuration management
│   ├── database.py          # Database connection and session
│   ├── routes/              # API route handlers
│   │   ├── __init__.py
│   │   ├── crop.py          # Crop recommendation endpoints
│   │   ├── disease.py       # Disease detection endpoints
│   │   └── health.py        # Health check endpoints
│   ├── models/              # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── farm.py
│   │   ├── crop.py
│   │   └── disease.py
│   ├── schemas/             # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── crop.py
│   │   └── disease.py
│   ├── services/            # Business logic
│   │   ├── __init__.py
│   │   ├── crop_service.py
│   │   └── cache_service.py
│   └── ml/                  # ML model integration
│       ├── __init__.py
│       └── crop_recommender.py
├── tests/                   # Test files
├── alembic/                 # Database migrations
├── models/                  # ML model files
├── requirements.txt
├── .env.example
└── README.md
```

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_crop_service.py
```

## Environment Variables

See `.env.example` for all available configuration options.

## API Endpoints

### Crop Recommendations
- `POST /api/v1/crop/recommend` - Get crop recommendations

### Disease Detection
- `POST /api/v1/crop/disease/detect` - Record disease detection
- `GET /api/v1/crop/disease/history` - Get detection history

### Yield Prediction
- `GET /api/v1/crop/yield/predict` - Predict crop yield

### Crop Calendar
- `GET /api/v1/crop/calendar` - Get crop calendar

### Health Check
- `GET /health` - Service health status
- `GET /ready` - Service readiness status
