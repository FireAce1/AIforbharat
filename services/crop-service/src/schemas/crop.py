"""Crop-related Pydantic schemas."""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date


class CropRecommendationRequest(BaseModel):
    """Request schema for crop recommendations."""
    
    farm_id: str = Field(..., description="Farm identifier")
    
    # Soil parameters
    soil_nitrogen: float = Field(..., ge=0, le=100, description="Soil nitrogen content (kg/ha)")
    soil_phosphorus: float = Field(..., ge=0, le=100, description="Soil phosphorus content (kg/ha)")
    soil_potassium: float = Field(..., ge=0, le=100, description="Soil potassium content (kg/ha)")
    soil_ph: float = Field(..., ge=0, le=14, description="Soil pH level")
    
    # Optional weather context (fetched from climate service if not provided)
    rainfall_avg: Optional[float] = Field(None, description="Average rainfall (mm)")
    temperature_avg: Optional[float] = Field(None, description="Average temperature (°C)")
    humidity_avg: Optional[float] = Field(None, description="Average humidity (%)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "farm_id": "123e4567-e89b-12d3-a456-426614174000",
                "soil_nitrogen": 45.5,
                "soil_phosphorus": 30.2,
                "soil_potassium": 25.8,
                "soil_ph": 6.5,
                "rainfall_avg": 800.0,
                "temperature_avg": 28.5,
                "humidity_avg": 65.0
            }
        }


class CropRecommendation(BaseModel):
    """Individual crop recommendation."""
    
    crop_name: str = Field(..., description="Crop name")
    confidence: float = Field(..., ge=0, le=1, description="Recommendation confidence score")
    expected_yield: float = Field(..., description="Expected yield (tons/hectare)")
    investment_required: float = Field(..., description="Investment required (INR)")
    expected_revenue: float = Field(..., description="Expected revenue (INR)")
    water_requirements: str = Field(..., description="Water requirements (Low/Medium/High)")
    sowing_window: str = Field(..., description="Optimal sowing window")
    risk_level: str = Field(..., description="Risk level (Low/Medium/High)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "crop_name": "Tomato",
                "confidence": 0.89,
                "expected_yield": 25.5,
                "investment_required": 45000.0,
                "expected_revenue": 125000.0,
                "water_requirements": "Medium",
                "sowing_window": "June-July",
                "risk_level": "Low"
            }
        }


class CropRecommendationResponse(BaseModel):
    """Response schema for crop recommendations."""
    
    recommendations: List[CropRecommendation] = Field(..., max_length=3, description="Top 3 crop recommendations")
    processing_time_ms: int = Field(..., description="Processing time in milliseconds")
    
    class Config:
        json_schema_extra = {
            "example": {
                "recommendations": [
                    {
                        "crop_name": "Tomato",
                        "confidence": 0.89,
                        "expected_yield": 25.5,
                        "investment_required": 45000.0,
                        "expected_revenue": 125000.0,
                        "water_requirements": "Medium",
                        "sowing_window": "June-July",
                        "risk_level": "Low"
                    }
                ],
                "processing_time_ms": 245
            }
        }


class YieldPredictionResponse(BaseModel):
    """Response schema for yield prediction."""
    
    crop_id: str
    crop_name: str
    predicted_yield: float = Field(..., description="Predicted yield (tons/hectare)")
    confidence: float = Field(..., ge=0, le=1, description="Prediction confidence")
    factors: List[str] = Field(..., description="Key factors affecting yield")
    
    class Config:
        json_schema_extra = {
            "example": {
                "crop_id": "123e4567-e89b-12d3-a456-426614174000",
                "crop_name": "Wheat",
                "predicted_yield": 4.2,
                "confidence": 0.85,
                "factors": ["Favorable weather", "Good soil health", "Adequate irrigation"]
            }
        }


class CropCalendarResponse(BaseModel):
    """Response schema for crop calendar."""
    
    crop_name: str
    location: str
    sowing_start: date
    sowing_end: date
    harvest_start: date
    harvest_end: date
    growth_duration_days: int
    key_activities: List[str]
    
    class Config:
        json_schema_extra = {
            "example": {
                "crop_name": "Rice",
                "location": "Maharashtra",
                "sowing_start": "2024-06-15",
                "sowing_end": "2024-07-15",
                "harvest_start": "2024-10-15",
                "harvest_end": "2024-11-15",
                "growth_duration_days": 120,
                "key_activities": ["Land preparation", "Transplanting", "Fertilizer application", "Pest management"]
            }
        }
