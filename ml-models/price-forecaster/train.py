"""
Price Forecasting Model Training
Trains ARIMA and LSTM models for agricultural commodity price prediction
"""

import os
import argparse
import yaml
import logging
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Tuple, Dict, Any

# ML Libraries
from statsmodels.tsa.arima.model import ARIMA
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_percentage_error, mean_squared_error, mean_absolute_error
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, callbacks

# Local imports
from data_loader import PriceDataLoader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ARIMATrainer:
    """Train ARIMA model for short-term price forecasting"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.arima_config = config['arima']
        self.order = tuple(self.arima_config['order'])
        self.model = None
        
    def train(self, train_data: pd.DataFrame) -> Any:
        """
        Train ARIMA model
        
        Args:
            train_data: Training data with price_per_kg column
            
        Returns:
            Fitted ARIMA model
        """
        logger.info(f"Training ARIMA model with order {self.order}...")
        
        # Extract price series
        prices = train_data['price_per_kg'].values
        
        # Fit ARIMA model
        model = ARIMA(prices, order=self.order)
        self.model = model.fit()
        
        logger.info(f"✓ ARIMA model trained successfully")
        logger.info(f"  AIC: {self.model.aic:.2f}")
        logger.info(f"  BIC: {self.model.bic:.2f}")
        
        return self.model
    
    def forecast(self, steps: int = 7) -> np.ndarray:
        """
        Generate forecast
        
        Args:
            steps: Number of days to forecast
            
        Returns:
            Array of forecasted prices
        """
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        forecast = self.model.forecast(steps=steps)
        return forecast
    
    def save(self, filepath: str):
        """Save trained model"""
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        joblib.dump(self.model, filepath)
        logger.info(f"✓ ARIMA model saved to {filepath}")
    
    @staticmethod
    def load(filepath: str) -> Any:
        """Load trained model"""
        model = joblib.load(filepath)
        logger.info(f"✓ ARIMA model loaded from {filepath}")
        return model


class LSTMTrainer:
    """Train LSTM model for medium-term price forecasting"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.lstm_config = config['lstm']
        self.sequence_length = self.lstm_config['sequence_length']
        self.forecast_days = self.lstm_config['forecast_days']
        self.model = None
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        
    def create_sequences(
        self, 
        data: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Create sequences for LSTM training
        
        Args:
            data: Price data array
            
        Returns:
            Tuple of (X, y) where X is input sequences and y is targets
        """
        X, y = [], []
        
        for i in range(len(data) - self.sequence_length - self.forecast_days + 1):
            X.append(data[i:i + self.sequence_length])
            y.append(data[i + self.sequence_length:i + self.sequence_length + self.forecast_days])
        
        return np.array(X), np.array(y)
    
    def build_model(self) -> keras.Model:
        """Build LSTM model architecture"""
        model = keras.Sequential()
        
        # Add LSTM layers from config
        for i, layer_config in enumerate(self.lstm_config['layers']):
            if i == 0:
                # First layer with input shape
                model.add(layers.LSTM(
                    units=layer_config['units'],
                    return_sequences=layer_config.get('return_sequences', False),
                    input_shape=(self.sequence_length, 1)
                ))
            else:
                model.add(layers.LSTM(
                    units=layer_config['units'],
                    return_sequences=layer_config.get('return_sequences', False)
                ))
            
            # Add dropout
            if 'dropout' in layer_config:
                model.add(layers.Dropout(layer_config['dropout']))
        
        # Output layer
        model.add(layers.Dense(self.forecast_days))
        
        # Compile model
        model.compile(
            optimizer=keras.optimizers.Adam(
                learning_rate=self.lstm_config['learning_rate']
            ),
            loss='mse',
            metrics=['mae']
        )
        
        logger.info("✓ LSTM model architecture created")
        model.summary(print_fn=logger.info)
        
        return model
    
    def train(
        self, 
        train_data: pd.DataFrame,
        validation_split: float = 0.2
    ) -> keras.Model:
        """
        Train LSTM model
        
        Args:
            train_data: Training data with price_per_kg column
            validation_split: Validation split ratio
            
        Returns:
            Trained LSTM model
        """
        logger.info("Training LSTM model...")
        
        # Extract and normalize prices
        prices = train_data['price_per_kg'].values.reshape(-1, 1)
        prices_scaled = self.scaler.fit_transform(prices)
        
        # Create sequences
        X, y = self.create_sequences(prices_scaled)
        logger.info(f"✓ Created {len(X)} training sequences")
        
        # Reshape X for LSTM [samples, timesteps, features]
        X = X.reshape(X.shape[0], X.shape[1], 1)
        
        # Build model
        self.model = self.build_model()
        
        # Callbacks
        early_stop = callbacks.EarlyStopping(
            monitor='val_loss',
            patience=self.lstm_config['early_stopping']['patience'],
            min_delta=self.lstm_config['early_stopping']['min_delta'],
            restore_best_weights=True
        )
        
        reduce_lr = callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-6
        )
        
        # Train model
        history = self.model.fit(
            X, y,
            epochs=self.lstm_config['epochs'],
            batch_size=self.lstm_config['batch_size'],
            validation_split=validation_split,
            callbacks=[early_stop, reduce_lr],
            verbose=1
        )
        
        logger.info("✓ LSTM model trained successfully")
        logger.info(f"  Final loss: {history.history['loss'][-1]:.4f}")
        logger.info(f"  Final val_loss: {history.history['val_loss'][-1]:.4f}")
        
        return self.model
    
    def forecast(self, last_sequence: np.ndarray) -> np.ndarray:
        """
        Generate forecast from last sequence
        
        Args:
            last_sequence: Last sequence_length days of prices
            
        Returns:
            Array of forecasted prices
        """
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        # Normalize input
        last_sequence_scaled = self.scaler.transform(last_sequence.reshape(-1, 1))
        
        # Reshape for LSTM
        X = last_sequence_scaled.reshape(1, self.sequence_length, 1)
        
        # Predict
        forecast_scaled = self.model.predict(X, verbose=0)
        
        # Inverse transform
        forecast = self.scaler.inverse_transform(forecast_scaled.reshape(-1, 1))
        
        return forecast.flatten()
    
    def save(self, model_path: str, scaler_path: str):
        """Save trained model and scaler"""
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        self.model.save(model_path)
        joblib.dump(self.scaler, scaler_path)
        logger.info(f"✓ LSTM model saved to {model_path}")
        logger.info(f"✓ Scaler saved to {scaler_path}")
    
    @staticmethod
    def load(model_path: str, scaler_path: str) -> Tuple[keras.Model, MinMaxScaler]:
        """Load trained model and scaler"""
        model = keras.models.load_model(model_path)
        scaler = joblib.load(scaler_path)
        logger.info(f"✓ LSTM model loaded from {model_path}")
        logger.info(f"✓ Scaler loaded from {scaler_path}")
        return model, scaler


class EnsembleForecaster:
    """Ensemble forecaster combining ARIMA and LSTM"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.ensemble_config = config['ensemble']
        self.arima_weight = self.ensemble_config['arima_weight']
        self.lstm_weight = self.ensemble_config['lstm_weight']
        
    def forecast(
        self, 
        arima_forecast: np.ndarray, 
        lstm_forecast: np.ndarray
    ) -> np.ndarray:
        """
        Generate ensemble forecast
        
        Args:
            arima_forecast: ARIMA predictions
            lstm_forecast: LSTM predictions
            
        Returns:
            Ensemble forecast
        """
        # Ensure same length
        min_len = min(len(arima_forecast), len(lstm_forecast))
        arima_forecast = arima_forecast[:min_len]
        lstm_forecast = lstm_forecast[:min_len]
        
        # Weighted average
        ensemble = (
            self.arima_weight * arima_forecast + 
            self.lstm_weight * lstm_forecast
        )
        
        logger.info(f"✓ Ensemble forecast generated (ARIMA: {self.arima_weight}, LSTM: {self.lstm_weight})")
        return ensemble


def evaluate_model(
    y_true: np.ndarray, 
    y_pred: np.ndarray
) -> Dict[str, float]:
    """
    Evaluate model performance
    
    Args:
        y_true: True values
        y_pred: Predicted values
        
    Returns:
        Dictionary of metrics
    """
    mape = mean_absolute_percentage_error(y_true, y_pred) * 100
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    
    metrics = {
        'mape': mape,
        'rmse': rmse,
        'mae': mae,
        'accuracy': 100 - mape
    }
    
    return metrics


def train_models(
    crop_name: str,
    market_name: str,
    config: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Train complete ensemble model for a crop-market pair
    
    Args:
        crop_name: Name of the crop
        market_name: Name of the market
        config: Configuration dictionary
        
    Returns:
        Dictionary with trained models and metrics
    """
    logger.info(f"\n{'='*60}")
    logger.info(f"Training models for {crop_name.upper()} in {market_name.upper()}")
    logger.info(f"{'='*60}\n")
    
    # Load data
    data_loader = PriceDataLoader()
    train_df, test_df = data_loader.load_data(crop_name, market_name)
    
    # Train ARIMA
    logger.info("\n--- ARIMA Training ---")
    arima_trainer = ARIMATrainer(config)
    arima_model = arima_trainer.train(train_df)
    
    # Train LSTM
    logger.info("\n--- LSTM Training ---")
    lstm_trainer = LSTMTrainer(config)
    lstm_model = lstm_trainer.train(train_df)
    
    # Evaluate on test set
    logger.info("\n--- Model Evaluation ---")
    
    # Get test data
    test_prices = test_df['price_per_kg'].values
    
    # ARIMA forecast
    arima_forecast = arima_trainer.forecast(steps=len(test_df))
    arima_metrics = evaluate_model(test_prices, arima_forecast)
    
    logger.info(f"ARIMA Metrics:")
    logger.info(f"  MAPE: {arima_metrics['mape']:.2f}%")
    logger.info(f"  Accuracy: {arima_metrics['accuracy']:.2f}%")
    logger.info(f"  RMSE: {arima_metrics['rmse']:.2f}")
    logger.info(f"  MAE: {arima_metrics['mae']:.2f}")
    
    # LSTM forecast (use last sequence_length days from train)
    last_sequence = train_df['price_per_kg'].values[-lstm_trainer.sequence_length:]
    lstm_forecast = lstm_trainer.forecast(last_sequence)
    
    # For full test set evaluation, we need to iterate
    lstm_full_forecast = []
    current_sequence = train_df['price_per_kg'].values[-lstm_trainer.sequence_length:]
    
    for i in range(0, len(test_df), lstm_trainer.forecast_days):
        forecast = lstm_trainer.forecast(current_sequence)
        lstm_full_forecast.extend(forecast)
        
        # Update sequence with actual values for next iteration
        if i + lstm_trainer.forecast_days < len(test_df):
            current_sequence = np.concatenate([
                current_sequence[lstm_trainer.forecast_days:],
                test_prices[i:i + lstm_trainer.forecast_days]
            ])
    
    lstm_full_forecast = np.array(lstm_full_forecast[:len(test_df)])
    lstm_metrics = evaluate_model(test_prices, lstm_full_forecast)
    
    logger.info(f"\nLSTM Metrics:")
    logger.info(f"  MAPE: {lstm_metrics['mape']:.2f}%")
    logger.info(f"  Accuracy: {lstm_metrics['accuracy']:.2f}%")
    logger.info(f"  RMSE: {lstm_metrics['rmse']:.2f}")
    logger.info(f"  MAE: {lstm_metrics['mae']:.2f}")
    
    # Ensemble forecast
    ensemble_forecaster = EnsembleForecaster(config)
    ensemble_forecast = ensemble_forecaster.forecast(arima_forecast, lstm_full_forecast)
    ensemble_metrics = evaluate_model(test_prices, ensemble_forecast)
    
    logger.info(f"\nEnsemble Metrics:")
    logger.info(f"  MAPE: {ensemble_metrics['mape']:.2f}%")
    logger.info(f"  Accuracy: {ensemble_metrics['accuracy']:.2f}%")
    logger.info(f"  RMSE: {ensemble_metrics['rmse']:.2f}")
    logger.info(f"  MAE: {ensemble_metrics['mae']:.2f}")
    
    # Check if target accuracy achieved
    target_mape = config['evaluation']['target_mape']
    if ensemble_metrics['mape'] <= target_mape:
        logger.info(f"\n✓ Target accuracy achieved! MAPE {ensemble_metrics['mape']:.2f}% <= {target_mape}%")
    else:
        logger.warning(f"\n⚠ Target accuracy not achieved. MAPE {ensemble_metrics['mape']:.2f}% > {target_mape}%")
    
    # Save models
    models_dir = config['models']['save_dir']
    os.makedirs(models_dir, exist_ok=True)
    
    arima_path = os.path.join(
        models_dir, 
        f"{config['models']['arima_prefix']}{crop_name}_{market_name}.pkl"
    )
    lstm_path = os.path.join(
        models_dir, 
        f"{config['models']['lstm_prefix']}{crop_name}_{market_name}.h5"
    )
    scaler_path = os.path.join(
        models_dir, 
        f"{config['models']['scaler_prefix']}{crop_name}_{market_name}.pkl"
    )
    
    arima_trainer.save(arima_path)
    lstm_trainer.save(lstm_path, scaler_path)
    
    logger.info(f"\n✓ Training complete for {crop_name} in {market_name}")
    
    return {
        'arima_model': arima_model,
        'lstm_model': lstm_model,
        'scaler': lstm_trainer.scaler,
        'arima_metrics': arima_metrics,
        'lstm_metrics': lstm_metrics,
        'ensemble_metrics': ensemble_metrics
    }


def main():
    """Main training function"""
    parser = argparse.ArgumentParser(description='Train price forecasting models')
    parser.add_argument('--crop', type=str, help='Crop name (e.g., tomato)')
    parser.add_argument('--market', type=str, help='Market name (e.g., pune)')
    parser.add_argument('--all', action='store_true', help='Train for all crops and markets')
    parser.add_argument('--config', type=str, default='config.yaml', help='Config file path')
    
    args = parser.parse_args()
    
    # Load config
    with open(args.config, 'r') as f:
        config = yaml.safe_load(f)
    
    # Create logs directory
    os.makedirs('logs', exist_ok=True)
    
    # Train models
    if args.all:
        # Train for all crop-market combinations
        crops = config['training']['crops']
        markets = config['training']['markets']
        
        results = {}
        for crop in crops:
            for market in markets:
                try:
                    result = train_models(crop, market, config)
                    results[f"{crop}_{market}"] = result
                except Exception as e:
                    logger.error(f"✗ Failed to train {crop} in {market}: {e}")
        
        # Summary
        logger.info(f"\n{'='*60}")
        logger.info("TRAINING SUMMARY")
        logger.info(f"{'='*60}")
        
        for key, result in results.items():
            metrics = result['ensemble_metrics']
            logger.info(f"{key}: MAPE={metrics['mape']:.2f}%, Accuracy={metrics['accuracy']:.2f}%")
    
    elif args.crop and args.market:
        # Train for specific crop-market pair
        train_models(args.crop, args.market, config)
    
    else:
        parser.print_help()
        logger.error("Please specify --crop and --market, or use --all")


if __name__ == '__main__':
    main()
