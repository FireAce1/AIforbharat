# Technology Stack

## Frontend

- **Mobile**: React Native (Android priority)
- **State Management**: Redux + Redux Saga
- **Offline Storage**: WatermelonDB / Realm
- **Voice**: Google Speech-to-Text (on-device)
- **UI Framework**: Material Design (high contrast for sunlight readability)

## Backend

- **Languages**: Node.js (Express) + Python (FastAPI for ML services)
- **API**: GraphQL (Apollo Federation) + REST
- **Message Queue**: RabbitMQ
- **Orchestration**: Kubernetes (GKE/EKS) with auto-scaling

## AI/ML Stack

- **Training**: TensorFlow, PyTorch, Scikit-learn
- **Edge Deployment**: TensorFlow Lite, ONNX Runtime
- **NLP**: IndicBERT, mBERT for multilingual support
- **Computer Vision**: MobileNetV3, YOLOv5-nano, EfficientNet
- **MLOps**: MLflow, Kubeflow
- **GPU**: NVIDIA A100 cluster for training

## Data Layer

- **Primary Database**: PostgreSQL with TimescaleDB extension
- **Unstructured Data**: MongoDB (logs, chat)
- **Cache**: Redis
- **Object Storage**: MinIO / S3
- **Event Streaming**: Apache Kafka

## DevOps & Infrastructure

- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Error Tracking**: Sentry
- **CDN**: Cloudflare
- **Cloud**: AWS / GCP (multi-cloud strategy)

## Common Commands

### Development
```bash
# Backend services
npm install
npm run dev
npm test
npm run lint

# Mobile app
npm install
npm run android
npm run ios
npm test
```

### Deployment
```bash
# Build Docker image
docker build -t krishiai/service-name:version .

# Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml
kubectl rollout status deployment/service-name

# Check logs
kubectl logs -f deployment/service-name
```

### Database
```bash
# Run migrations
npm run migrate

# Seed data
npm run seed

# Backup
pg_dump krishiai_db > backup.sql
```

### ML Model Management
```bash
# Train model
python train.py --model crop_recommender --epochs 100

# Convert to TFLite
python convert_to_tflite.py --model disease_detector

# Deploy model
mlflow models serve -m models:/crop_recommender/production
```
