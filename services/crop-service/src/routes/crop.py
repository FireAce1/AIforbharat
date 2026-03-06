"""Crop recommendation and management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas.crop import (
    CropRecommendationRequest,
    CropRecommendationResponse,
    YieldPredictionResponse,
    CropCalendarResponse
)
from ..services.crop_service import CropService
from ..services.cache_service import cache_service
from ..middleware.cache_middleware import CacheMiddleware, CachePresets
from ..middleware.rate_limiter import ml_rate_limit, api_rate_limit, init_rate_limiter
import redis

# Initialize cache middleware
redis_client = redis.from_url('redis://localhost:6379', decode_responses=True)
cache_middleware = CacheMiddleware(redis_client, 'crop')

# Initialize rate limiter with Redis
init_rate_limiter(redis_client)

router = APIRouter(prefix="/crop")


@router.post("/recommend", response_model=CropRecommendationResponse)
@ml_rate_limit
@cache_middleware.cache(**CachePresets.CROP_RECOMMENDATIONS)
async def get_crop_recommendations(
    request: CropRecommendationRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Get AI-powered crop recommendations based on farm conditions.
    
    Analyzes soil parameters, weather forecast, and market trends to recommend
    the top 3 most suitable crops with detailed metrics.
    
    Rate limit: 50 requests per hour per user (ML inference)
    
    Args:
        request: Farm conditions and parameters
        http_request: HTTP request object for rate limiting
        db: Database session
        
    Returns:
        CropRecommendationResponse: Top 3 crop recommendations with metrics
        
    Raises:
        HTTPException: If recommendation generation fails
    """
    try:
        service = CropService(db)
        recommendations = await service.get_recommendations(request)
        return recommendations
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recommendations: {str(e)}"
        )


@router.get("/yield/predict", response_model=YieldPredictionResponse)
@ml_rate_limit
@cache_middleware.cache(ttl=3600)
async def predict_yield(
    crop_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Predict crop yield based on historical data and current conditions.
    
    Rate limit: 50 requests per hour per user (ML inference)
    
    Args:
        crop_id: Crop identifier
        request: HTTP request object for rate limiting
        db: Database session
        
    Returns:
        YieldPredictionResponse: Yield prediction with confidence
        
    Raises:
        HTTPException: If prediction fails or crop not found
    """
    try:
        service = CropService(db)
        prediction = await service.predict_yield(crop_id)
        return prediction
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to predict yield: {str(e)}"
        )


@router.get("/calendar", response_model=CropCalendarResponse)
@api_rate_limit
@cache_middleware.cache(**CachePresets.LONG)
async def get_crop_calendar(
    crop_name: str,
    location: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Get crop calendar with sowing and harvesting schedules.
    
    Rate limit: 1000 requests per hour per user
    
    Args:
        crop_name: Name of the crop
        location: Farm location (state/region)
        request: HTTP request object for rate limiting
        db: Database session
        
    Returns:
        CropCalendarResponse: Crop calendar with key dates
        
    Raises:
        HTTPException: If calendar data not available
    """
    try:
        service = CropService(db)
        calendar = await service.get_crop_calendar(crop_name, location)
        return calendar
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get crop calendar: {str(e)}"
        )



@router.get("/cache/metrics")
async def get_cache_metrics():
    """
    Get cache performance metrics.
    
    Returns:
        dict: Cache metrics including hits, misses, invalidations, and hit rate
    """
    metrics = cache_middleware.get_metrics()
    return {
        "success": True,
        "data": metrics
    }
