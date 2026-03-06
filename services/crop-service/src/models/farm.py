"""Farm database model."""

from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..database import Base


class Farm(Base):
    """Farm model representing farmer's land."""
    
    __tablename__ = "farms"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Location (stored as lat/lng, PostGIS GEOGRAPHY in production)
    latitude = Column(Numeric(10, 8), nullable=False)
    longitude = Column(Numeric(11, 8), nullable=False)
    
    # Farm characteristics
    size_hectares = Column(Numeric(10, 2), nullable=False)
    soil_type = Column(String(50), nullable=False)
    irrigation_type = Column(String(50), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    crops = relationship("Crop", back_populates="farm", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Farm(id={self.id}, user_id={self.user_id}, size={self.size_hectares}ha)>"
