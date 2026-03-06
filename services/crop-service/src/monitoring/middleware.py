"""
FastAPI Middleware for Prometheus Metrics

Automatically tracks HTTP request metrics for all routes
"""

import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from .metrics import record_http_request


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to collect Prometheus metrics for HTTP requests"""
    
    def __init__(self, app, service_name: str = 'crop-service'):
        super().__init__(app)
        self.service_name = service_name
    
    async def dispatch(self, request: Request, call_next):
        """Process request and record metrics"""
        start_time = time.time()
        
        # Process the request
        response = await call_next(request)
        
        # Calculate duration
        duration_seconds = time.time() - start_time
        
        # Get route pattern
        route = request.url.path
        if request.scope.get('route'):
            route = request.scope['route'].path
        
        # Record metrics
        record_http_request(
            method=request.method,
            route=route,
            status_code=response.status_code,
            duration_seconds=duration_seconds,
            service_name=self.service_name
        )
        
        return response
