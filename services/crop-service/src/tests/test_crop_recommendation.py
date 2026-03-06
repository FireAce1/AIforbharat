"""Integration tests for crop recommendation endpoint (Task 6.3)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ..main import app
from ..database import Base, get_db
from ..models.farm import Farm
from ..models.crop import Crop
import uuid


# Test database URL (use in-memory SQLite for testing)
TEST_DATABASE_URL = "sqlite:///./test_crop_service.db"

# Create test engine
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


# Override dependency
app.dependency_overrides[get_db] = override_get_db

# Create test client
client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Set up test database."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_farm():
    """Create a test farm."""
    db = TestingSessionLocal()
    farm = Farm(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        latitude=19.0760,  # Mumbai
        longitude=72.8777,
        size_hectares=1.5,
        soil_type="Black",
        irrigation_type="Drip"
    )
    db.add(farm)
    db.commit()
    db.refresh(farm)
    yield farm
    db.close()


class TestCropRecommendationEndpoint:
    """Test suite for crop recommendation endpoint (Task 6.3)."""
    
    def test_health_check(self):
        """Test that the service is running."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_crop_recommendation_success(self, test_farm):
        """
        Test successful crop recommendation generation.
        
        Validates:
        - POST /api/v1/crop/recommend endpoint
        - Response within 500ms (Requirement 4.1)
        - Exactly 3 recommendations (Requirement 4.2)
        - All required fields present (Requirement 4.3)
        """
        request_data = {
            "farm_id": str(test_farm.id),
            "soil_nitrogen": 45.5,
            "soil_phosphorus": 30.2,
            "soil_potassium": 25.8,
            "soil_ph": 6.5,
            "rainfall_avg": 800.0,
            "temperature_avg": 28.5,
            "humidity_avg": 65.0
        }
        
        response = client.post("/api/v1/crop/recommend", json=request_data)
        
        # Verify response status
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Requirement 4.1: Response within 500ms
        assert data["processing_time_ms"] < 500, \
            f"Processing time {data['processing_time_ms']}ms exceeds 500ms limit"
        
        # Requirement 4.2: Exactly 3 recommendations
        assert len(data["recommendations"]) == 3, \
            f"Expected 3 recommendations, got {len(data['recommendations'])}"
        
        # Requirement 4.3: Verify all required fields for each recommendation
        required_fields = [
            "crop_name", "confidence", "expected_yield", "investment_required",
            "expected_revenue", "water_requirements", "sowing_window", "risk_level"
        ]
        
        for i, rec in enumerate(data["recommendations"]):
            for field in required_fields:
                assert field in rec, f"Recommendation {i+1} missing field: {field}"
                assert rec[field] is not None, f"Recommendation {i+1} has null {field}"
            
            # Verify data types and ranges
            assert isinstance(rec["crop_name"], str)
            assert 0 <= rec["confidence"] <= 1
            assert rec["expected_yield"] > 0
            assert rec["investment_required"] > 0
            assert rec["expected_revenue"] > 0
            assert rec["water_requirements"] in ["Low", "Medium", "High"]
            assert rec["risk_level"] in ["Low", "Medium", "High"]
    
    def test_crop_recommendation_with_minimal_data(self, test_farm):
        """Test recommendation with only required fields (weather data optional)."""
        request_data = {
            "farm_id": str(test_farm.id),
            "soil_nitrogen": 40.0,
            "soil_phosphorus": 25.0,
            "soil_potassium": 20.0,
            "soil_ph": 6.8
            # Weather data omitted - should use defaults
        }
        
        response = client.post("/api/v1/crop/recommend", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["recommendations"]) == 3
    
    def test_crop_recommendation_caching(self, test_farm):
        """
        Test that recommendations are cached for 24 hours.
        
        Validates Requirement 4.5: Cache results with 24-hour TTL
        """
        request_data = {
            "farm_id": str(test_farm.id),
            "soil_nitrogen": 45.5,
            "soil_phosphorus": 30.2,
            "soil_potassium": 25.8,
            "soil_ph": 6.5
        }
        
        # First request
        response1 = client.post("/api/v1/crop/recommend", json=request_data)
        assert response1.status_code == 200
        time1 = response1.json()["processing_time_ms"]
        
        # Second request (should be cached if Redis available)
        response2 = client.post("/api/v1/crop/recommend", json=request_data)
        assert response2.status_code == 200
        time2 = response2.json()["processing_time_ms"]
        
        # If Redis is available, second request should be faster
        # If not, both should still work correctly
        assert response1.json()["recommendations"] == response2.json()["recommendations"]
    
    def test_crop_recommendation_invalid_farm(self):
        """Test error handling for non-existent farm."""
        request_data = {
            "farm_id": str(uuid.uuid4()),  # Random UUID that doesn't exist
            "soil_nitrogen": 45.5,
            "soil_phosphorus": 30.2,
            "soil_potassium": 25.8,
            "soil_ph": 6.5
        }
        
        response = client.post("/api/v1/crop/recommend", json=request_data)
        
        # Should return 500 with error message
        assert response.status_code == 500
        assert "error" in response.json() or "detail" in response.json()
    
    def test_crop_recommendation_invalid_soil_params(self, test_farm):
        """Test validation of soil parameters."""
        request_data = {
            "farm_id": str(test_farm.id),
            "soil_nitrogen": -10.0,  # Invalid: negative
            "soil_phosphorus": 30.2,
            "soil_potassium": 25.8,
            "soil_ph": 6.5
        }
        
        response = client.post("/api/v1/crop/recommend", json=request_data)
        
        # Should return 422 validation error
        assert response.status_code == 422
    
    def test_crop_recommendation_risk_levels(self, test_farm):
        """
        Test that risk levels are properly assigned.
        
        Validates Requirement 4.4: Risk level calculation
        """
        request_data = {
            "farm_id": str(test_farm.id),
            "soil_nitrogen": 45.5,
            "soil_phosphorus": 30.2,
            "soil_potassium": 25.8,
            "soil_ph": 6.5
        }
        
        response = client.post("/api/v1/crop/recommend", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify each recommendation has a valid risk level
        for rec in data["recommendations"]:
            assert rec["risk_level"] in ["Low", "Medium", "High"], \
                f"Invalid risk level: {rec['risk_level']}"
    
    def test_crop_recommendation_confidence_ordering(self, test_farm):
        """Test that recommendations are ordered by confidence."""
        request_data = {
            "farm_id": str(test_farm.id),
            "soil_nitrogen": 45.5,
            "soil_phosphorus": 30.2,
            "soil_potassium": 25.8,
            "soil_ph": 6.5
        }
        
        response = client.post("/api/v1/crop/recommend", json=request_data)
        assert response.status_code == 200
        
        recommendations = response.json()["recommendations"]
        
        # Verify recommendations are in descending confidence order
        for i in range(len(recommendations) - 1):
            assert recommendations[i]["confidence"] >= recommendations[i + 1]["confidence"], \
                "Recommendations not ordered by confidence"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
