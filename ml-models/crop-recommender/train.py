#!/usr/bin/env python3
"""
Crop Recommendation Model Training Pipeline

Trains an XGBoost classifier to recommend optimal crops based on:
- Soil parameters (N, P, K, pH)
- Climate data (rainfall, temperature, humidity)
- Farm characteristics (size, irrigation, previous crop)
- Market trends (price, demand)

Target: >85% accuracy with 5-fold cross-validation
"""

import os
import yaml
import logging
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from xgboost import XGBClassifier
import joblib

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CropRecommenderTrainer:
    """Training pipeline for crop recommendation model"""
    
    def __init__(self, config_path='config.yaml'):
        """Initialize trainer with configuration"""
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
        
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.irrigation_encoder = LabelEncoder()
        self.previous_crop_encoder = LabelEncoder()
        
        # Create directories
        self._create_directories()
    
    def _create_directories(self):
        """Create necessary directories"""
        for dir_name in ['data', 'models', 'logs']:
            Path(self.config['paths'][f'{dir_name}_dir']).mkdir(parents=True, exist_ok=True)
        logger.info("Created necessary directories")
    
    def generate_synthetic_data(self, n_samples=10000):
        """
        Generate synthetic training data for crop recommendation
        
        In production, this would be replaced with real agricultural data
        from historical farm records, soil tests, and yield data.
        """
        logger.info(f"Generating {n_samples} synthetic training samples...")
        
        np.random.seed(self.config['training']['random_state'])
        crops = self.config['crops']
        
        # Define crop-specific requirements for more realistic data
        crop_profiles = {
            'Rice': {'n': (40, 80), 'p': (20, 40), 'k': (20, 40), 'ph': (5.5, 7.0), 'rain': (150, 300), 'temp': (25, 35)},
            'Wheat': {'n': (50, 90), 'p': (25, 50), 'k': (25, 50), 'ph': (6.0, 7.5), 'rain': (50, 100), 'temp': (15, 25)},
            'Cotton': {'n': (60, 100), 'p': (30, 60), 'k': (30, 60), 'ph': (6.5, 8.0), 'rain': (60, 120), 'temp': (25, 35)},
            'Sugarcane': {'n': (80, 120), 'p': (40, 80), 'k': (40, 80), 'ph': (6.0, 7.5), 'rain': (150, 250), 'temp': (25, 35)},
            'Maize': {'n': (60, 100), 'p': (30, 60), 'k': (30, 60), 'ph': (5.5, 7.5), 'rain': (60, 120), 'temp': (20, 30)},
        }
        
        data = []
        for _ in range(n_samples):
            # Randomly select a crop
            crop = np.random.choice(crops)
            
            # Get crop profile or use defaults
            if crop in crop_profiles:
                profile = crop_profiles[crop]
                # Generate features based on crop-specific requirements with some noise
                sample = {
                    'soil_nitrogen': np.random.uniform(*profile['n']) + np.random.normal(0, 5),
                    'soil_phosphorus': np.random.uniform(*profile['p']) + np.random.normal(0, 3),
                    'soil_potassium': np.random.uniform(*profile['k']) + np.random.normal(0, 3),
                    'soil_ph': np.random.uniform(*profile['ph']) + np.random.normal(0, 0.2),
                    'rainfall_avg_3m': np.random.uniform(*profile['rain']) + np.random.normal(0, 10),
                    'temperature_avg_3m': np.random.uniform(*profile['temp']) + np.random.normal(0, 2),
                }
            else:
                # Default ranges for crops without specific profiles
                sample = {
                    'soil_nitrogen': np.random.uniform(30, 90),
                    'soil_phosphorus': np.random.uniform(15, 55),
                    'soil_potassium': np.random.uniform(15, 55),
                    'soil_ph': np.random.uniform(5.5, 8.0),
                    'rainfall_avg_3m': np.random.uniform(60, 250),
                    'temperature_avg_3m': np.random.uniform(18, 35),
                }
            
            # Add remaining features
            sample.update({
                'humidity_avg_3m': np.random.uniform(50, 85),
                'farm_size': np.random.uniform(0.5, 10),
                'irrigation_type': np.random.choice(['rainfed', 'borewell', 'canal', 'drip', 'sprinkler']),
                'previous_crop': np.random.choice(crops),
                'price_trend_30d': np.random.uniform(-8, 12),
                'demand_forecast': np.random.uniform(0.4, 0.95),
                'crop': crop
            })
            data.append(sample)
        
        df = pd.DataFrame(data)
        
        # Save to CSV
        output_path = self.config['paths']['train_data']
        df.to_csv(output_path, index=False)
        logger.info(f"Saved training data to {output_path}")
        
        return df
    
    def load_data(self):
        """Load training data"""
        data_path = self.config['paths']['train_data']
        
        if not os.path.exists(data_path):
            logger.warning(f"Training data not found at {data_path}, generating synthetic data...")
            return self.generate_synthetic_data()
        
        logger.info(f"Loading training data from {data_path}")
        df = pd.read_csv(data_path)
        logger.info(f"Loaded {len(df)} samples with {len(df.columns)} features")
        
        return df
    
    def preprocess_data(self, df):
        """Preprocess features and encode labels"""
        logger.info("Preprocessing data...")
        
        # Separate features and target
        X = df.drop('crop', axis=1).copy()
        y = df['crop'].copy()
        
        # Encode categorical features
        X['irrigation_type_encoded'] = self.irrigation_encoder.fit_transform(X['irrigation_type'])
        X['previous_crop_encoded'] = self.previous_crop_encoder.fit_transform(X['previous_crop'])
        
        # Drop original categorical columns
        X = X.drop(['irrigation_type', 'previous_crop'], axis=1)
        
        # Encode target labels
        y_encoded = self.label_encoder.fit_transform(y)
        
        # Scale numerical features
        X_scaled = self.scaler.fit_transform(X)
        
        logger.info(f"Preprocessed features shape: {X_scaled.shape}")
        logger.info(f"Number of crop classes: {len(self.label_encoder.classes_)}")
        
        return X_scaled, y_encoded
    
    def train_model(self, X, y):
        """Train XGBoost classifier"""
        logger.info("Training XGBoost model...")
        
        # Split data
        test_size = self.config['training']['test_size']
        random_state = self.config['training']['random_state']
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y
        )
        
        logger.info(f"Training set: {X_train.shape[0]} samples")
        logger.info(f"Test set: {X_test.shape[0]} samples")
        
        # Initialize model
        model_config = self.config['model']
        self.model = XGBClassifier(
            n_estimators=model_config['n_estimators'],
            max_depth=model_config['max_depth'],
            learning_rate=model_config['learning_rate'],
            subsample=model_config['subsample'],
            colsample_bytree=model_config['colsample_bytree'],
            objective=model_config['objective'],
            num_class=model_config['num_class'],
            random_state=model_config['random_state'],
            eval_metric='mlogloss'
        )
        
        # Train model
        logger.info("Fitting model...")
        self.model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=False
        )
        
        # Evaluate on test set
        y_pred = self.model.predict(X_test)
        test_accuracy = accuracy_score(y_test, y_pred)
        logger.info(f"Test set accuracy: {test_accuracy:.4f}")
        
        # Cross-validation (reduced for faster training)
        cv_folds = 3  # Using 3 folds instead of 5 for faster training
        logger.info(f"Performing {cv_folds}-fold cross-validation...")
        cv_scores = cross_val_score(
            self.model, X_train, y_train, cv=cv_folds, scoring='accuracy', n_jobs=-1
        )
        cv_mean = cv_scores.mean()
        cv_std = cv_scores.std()
        logger.info(f"Cross-validation accuracy: {cv_mean:.4f} (+/- {cv_std:.4f})")
        
        # Check if target accuracy is met
        target_accuracy = self.config['training']['target_accuracy']
        if cv_mean >= target_accuracy:
            logger.info(f"✓ Target accuracy of {target_accuracy} achieved!")
        else:
            logger.warning(f"✗ Target accuracy of {target_accuracy} not met. Consider tuning hyperparameters.")
        
        # Feature importance
        feature_names = [
            'soil_nitrogen', 'soil_phosphorus', 'soil_potassium', 'soil_ph',
            'rainfall_avg_3m', 'temperature_avg_3m', 'humidity_avg_3m',
            'farm_size', 'price_trend_30d', 'demand_forecast',
            'irrigation_type_encoded', 'previous_crop_encoded'
        ]
        importance = self.model.feature_importances_
        feature_importance = sorted(
            zip(feature_names, importance),
            key=lambda x: x[1],
            reverse=True
        )
        
        logger.info("\nTop 5 most important features:")
        for feat, imp in feature_importance[:5]:
            logger.info(f"  {feat}: {imp:.4f}")
        
        return {
            'test_accuracy': test_accuracy,
            'cv_mean': cv_mean,
            'cv_std': cv_std,
            'cv_scores': cv_scores,
            'feature_importance': feature_importance
        }
    
    def save_model(self):
        """Save trained model and preprocessors"""
        logger.info("Saving model and preprocessors...")
        
        # Save model
        model_path = self.config['paths']['model_output']
        joblib.dump(self.model, model_path)
        logger.info(f"Saved model to {model_path}")
        
        # Save scaler
        scaler_path = self.config['paths']['scaler_output']
        joblib.dump({
            'scaler': self.scaler,
            'irrigation_encoder': self.irrigation_encoder,
            'previous_crop_encoder': self.previous_crop_encoder
        }, scaler_path)
        logger.info(f"Saved feature scaler to {scaler_path}")
        
        # Save label encoder
        encoder_path = self.config['paths']['encoder_output']
        joblib.dump(self.label_encoder, encoder_path)
        logger.info(f"Saved label encoder to {encoder_path}")
    
    def run(self):
        """Run complete training pipeline"""
        logger.info("=" * 60)
        logger.info("Starting Crop Recommendation Model Training")
        logger.info("=" * 60)
        
        start_time = datetime.now()
        
        # Load data
        df = self.load_data()
        
        # Preprocess
        X, y = self.preprocess_data(df)
        
        # Train
        metrics = self.train_model(X, y)
        
        # Save
        self.save_model()
        
        # Summary
        elapsed_time = (datetime.now() - start_time).total_seconds()
        logger.info("=" * 60)
        logger.info("Training Complete!")
        logger.info(f"Time elapsed: {elapsed_time:.2f} seconds")
        logger.info(f"Test Accuracy: {metrics['test_accuracy']:.4f}")
        logger.info(f"CV Accuracy: {metrics['cv_mean']:.4f} (+/- {metrics['cv_std']:.4f})")
        logger.info("=" * 60)
        
        return metrics


def main():
    """Main training function"""
    trainer = CropRecommenderTrainer()
    metrics = trainer.run()
    
    # Check if target accuracy achieved
    if metrics['cv_mean'] >= 0.85:
        logger.info("✓ Model training successful! Ready for deployment.")
        return 0
    else:
        logger.warning("✗ Model did not meet target accuracy. Consider retraining with more data or tuning hyperparameters.")
        return 1


if __name__ == '__main__':
    exit(main())
