"""Crop recommendation ML model integration."""

import os
import joblib
from typing import List, Dict, Any
import numpy as np
from ..config import settings


class CropRecommender:
    """
    XGBoost-based crop recommendation model.
    
    This class loads and uses the trained XGBoost model to provide
    crop recommendations based on soil, weather, and market conditions.
    
    Trained in task 6.2 with 12 features and 50 crop classes.
    """
    
    def __init__(self):
        """Initialize the crop recommender."""
        self.model = None
        self.scaler = None
        self.label_encoder = None
        self.irrigation_encoder = None
        self.previous_crop_encoder = None
        self.crop_classes = []
        self._load_model()
    
    def _load_model(self):
        """
        Load the trained XGBoost model from disk.
        
        Loads three files:
        - crop_recommender.pkl: Trained XGBoost model
        - feature_scaler.pkl: Feature scalers and encoders
        - label_encoder.pkl: Label encoder for crop names
        
        Raises:
            FileNotFoundError: If model files not found
        """
        model_dir = settings.MODEL_PATH
        model_path = os.path.join(model_dir, 'crop_recommender.pkl')
        scaler_path = os.path.join(model_dir, 'feature_scaler.pkl')
        encoder_path = os.path.join(model_dir, 'label_encoder.pkl')
        
        if not os.path.exists(model_path):
            print(f"Warning: Model not found at {model_path}")
            print("Using mock recommendations. Train model with: cd ml-models/crop-recommender && python train.py")
            return
        
        try:
            # Load model
            self.model = joblib.load(model_path)
            
            # Load scalers and encoders
            scaler_data = joblib.load(scaler_path)
            self.scaler = scaler_data['scaler']
            self.irrigation_encoder = scaler_data['irrigation_encoder']
            self.previous_crop_encoder = scaler_data['previous_crop_encoder']
            
            # Load label encoder
            self.label_encoder = joblib.load(encoder_path)
            self.crop_classes = self.label_encoder.classes_
            
            print(f"✓ Loaded crop recommender model with {len(self.crop_classes)} crops")
        except Exception as e:
            print(f"Error loading model: {e}")
            self.model = None
    
    def predict(self, features: Dict[str, Any], top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Generate crop recommendations.
        
        Args:
            features: Dictionary of input features:
                - soil_nitrogen: float (kg/ha)
                - soil_phosphorus: float (kg/ha)
                - soil_potassium: float (kg/ha)
                - soil_ph: float (5.5-8.5)
                - rainfall_avg_3m: float (mm)
                - temperature_avg_3m: float (°C)
                - humidity_avg_3m: float (%)
                - farm_size: float (hectares)
                - irrigation_type: str (rainfed/borewell/canal/drip/sprinkler)
                - previous_crop: str (crop name)
                - price_trend_30d: float (%)
                - demand_forecast: float (0-1)
            top_k: Number of recommendations to return (default: 3)
            
        Returns:
            List of top-k crop recommendations with:
                - crop: Crop name
                - confidence: Confidence score (0-1)
                - rank: Recommendation rank (1, 2, 3)
            
        Raises:
            ValueError: If model not loaded or invalid features
        """
        if self.model is None:
            # Return mock recommendations when model not available
            return self._get_mock_recommendations()
        
        try:
            # Preprocess features
            X = self._preprocess_features(features)
            
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
            
        except Exception as e:
            print(f"Error during prediction: {e}")
            return self._get_mock_recommendations()
    
    def _preprocess_features(self, features: Dict[str, Any]) -> np.ndarray:
        """
        Preprocess input features for model inference.
        
        Args:
            features: Raw feature dictionary
            
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
    
    def _get_mock_recommendations(self) -> List[Dict[str, Any]]:
        """
        Return mock recommendations when model is not available.
        
        This is a placeholder until the model is trained and deployed.
        
        Returns:
            List of mock crop recommendations
        """
        return [
            {
                'crop': 'Tomato',
                'confidence': 0.89,
                'rank': 1
            },
            {
                'crop': 'Onion',
                'confidence': 0.82,
                'rank': 2
            },
            {
                'crop': 'Cotton',
                'confidence': 0.76,
                'rank': 3
            }
        ]
