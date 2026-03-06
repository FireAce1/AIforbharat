"""Disease detection Pydantic schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DiseaseDetectionRequest(BaseModel):
    """Request schema for recording disease detection."""
    
    crop_id: str = Field(..., description="Crop identifier")
    disease_name: str = Field(..., description="Detected disease name")
    confidence: float = Field(..., ge=0, le=1, description="Detection confidence")
    severity: str = Field(..., description="Disease severity (Early/Moderate/Severe)")
    image_url: Optional[str] = Field(None, description="URL to disease image")
    
    class Config:
        json_schema_extra = {
            "example": {
                "crop_id": "123e4567-e89b-12d3-a456-426614174000",
                "disease_name": "Tomato Late Blight",
                "confidence": 0.94,
                "severity": "Moderate",
                "image_url": "https://storage.example.com/images/detection123.jpg"
            }
        }


class DiseaseDetectionResponse(BaseModel):
    """Response schema for disease detection recording."""
    
    detection_id: str = Field(..., description="Detection record identifier")
    crop_id: str
    disease_name: str
    confidence: float
    severity: str
    detected_at: datetime
    message: str = Field(..., description="Confirmation message")
    
    class Config:
        json_schema_extra = {
            "example": {
                "detection_id": "987e6543-e21b-12d3-a456-426614174000",
                "crop_id": "123e4567-e89b-12d3-a456-426614174000",
                "disease_name": "Tomato Late Blight",
                "confidence": 0.94,
                "severity": "Moderate",
                "detected_at": "2024-01-15T10:30:00Z",
                "message": "Disease detection recorded successfully"
            }
        }


class DiseaseHistoryResponse(BaseModel):
    """Response schema for disease detection history."""
    
    detection_id: str
    disease_name: str
    confidence: float
    severity: str
    detected_at: datetime
    image_url: Optional[str]
    
    class Config:
        json_schema_extra = {
            "example": {
                "detection_id": "987e6543-e21b-12d3-a456-426614174000",
                "disease_name": "Tomato Late Blight",
                "confidence": 0.94,
                "severity": "Moderate",
                "detected_at": "2024-01-15T10:30:00Z",
                "image_url": "https://storage.example.com/images/detection123.jpg"
            }
        }
