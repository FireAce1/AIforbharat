"""Disease detection service for business logic."""

from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import uuid
from ..models.disease import DiseaseDetection
from ..models.crop import Crop
from ..schemas.disease import (
    DiseaseDetectionRequest,
    DiseaseDetectionResponse,
    DiseaseHistoryResponse
)


class DiseaseService:
    """Service for disease detection operations."""
    
    def __init__(self, db: Session):
        """
        Initialize disease service.
        
        Args:
            db: Database session
        """
        self.db = db
    
    async def record_detection(
        self,
        request: DiseaseDetectionRequest
    ) -> DiseaseDetectionResponse:
        """
        Record disease detection result from mobile app.
        
        The actual ML inference happens on-device using TensorFlow Lite.
        This endpoint stores the detection result for analytics and history.
        
        Args:
            request: Disease detection data
            
        Returns:
            DiseaseDetectionResponse: Confirmation with detection ID
            
        Raises:
            ValueError: If crop not found
        """
        # Verify crop exists
        crop = self.db.query(Crop).filter(
            Crop.id == uuid.UUID(request.crop_id)
        ).first()
        
        if not crop:
            raise ValueError(f"Crop not found: {request.crop_id}")
        
        # Create detection record
        detection = DiseaseDetection(
            crop_id=uuid.UUID(request.crop_id),
            disease_name=request.disease_name,
            confidence=request.confidence,
            severity=request.severity,
            image_url=request.image_url,
            detected_at=datetime.utcnow()
        )
        
        self.db.add(detection)
        self.db.commit()
        self.db.refresh(detection)
        
        return DiseaseDetectionResponse(
            detection_id=str(detection.id),
            crop_id=str(detection.crop_id),
            disease_name=detection.disease_name,
            confidence=float(detection.confidence),
            severity=detection.severity,
            detected_at=detection.detected_at,
            message="Disease detection recorded successfully"
        )
    
    async def get_history(
        self,
        crop_id: str,
        limit: int = 10
    ) -> List[DiseaseHistoryResponse]:
        """
        Get disease detection history for a crop.
        
        Args:
            crop_id: Crop identifier
            limit: Maximum number of records to return
            
        Returns:
            List[DiseaseHistoryResponse]: Disease detection history
        """
        detections = self.db.query(DiseaseDetection).filter(
            DiseaseDetection.crop_id == uuid.UUID(crop_id)
        ).order_by(
            DiseaseDetection.detected_at.desc()
        ).limit(limit).all()
        
        return [
            DiseaseHistoryResponse(
                detection_id=str(d.id),
                disease_name=d.disease_name,
                confidence=float(d.confidence),
                severity=d.severity,
                detected_at=d.detected_at,
                image_url=d.image_url
            )
            for d in detections
        ]
