"""
Crop Recommender Inference Module

Provides inference interface for the trained XGBoost crop recommendation model.
Used by the Crop Service API for real-time recommendations.
"""

import numpy as np
import joblib
from pathlib import Path
from typing import Dict, List, Tuple


class CropRecommender:
    """Inference wrapper for crop recommendation model"""
    
    def __init__(self, model_path: str, scaler_path: str, encoder_path: str):
        """
        Initialize recommender with trained model
        
        Args:
            model_path: Path to trained XGBoost model (.pkl)
            scaler_path: Path to feature scaler (.pkl)
            encoder_path: Path to label encoder (.pkl)
        """
        self.model = joblib.load(model_path)
        
        scaler_data = joblib.load(scaler_path)
        self.scaler = scaler_data['scaler']
        self.irrigation_encoder = scaler_data['irrigation_encoder']
        self.previous_crop_encoder = scaler_data['previous_crop_encoder']
        
        self.label_encoder = joblib.load(encoder_path)
        self.crop_classes = self.label_encoder.classes_
    
    def preprocess_features(self, features: Dict) -> np.ndarray:
        """
        Preprocess input features for model inference
        
        Args:
            features: Dictionary containing:
                - soil_nitrogen: float
                - soil_phosphorus: float
                - soil_potassium: float
                - soil_ph: float
                - rainfall_avg_3m: float
                - temperature_avg_3m: float
                - humidity_avg_3m: float
                - farm_size: float
                - irrigation_type: str
                - previous_crop: str
                - price_trend_30d: float
                - demand_forecast: float
        
        Returns:
            Preprocessed feature array ready for model input
        """
        # Encode categorical features
        irrigation_encoded = self.irrigation_encoder.transform([features['irrigation_type']])[0]
        previous_crop_encoded = self.previous_crop_encoder.transform([features['previous_crop']])[0]
        
        # Create feature vector in correct order
        feature_vector = np.array([[
            features['soil_nitrogen'],
            features['soil_phosphorus'],
            features['soil_potassium'],
            features['soil_ph'],
            features['rainfall_avg_3m'],
            features['temperature_avg_3m'],
            features['humidity_avg_3m'],
            features['farm_size'],
            features['price_trend_30d'],
            features['demand_forecast'],
            irrigation_encoded,
            previous_crop_encoded
        ]])
        
        # Scale features
        feature_vector_scaled = self.scaler.transform(feature_vector)
        
        return feature_vector_scaled
    
    def predict(self, features: Dict, top_k: int = 3) -> List[Dict]:
        """
        Get top-k crop recommendations
        
        Args:
            features: Input features dictionary
            top_k: Number of top recommendations to return (default: 3)
        
        Returns:
            List of recommendation dictionaries with:
                - crop: Crop name
                - confidence: Confidence score (0-1)
                - rank: Recommendation rank (1, 2, 3)
        """
        # Preprocess features
        X = self.preprocess_features(features)
        
        # Get prediction probabilities
        probabilities = self.model.predict_proba(X)[0]
        
        # Get top-k predictions
        top_k_indices = np.argsort(probabilities)[-top_k:][::-1]
        
        recommendations = []
        for rank, idx in enumerate(top_k_indices, 1):
            recommendations.append({
                'crop': self.crop_classes[idx],
                'confidence': float(probabilities[idx]),
                'rank': rank
            })
        
        return recommendations
    
    def predict_single(self, features: Dict) -> Tuple[str, float]:
        """
        Get single best crop recommendation
        
        Args:
            features: Input features dictionary
        
        Returns:
            Tuple of (crop_name, confidence_score)
        """
        recommendations = self.predict(features, top_k=1)
        best = recommendations[0]
        return best['crop'], best['confidence']


def load_recommender(models_dir: str = 'models') -> CropRecommender:
    """
    Convenience function to load recommender with default paths
    
    Args:
        models_dir: Directory containing model files
    
    Returns:
        Initialized CropRecommender instance
    """
    models_path = Path(models_dir)
    
    return CropRecommender(
        model_path=str(models_path / 'crop_recommender.pkl'),
        scaler_path=str(models_path / 'feature_scaler.pkl'),
        encoder_path=str(models_path / 'label_encoder.pkl')
    )


# Example usage
if __name__ == '__main__':
    # Load recommender
    recommender = load_recommender()
    
    # Example features
    sample_features = {
        'soil_nitrogen': 45.0,
        'soil_phosphorus': 30.0,
        'soil_potassium': 25.0,
        'soil_ph': 6.5,
        'rainfall_avg_3m': 150.0,
        'temperature_avg_3m': 28.0,
        'humidity_avg_3m': 70.0,
        'farm_size': 2.0,
        'irrigation_type': 'drip',
        'previous_crop': 'Wheat',
        'price_trend_30d': 5.2,
        'demand_forecast': 0.8
    }
    
    # Get recommendations
    recommendations = recommender.predict(sample_features, top_k=3)
    
    print("Top 3 Crop Recommendations:")
    for rec in recommendations:
        print(f"  {rec['rank']}. {rec['crop']} (confidence: {rec['confidence']:.2%})")
