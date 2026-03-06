"""Main FastAPI application entry point."""

from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from .config import settings
from .routes import health, crop, disease
from .database_optimizer import db_optimizer
from .monitoring.middleware import MetricsMiddleware
from .monitoring import get_metrics
from .utils.sentry_config import initialize_sentry, capture_exception, add_breadcrumb, set_request_context

# Initialize Sentry before creating app
initialize_sentry(
    service_name='crop-service',
    dsn=settings.SENTRY_DSN,
    environment=settings.ENVIRONMENT,
    traces_sample_rate=0.1 if settings.ENVIRONMENT == 'production' else 1.0,
    profiles_sample_rate=0.1 if settings.ENVIRONMENT == 'production' else 1.0,
)

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(
    title="KrishiAI Crop Service",
    description="AI-powered crop intelligence service providing recommendations, disease detection, and yield predictions",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Prometheus metrics middleware
app.add_middleware(MetricsMiddleware, service_name='crop-service')


# Sentry context middleware
@app.middleware("http")
async def sentry_context_middleware(request: Request, call_next):
    """Add request context to Sentry for error tracking"""
    request_id = request.headers.get('x-request-id', f"req_{id(request)}")
    
    # Set request context in Sentry
    set_request_context(
        request_id=request_id,
        method=request.method,
        url=str(request.url),
        endpoint=request.url.path,
    )
    
    # Add breadcrumb
    add_breadcrumb(
        message=f"{request.method} {request.url.path}",
        category="http",
        level="info",
        data={
            "method": request.method,
            "url": str(request.url),
            "request_id": request_id,
        }
    )
    
    response = await call_next(request)
    return response


@app.on_event("startup")
async def startup_event():
    """Initialize services on application startup."""
    logger.info("Starting Crop Service...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"API prefix: {settings.API_V1_PREFIX}")
    logger.info(f"Database pool size: {settings.DB_POOL_SIZE}")
    logger.info(f"Database max overflow: {settings.DB_MAX_OVERFLOW}")
    
    # Log database optimizer initialization
    pool_stats = db_optimizer.get_pool_stats()
    logger.info(f"Database optimizer initialized: {pool_stats}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown."""
    logger.info("Shutting down Crop Service...")
    
    # Log final query metrics
    slow_queries = db_optimizer.get_slow_queries()
    if slow_queries:
        logger.warning(f"Slow queries detected during session: {len(slow_queries)}")
    
    # Close database connections
    db_optimizer.close()
    logger.info("Database connections closed")


# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(
    crop.router,
    prefix=settings.API_V1_PREFIX,
    tags=["Crop Intelligence"]
)
app.include_router(
    disease.router,
    prefix=settings.API_V1_PREFIX,
    tags=["Disease Detection"]
)


@app.get("/metrics", tags=["Monitoring"])
async def metrics():
    """Expose Prometheus metrics endpoint"""
    return Response(content=get_metrics(), media_type="text/plain")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    # Capture exception in Sentry
    capture_exception(exc, context={
        'requestId': request.headers.get('x-request-id'),
        'endpoint': request.url.path,
        'method': request.method,
    })
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc) if settings.DEBUG else "An unexpected error occurred"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
