"""Pydantic schemas for request/response validation."""

from .crop import (
    CropRecommendationRequest,
    CropRecommendation,
    CropRecommendationResponse,
    YieldPredictionResponse,
    CropCalendarResponse
)
from .disease import (
    DiseaseDetectionRequest,
    DiseaseDetectionResponse,
    DiseaseHistoryResponse
)

__all__ = [
    "CropRecommendationRequest",
    "CropRecommendation",
    "CropRecommendationResponse",
    "YieldPredictionResponse",
    "CropCalendarResponse",
    "DiseaseDetectionRequest",
    "DiseaseDetectionResponse",
    "DiseaseHistoryResponse",
]
