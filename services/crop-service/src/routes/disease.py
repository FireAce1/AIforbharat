"""Disease detection endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas.disease import (
    DiseaseDetectionRequest,
    DiseaseDetectionResponse,
    DiseaseHistoryResponse
)
from ..services.disease_service import DiseaseService
from ..middleware.rate_limiter import ml_rate_limit, api_rate_limit

router = APIRouter(prefix="/crop/disease")


@router.post("/detect", response_model=DiseaseDetectionResponse)
@ml_rate_limit
async def record_disease_detection(
    request: DiseaseDetectionRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Record disease detection result from mobile app.
    
    Stores disease detection data for analytics and history tracking.
    The actual ML inference happens on-device using TensorFlow Lite.
    
    Rate limit: 50 requests per hour per user (ML inference)
    
    Args:
        request: Disease detection data from mobile app
        http_request: HTTP request object for rate limiting
        db: Database session
        
    Returns:
        DiseaseDetectionResponse: Confirmation with detection ID
        
    Raises:
        HTTPException: If recording fails
    """
    try:
        service = DiseaseService(db)
        result = await service.record_detection(request)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record detection: {str(e)}"
        )


@router.get("/history", response_model=List[DiseaseHistoryResponse])
@api_rate_limit
async def get_disease_history(
    crop_id: str,
    limit: int = 10,
    request: Request = None,
    db: Session = Depends(get_db)
):
    """
    Get disease detection history for a crop.
    
    Rate limit: 1000 requests per hour per user
    
    Args:
        crop_id: Crop identifier
        limit: Maximum number of records to return
        request: HTTP request object for rate limiting
        db: Database session
        
    Returns:
        List[DiseaseHistoryResponse]: Disease detection history
        
    Raises:
        HTTPException: If retrieval fails
    """
    try:
        service = DiseaseService(db)
        history = await service.get_history(crop_id, limit)
        return history
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get history: {str(e)}"
        )
