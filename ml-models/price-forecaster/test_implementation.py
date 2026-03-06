"""
Test script to verify price forecaster implementation
This script tests the core functionality without requiring actual database data
"""

import numpy as np
import pandas as pd
import yaml
from datetime import datetime, timedelta

# Test imports
try:
    from data_loader import PriceDataLoader
    print("✓ data_loader.py imported successfully")
except Exception as e:
    print(f"✗ Failed to import data_loader.py: {e}")

try:
    from train import ARIMATrainer, LSTMTrainer, EnsembleForecaster, evaluate_model
    print("✓ train.py imported successfully")
except Exception as e:
    print(f"✗ Failed to import train.py: {e}")

try:
    from evaluate import load_models, evaluate_metrics
    print("✓ evaluate.py imported successfully")
except Exception as e:
    print(f"✗ Failed to import evaluate.py: {e}")

try:
    from forecast import generate_forecast
    print("✓ forecast.py imported successfully")
except Exception as e:
    print(f"✗ Failed to import forecast.py: {e}")


def test_config_loading():
    """Test configuration loading"""
    print("\n--- Testing Configuration Loading ---")
    try:
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        
        assert 'arima' in config
        assert 'lstm' in config
        assert 'ensemble' in config
        assert config['arima']['order'] == [5, 1, 2]
        assert config['ensemble']['arima_weight'] == 0.6
        assert config['ensemble']['lstm_weight'] == 0.4
        
        print("✓ Configuration loaded and validated")
        return config
    except Exception as e:
        print(f"✗ Configuration test failed: {e}")
        return None


def test_arima_trainer(config):
    """Test ARIMA trainer with synthetic data"""
    print("\n--- Testing ARIMA Trainer ---")
    try:
        # Create synthetic price data
        dates = pd.date_range(start='2021-01-01', periods=365*2, freq='D')
        prices = 20 + 5 * np.sin(np.arange(len(dates)) * 2 * np.pi / 365) + np.random.randn(len(dates)) * 2
        
        train_df = pd.DataFrame({
            'price_per_kg': prices
        }, index=dates)
        
        # Train ARIMA
        trainer = ARIMATrainer(config)
        model = trainer.train(train_df)
        
        # Generate forecast
        forecast = trainer.forecast(steps=7)
        
        assert len(forecast) == 7
        assert all(forecast > 0)  # Prices should be positive
        
        print(f"✓ ARIMA trainer working correctly")
        print(f"  Sample forecast: {forecast[:3]}")
        return True
    except Exception as e:
        print(f"✗ ARIMA trainer test failed: {e}")
        return False


def test_lstm_trainer(config):
    """Test LSTM trainer with synthetic data"""
    print("\n--- Testing LSTM Trainer ---")
    try:
        # Create synthetic price data
        dates = pd.date_range(start='2021-01-01', periods=365*2, freq='D')
        prices = 20 + 5 * np.sin(np.arange(len(dates)) * 2 * np.pi / 365) + np.random.randn(len(dates)) * 2
        
        train_df = pd.DataFrame({
            'price_per_kg': prices
        }, index=dates)
        
        # Train LSTM
        trainer = LSTMTrainer(config)
        model = trainer.train(train_df, validation_split=0.2)
        
        # Generate forecast
        last_sequence = train_df['price_per_kg'].values[-30:]
        forecast = trainer.forecast(last_sequence)
        
        assert len(forecast) == 7
        assert all(forecast > 0)  # Prices should be positive
        
        print(f"✓ LSTM trainer working correctly")
        print(f"  Sample forecast: {forecast[:3]}")
        return True
    except Exception as e:
        print(f"✗ LSTM trainer test failed: {e}")
        return False


def test_ensemble_forecaster(config):
    """Test ensemble forecaster"""
    print("\n--- Testing Ensemble Forecaster ---")
    try:
        # Create synthetic forecasts
        arima_forecast = np.array([20.5, 21.0, 21.5, 22.0, 22.5, 23.0, 23.5])
        lstm_forecast = np.array([20.0, 20.8, 21.3, 21.8, 22.3, 22.8, 23.3])
        
        # Create ensemble
        forecaster = EnsembleForecaster(config)
        ensemble_forecast = forecaster.forecast(arima_forecast, lstm_forecast)
        
        assert len(ensemble_forecast) == 7
        
        # Check weighted average
        expected = 0.6 * arima_forecast + 0.4 * lstm_forecast
        np.testing.assert_array_almost_equal(ensemble_forecast, expected, decimal=5)
        
        print(f"✓ Ensemble forecaster working correctly")
        print(f"  Sample ensemble: {ensemble_forecast[:3]}")
        return True
    except Exception as e:
        print(f"✗ Ensemble forecaster test failed: {e}")
        return False


def test_evaluation_metrics():
    """Test evaluation metrics calculation"""
    print("\n--- Testing Evaluation Metrics ---")
    try:
        y_true = np.array([20, 21, 22, 23, 24, 25, 26])
        y_pred = np.array([19.5, 21.2, 21.8, 23.5, 23.8, 25.3, 26.2])
        
        metrics = evaluate_metrics(y_true, y_pred)
        
        assert 'mape' in metrics
        assert 'rmse' in metrics
        assert 'mae' in metrics
        assert 'accuracy' in metrics
        
        assert 0 <= metrics['mape'] <= 100
        assert metrics['accuracy'] == 100 - metrics['mape']
        
        print(f"✓ Evaluation metrics working correctly")
        print(f"  MAPE: {metrics['mape']:.2f}%")
        print(f"  Accuracy: {metrics['accuracy']:.2f}%")
        print(f"  RMSE: {metrics['rmse']:.2f}")
        print(f"  MAE: {metrics['mae']:.2f}")
        return True
    except Exception as e:
        print(f"✗ Evaluation metrics test failed: {e}")
        return False


def main():
    """Run all tests"""
    print("="*60)
    print("PRICE FORECASTER IMPLEMENTATION TEST")
    print("="*60)
    
    # Test configuration
    config = test_config_loading()
    if config is None:
        print("\n✗ Cannot proceed without valid configuration")
        return
    
    # Test components
    results = []
    results.append(test_arima_trainer(config))
    results.append(test_lstm_trainer(config))
    results.append(test_ensemble_forecaster(config))
    results.append(test_evaluation_metrics())
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(results)
    total = len(results)
    
    print(f"Tests Passed: {passed}/{total}")
    
    if passed == total:
        print("\n✓ All tests passed! Implementation is working correctly.")
        print("\nNext steps:")
        print("1. Ensure PostgreSQL database is set up with market_prices table")
        print("2. Load historical price data (5 years minimum)")
        print("3. Run: python train.py --crop tomato --market pune")
        print("4. Evaluate: python evaluate.py --crop tomato --market pune")
        print("5. Generate forecast: python forecast.py --crop tomato --market pune --days 7")
    else:
        print(f"\n⚠ {total - passed} test(s) failed. Please review the errors above.")


if __name__ == '__main__':
    main()
