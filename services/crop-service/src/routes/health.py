"""Health check endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import redis
from ..database import get_db
from ..config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Basic health check endpoint.
    
    Returns:
        dict: Service health status
    """
    return {
        "status": "healthy",
        "service": "crop-service",
        "version": "1.0.0"
    }


@router.get("/ready")
async def readiness_check(db: Session = Depends(get_db)):
    """
    Readiness check with dependency verification.
    
    Checks:
    - Database connectivity
    - Redis connectivity
    
    Args:
        db: Database session
        
    Returns:
        dict: Service readiness status with dependency checks
    """
    checks = {
        "database": False,
        "redis": False,
    }
    
    # Check database
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception as e:
        checks["database"] = f"Error: {str(e)}"
    
    # Check Redis
    try:
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        checks["redis"] = True
    except Exception as e:
        checks["redis"] = f"Error: {str(e)}"
    
    all_ready = all(check is True for check in checks.values())
    
    return {
        "status": "ready" if all_ready else "not_ready",
        "service": "crop-service",
        "checks": checks
    }
