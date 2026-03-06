"""Configuration management for Crop Service."""

from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Database Configuration
    DATABASE_URL: str = "postgresql://krishiai:krishiai123@localhost:5432/krishiai_db"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    
    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 20
    
    # API Configuration
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:19006"]
    
    # JWT Configuration
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    
    # ML Model Configuration
    MODEL_PATH: str = "./models"
    CROP_RECOMMENDER_MODEL: str = "crop_recommender.pkl"
    DISEASE_DETECTOR_MODEL: str = "disease_detector.h5"
    
    # Cache TTL (seconds)
    CACHE_TTL_RECOMMENDATIONS: int = 86400  # 24 hours
    CACHE_TTL_PREDICTIONS: int = 3600  # 1 hour
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    # Sentry Error Tracking
    SENTRY_DSN: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
