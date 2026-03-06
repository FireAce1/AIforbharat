"""
Tests for rate limiting middleware.

Tests verify:
- API rate limiting (1000 requests/hour)
- ML inference rate limiting (50 requests/hour)
- Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- 429 status with Retry-After header when exceeded
"""

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
import time
from ..middleware.rate_limiter import (
    RateLimiter,
    rate_limit,
    api_rate_limit,
    ml_rate_limit,
    init_rate_limiter,
)


@pytest.fixture
def app():
    """Create test FastAPI app with rate-limited endpoints."""
    app = FastAPI()
    
    # Initialize rate limiter without Redis (in-memory)
    init_rate_limiter(None)
    
    @app.get("/api-endpoint")
    @api_rate_limit
    async def api_endpoint(request: Request):
        return {"success": True}
    
    @app.post("/ml-endpoint")
    @ml_rate_limit
    async def ml_endpoint(request: Request):
        return {"success": True}
    
    @app.get("/custom-endpoint")
    @rate_limit(max_requests=5, window_seconds=3600)
    async def custom_endpoint(request: Request):
        return {"success": True}
    
    return app


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


class TestAPIRateLimiter:
    """Test API rate limiter (1000 requests/hour)."""
    
    def test_allows_requests_within_limit(self, client):
        """Should allow requests within the 1000/hour limit."""
        # Make 10 requests - all should succeed
        for i in range(10):
            response = client.get("/api-endpoint")
            assert response.status_code == 200
            assert response.json()["success"] is True
            
            # Check rate limit headers
            assert "x-ratelimit-limit" in response.headers
            assert response.headers["x-ratelimit-limit"] == "1000"
            assert "x-ratelimit-remaining" in response.headers
            assert "x-ratelimit-reset" in response.headers
    
    def test_includes_correct_remaining_count(self, client):
        """Should decrement remaining count with each request."""
        response1 = client.get("/api-endpoint")
        remaining1 = int(response1.headers["x-ratelimit-remaining"])
        
        response2 = client.get("/api-endpoint")
        remaining2 = int(response2.headers["x-ratelimit-remaining"])
        
        assert remaining2 == remaining1 - 1


class TestMLRateLimiter:
    """Test ML inference rate limiter (50 requests/hour)."""
    
    def test_allows_requests_within_limit(self, client):
        """Should allow requests within the 50/hour limit."""
        # Make 10 requests - all should succeed
        for i in range(10):
            response = client.post("/ml-endpoint")
            assert response.status_code == 200
            assert response.json()["success"] is True
            
            # Check rate limit headers
            assert response.headers["x-ratelimit-limit"] == "50"
    
    def test_blocks_requests_exceeding_limit(self, client):
        """Should block requests after 50 requests."""
        # Make 50 successful requests
        for i in range(50):
            response = client.post("/ml-endpoint")
            assert response.status_code == 200
        
        # 51st request should be blocked
        response = client.post("/ml-endpoint")
        assert response.status_code == 429
        
        # Check error response format
        error_data = response.json()
        assert "detail" in error_data
        assert "error" in error_data["detail"]
        assert error_data["detail"]["error"] == "Too Many Requests"
        assert error_data["detail"]["limit"] == 50
        assert error_data["detail"]["remaining"] == 0
        assert "retryAfter" in error_data["detail"]
        assert "resetTime" in error_data["detail"]
        
        # Check headers
        assert "retry-after" in response.headers
        assert int(response.headers["retry-after"]) > 0
        assert response.headers["x-ratelimit-remaining"] == "0"


class TestCustomRateLimiter:
    """Test custom rate limiter configuration."""
    
    def test_custom_limit_configuration(self, client):
        """Should enforce custom rate limit (5 requests)."""
        # Make 5 successful requests
        for i in range(5):
            response = client.get("/custom-endpoint")
            assert response.status_code == 200
            assert response.headers["x-ratelimit-limit"] == "5"
        
        # 6th request should be blocked
        response = client.get("/custom-endpoint")
        assert response.status_code == 429


class TestRateLimitHeaders:
    """Test rate limit headers."""
    
    def test_includes_all_required_headers(self, client):
        """Should include X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset."""
        response = client.get("/api-endpoint")
        
        assert "x-ratelimit-limit" in response.headers
        assert "x-ratelimit-remaining" in response.headers
        assert "x-ratelimit-reset" in response.headers
        
        # Verify header values are valid
        limit = int(response.headers["x-ratelimit-limit"])
        remaining = int(response.headers["x-ratelimit-remaining"])
        reset_time = int(response.headers["x-ratelimit-reset"])
        
        assert limit > 0
        assert remaining >= 0
        assert reset_time > int(time.time())
    
    def test_includes_retry_after_when_rate_limited(self, client):
        """Should include Retry-After header when rate limited."""
        # Exhaust rate limit
        for i in range(50):
            client.post("/ml-endpoint")
        
        # Get rate limited response
        response = client.post("/ml-endpoint")
        
        assert response.status_code == 429
        assert "retry-after" in response.headers
        
        retry_after = int(response.headers["retry-after"])
        assert retry_after > 0
        assert retry_after <= 3600  # Should be within 1 hour


class TestErrorResponseFormat:
    """Test error response format when rate limited."""
    
    def test_error_response_structure(self, client):
        """Should return proper error format with all required fields."""
        # Exhaust rate limit
        for i in range(50):
            client.post("/ml-endpoint")
        
        # Get rate limited response
        response = client.post("/ml-endpoint")
        
        assert response.status_code == 429
        
        error_data = response.json()
        assert "detail" in error_data
        
        detail = error_data["detail"]
        assert "error" in detail
        assert "message" in detail
        assert "retryAfter" in detail
        assert "limit" in detail
        assert "remaining" in detail
        assert "resetTime" in detail
        
        assert detail["error"] == "Too Many Requests"
        assert detail["message"] == "Rate limit exceeded. Please try again later."
        assert detail["remaining"] == 0
        assert detail["limit"] == 50
        assert detail["retryAfter"] > 0


class TestRateLimiterClass:
    """Test RateLimiter class directly."""
    
    @pytest.mark.asyncio
    async def test_in_memory_rate_limiting(self):
        """Should track rate limits in memory when Redis unavailable."""
        limiter = RateLimiter(redis_client=None)
        
        # Make requests within limit
        for i in range(5):
            allowed, current, limit, reset_time = await limiter.check_rate_limit(
                "test_user", max_requests=5, window_seconds=3600
            )
            assert allowed is True
            assert current == i + 1
            assert limit == 5
        
        # Exceed limit
        allowed, current, limit, reset_time = await limiter.check_rate_limit(
            "test_user", max_requests=5, window_seconds=3600
        )
        assert allowed is False
        assert current == 6
        assert limit == 5
    
    @pytest.mark.asyncio
    async def test_different_identifiers_tracked_separately(self):
        """Should track different users separately."""
        limiter = RateLimiter(redis_client=None)
        
        # Exhaust limit for user1
        for i in range(5):
            await limiter.check_rate_limit("user1", max_requests=5)
        
        # user1 should be blocked
        allowed1, _, _, _ = await limiter.check_rate_limit("user1", max_requests=5)
        assert allowed1 is False
        
        # user2 should still be allowed
        allowed2, _, _, _ = await limiter.check_rate_limit("user2", max_requests=5)
        assert allowed2 is True


class TestRequirementCompliance:
    """Test compliance with Requirements 1.5 and 15.1."""
    
    def test_otp_rate_limit_5_per_hour(self, client):
        """Requirement 1.5: OTP endpoint should limit to 5 requests per hour per phone."""
        # This would be tested in auth-service with otpRateLimiter
        # Here we verify the mechanism works with custom limit
        app = FastAPI()
        init_rate_limiter(None)
        
        @app.post("/otp")
        @rate_limit(max_requests=5, window_seconds=3600)
        async def send_otp(request: Request):
            return {"success": True}
        
        test_client = TestClient(app)
        
        # Make 5 successful requests
        for i in range(5):
            response = test_client.post("/otp")
            assert response.status_code == 200
        
        # 6th request should be blocked
        response = test_client.post("/otp")
        assert response.status_code == 429
    
    def test_api_rate_limit_1000_per_hour(self, client):
        """Requirement 15.1: API endpoints should limit to 1000 requests per hour per user."""
        response = client.get("/api-endpoint")
        assert response.headers["x-ratelimit-limit"] == "1000"
    
    def test_ml_rate_limit_50_per_hour(self, client):
        """Requirement 15.1: ML inference should limit to 50 requests per hour per user."""
        response = client.post("/ml-endpoint")
        assert response.headers["x-ratelimit-limit"] == "50"
    
    def test_429_status_with_retry_after(self, client):
        """Requirement 15.1: Should return 429 status with Retry-After header when exceeded."""
        # Exhaust limit
        for i in range(50):
            client.post("/ml-endpoint")
        
        response = client.post("/ml-endpoint")
        
        assert response.status_code == 429
        assert "retry-after" in response.headers
        assert int(response.headers["retry-after"]) > 0
    
    def test_rate_limit_headers_present(self, client):
        """Requirement 15.1: Should add X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers."""
        response = client.get("/api-endpoint")
        
        assert "x-ratelimit-limit" in response.headers
        assert "x-ratelimit-remaining" in response.headers
        assert "x-ratelimit-reset" in response.headers
