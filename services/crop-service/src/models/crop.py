"""Crop database model."""

from sqlalchemy import Column, String, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..database import Base


class Crop(Base):
    """Crop model representing planted crops on a farm."""
    
    __tablename__ = "crops"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    farm_id = Column(UUID(as_uuid=True), ForeignKey("farms.id"), nullable=False, index=True)
    
    # Crop details
    crop_name = Column(String(100), nullable=False)
    variety = Column(String(100))
    
    # Dates
    sowing_date = Column(Date)
    expected_harvest = Column(Date)
    
    # Status: PLANNED, SOWN, GROWING, HARVESTED
    status = Column(String(20), default="PLANNED", nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    farm = relationship("Farm", back_populates="crops")
    disease_detections = relationship("DiseaseDetection", back_populates="crop", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Crop(id={self.id}, name={self.crop_name}, status={self.status})>"
