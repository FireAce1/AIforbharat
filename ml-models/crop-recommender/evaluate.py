#!/usr/bin/env python3
"""
Crop Recommendation Model Evaluation

Evaluates the trained model on test data and generates performance metrics.
"""

import yaml
import logging
import numpy as np
import pandas as pd
import joblib
from pathlib import Path

from sklearn.metrics import (
    accuracy_score, 
    classification_report, 
    confusion_matrix,
    top_k_accuracy_score
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CropRecommenderEvaluator:
    """Evaluation pipeline for crop recommendation model"""
    
    def __init__(self, config_path='config.yaml'):
        """Initialize evaluator with configuration"""
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
        
        self.model = None
        self.scaler = None
        self.label_encoder = None
        self.irrigation_encoder = None
        self.previous_crop_encoder = None
        
        self._load_model()
    
    def _load_model(self):
        """Load trained model and preprocessors"""
        logger.info("Loading trained model...")
        
        # Load model
        model_path = self.config['paths']['model_output']
        if not Path(model_path).exists():
            raise FileNotFoundError(f"Model not found at {model_path}. Please train the model first.")
        self.model = joblib.load(model_path)
        logger.info(f"Loaded model from {model_path}")
        
        # Load scalers
        scaler_path = self.config['paths']['scaler_output']
        scaler_data = joblib.load(scaler_path)
        self.scaler = scaler_data['scaler']
        self.irrigation_encoder = scaler_data['irrigation_encoder']
        self.previous_crop_encoder = scaler_data['previous_crop_encoder']
        logger.info(f"Loaded feature scaler from {scaler_path}")
        
        # Load label encoder
        encoder_path = self.config['paths']['encoder_output']
        self.label_encoder = joblib.load(encoder_path)
        logger.info(f"Loaded label encoder from {encoder_path}")
    
    def load_test_data(self):
        """Load test data"""
        data_path = self.config['paths']['train_data']
        
        if not Path(data_path).exists():
            raise FileNotFoundError(f"Test data not found at {data_path}")
        
        logger.info(f"Loading test data from {data_path}")
        df = pd.read_csv(data_path)
        
        # Use last 20% as test set
        test_size = int(len(df) * 0.2)
        df_test = df.tail(test_size)
        
        logger.info(f"Loaded {len(df_test)} test samples")
        return df_test
    
    def preprocess_data(self, df):
        """Preprocess test data"""
        X = df.drop('crop', axis=1).copy()
        y = df['crop'].copy()
        
        # Encode categorical features
        X['irrigation_type_encoded'] = self.irrigation_encoder.transform(X['irrigation_type'])
        X['previous_crop_encoded'] = self.previous_crop_encoder.transform(X['previous_crop'])
        
        # Drop original categorical columns
        X = X.drop(['irrigation_type', 'previous_crop'], axis=1)
        
        # Encode target labels
        y_encoded = self.label_encoder.transform(y)
        
        # Scale features
        X_scaled = self.scaler.transform(X)
        
        return X_scaled, y_encoded, y
    
    def evaluate(self):
        """Evaluate model performance"""
        logger.info("=" * 60)
        logger.info("Evaluating Crop Recommendation Model")
        logger.info("=" * 60)
        
        # Load and preprocess test data
        df_test = self.load_test_data()
        X_test, y_test, y_test_labels = self.preprocess_data(df_test)
        
        # Make predictions
        logger.info("Making predictions...")
        y_pred = self.model.predict(X_test)
        y_pred_proba = self.model.predict_proba(X_test)
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        top3_accuracy = top_k_accuracy_score(y_test, y_pred_proba, k=3)
        
        logger.info(f"\nAccuracy: {accuracy:.4f}")
        logger.info(f"Top-3 Accuracy: {top3_accuracy:.4f}")
        
        # Classification report
        logger.info("\nClassification Report (Top 10 crops):")
        crop_names = self.label_encoder.classes_
        report = classification_report(
            y_test, y_pred,
            target_names=crop_names,
            labels=range(min(10, len(crop_names))),
            zero_division=0
        )
        print(report)
        
        # Sample predictions
        logger.info("\nSample Predictions:")
        for i in range(min(5, len(X_test))):
            true_crop = self.label_encoder.inverse_transform([y_test[i]])[0]
            pred_crop = self.label_encoder.inverse_transform([y_pred[i]])[0]
            confidence = y_pred_proba[i][y_pred[i]]
            
            # Get top 3 predictions
            top3_idx = np.argsort(y_pred_proba[i])[-3:][::-1]
            top3_crops = self.label_encoder.inverse_transform(top3_idx)
            top3_probs = y_pred_proba[i][top3_idx]
            
            logger.info(f"\nSample {i+1}:")
            logger.info(f"  True: {true_crop}")
            logger.info(f"  Predicted: {pred_crop} (confidence: {confidence:.4f})")
            logger.info(f"  Top 3: {', '.join([f'{c} ({p:.2f})' for c, p in zip(top3_crops, top3_probs)])}")
        
        logger.info("=" * 60)
        logger.info("Evaluation Complete!")
        logger.info("=" * 60)
        
        return {
            'accuracy': accuracy,
            'top3_accuracy': top3_accuracy
        }


def main():
    """Main evaluation function"""
    evaluator = CropRecommenderEvaluator()
    metrics = evaluator.evaluate()
    
    if metrics['accuracy'] >= 0.85:
        logger.info("✓ Model meets target accuracy of 85%")
        return 0
    else:
        logger.warning("✗ Model does not meet target accuracy")
        return 1


if __name__ == '__main__':
    exit(main())
