"""
Prometheus Metrics Module for Crop Service (Python/FastAPI)

Provides standardized metrics collection:
- HTTP request metrics (duration, total requests)
- ML model metrics (inference latency, accuracy)
- Business metrics (disease detections, crop recommendations)
"""

from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest
from typing import Optional

# Create a registry for metrics
REGISTRY = CollectorRegistry()

# HTTP Request Metrics
http_request_duration = Histogram(
    'http_request_duration_seconds',
    'Duration of HTTP requests in seconds',
    ['method', 'route', 'status_code', 'service'],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registry=REGISTRY
)

http_requests_total = Counter(
    'http_requests_total',
    'Total number of HTTP requests',
    ['method', 'route', 'status_code', 'service'],
    registry=REGISTRY
)

# ML Model Metrics
model_inference_latency = Histogram(
    'model_inference_latency_seconds',
    'Latency of ML model inference in seconds',
    ['model_name', 'model_version', 'service'],
    buckets=[0.1, 0.25, 0.5, 1, 2, 5, 10],
    registry=REGISTRY
)

model_accuracy = Gauge(
    'model_accuracy',
    'Accuracy of ML model predictions (0-1)',
    ['model_name', 'model_version', 'service'],
    registry=REGISTRY
)

# Business Metrics
disease_detections_total = Counter(
    'disease_detections_total',
    'Total number of disease detections performed',
    ['crop_type', 'disease_name', 'confidence_level', 'service'],
    registry=REGISTRY
)

crop_recommendations_total = Counter(
    'crop_recommendations_total',
    'Total number of crop recommendations generated',
    ['recommended_crop', 'confidence_level', 'service'],
    registry=REGISTRY
)

# Helper Functions
def record_http_request(
    method: str,
    route: str,
    status_code: int,
    duration_seconds: float,
    service_name: str = 'crop-service'
) -> None:
    """Record HTTP request metrics"""
    http_request_duration.labels(
        method=method,
        route=route,
        status_code=str(status_code),
        service=service_name
    ).observe(duration_seconds)
    
    http_requests_total.labels(
        method=method,
        route=route,
        status_code=str(status_code),
        service=service_name
    ).inc()


def record_model_inference(
    model_name: str,
    model_version: str,
    latency_seconds: float,
    service_name: str = 'crop-service'
) -> None:
    """Record ML model inference metrics"""
    model_inference_latency.labels(
        model_name=model_name,
        model_version=model_version,
        service=service_name
    ).observe(latency_seconds)


def update_model_accuracy(
    model_name: str,
    model_version: str,
    accuracy: float,
    service_name: str = 'crop-service'
) -> None:
    """Update model accuracy gauge"""
    model_accuracy.labels(
        model_name=model_name,
        model_version=model_version,
        service=service_name
    ).set(accuracy)


def record_disease_detection(
    crop_type: str,
    disease_name: str,
    confidence: float,
    service_name: str = 'crop-service'
) -> None:
    """Record disease detection event"""
    confidence_level = 'high' if confidence >= 0.9 else 'medium' if confidence >= 0.7 else 'low'
    disease_detections_total.labels(
        crop_type=crop_type,
        disease_name=disease_name,
        confidence_level=confidence_level,
        service=service_name
    ).inc()


def record_crop_recommendation(
    recommended_crop: str,
    confidence: float,
    service_name: str = 'crop-service'
) -> None:
    """Record crop recommendation event"""
    confidence_level = 'high' if confidence >= 0.9 else 'medium' if confidence >= 0.7 else 'low'
    crop_recommendations_total.labels(
        recommended_crop=recommended_crop,
        confidence_level=confidence_level,
        service=service_name
    ).inc()


def get_metrics() -> bytes:
    """Get metrics in Prometheus format"""
    return generate_latest(REGISTRY)
