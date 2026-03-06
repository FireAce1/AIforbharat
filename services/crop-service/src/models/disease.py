"""Disease detection database model."""

from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..database import Base


class DiseaseDetection(Base):
    """Disease detection model for storing detection results."""
    
    __tablename__ = "disease_detections"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crop_id = Column(UUID(as_uuid=True), ForeignKey("crops.id"), nullable=False, index=True)
    
    # Detection results
    image_url = Column(String(500))
    disease_name = Column(String(100), nullable=False)
    confidence = Column(Numeric(5, 4), nullable=False)  # 0.0000 to 1.0000
    severity = Column(String(20))  # Early, Moderate, Severe
    
    # Timestamps
    detected_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    crop = relationship("Crop", back_populates="disease_detections")
    
    def __repr__(self):
        return f"<DiseaseDetection(id={self.id}, disease={self.disease_name}, confidence={self.confidence})>"
