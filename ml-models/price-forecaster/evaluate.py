"""
Model Evaluation Script
Evaluate trained price forecasting models
"""

import os
import argparse
import yaml
import logging
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple

from tensorflow import keras
from sklearn.metrics import mean_absolute_percentage_error, mean_squared_error, mean_absolute_error

from data_loader import PriceDataLoader
from train import ARIMATrainer, LSTMTrainer, EnsembleForecaster

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Set style for plots
sns.set_style('whitegrid')


def load_models(
    crop_name: str,
    market_name: str,
    config: Dict[str, Any]
) -> Tuple[Any, keras.Model, Any]:
    """
    Load trained models
    
    Args:
        crop_name: Name of the crop
        market_name: Name of the market
        config: Configuration dictionary
        
    Returns:
        Tuple of (arima_model, lstm_model, scaler)
    """
    models_dir = config['models']['save_dir']
    
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
    
    # Check if models exist
    if not os.path.exists(arima_path):
        raise FileNotFoundError(f"ARIMA model not found: {arima_path}")
    if not os.path.exists(lstm_path):
        raise FileNotFoundError(f"LSTM model not found: {lstm_path}")
    if not os.path.exists(scaler_path):
        raise FileNotFoundError(f"Scaler not found: {scaler_path}")
    
    # Load models
    arima_model = ARIMATrainer.load(arima_path)
    lstm_model, scaler = LSTMTrainer.load(lstm_path, scaler_path)
    
    return arima_model, lstm_model, scaler


def evaluate_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray
) -> Dict[str, float]:
    """Calculate evaluation metrics"""
    mape = mean_absolute_percentage_error(y_true, y_pred) * 100
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    
    return {
        'mape': mape,
        'rmse': rmse,
        'mae': mae,
        'accuracy': 100 - mape
    }


def plot_forecast(
    dates: pd.DatetimeIndex,
    actual: np.ndarray,
    arima_pred: np.ndarray,
    lstm_pred: np.ndarray,
    ensemble_pred: np.ndarray,
    crop_name: str,
    market_name: str,
    save_path: str = None
):
    """
    Plot forecast comparison
    
    Args:
        dates: Date index
        actual: Actual prices
        arima_pred: ARIMA predictions
        lstm_pred: LSTM predictions
        ensemble_pred: Ensemble predictions
        crop_name: Crop name
        market_name: Market name
        save_path: Path to save plot
    """
    plt.figure(figsize=(14, 8))
    
    plt.plot(dates, actual, label='Actual', color='black', linewidth=2, marker='o', markersize=4)
    plt.plot(dates, arima_pred, label='ARIMA', color='blue', linewidth=1.5, linestyle='--')
    plt.plot(dates, lstm_pred, label='LSTM', color='green', linewidth=1.5, linestyle='--')
    plt.plot(dates, ensemble_pred, label='Ensemble', color='red', linewidth=2, linestyle='-')
    
    plt.title(f'Price Forecast: {crop_name.title()} in {market_name.title()}', fontsize=16, fontweight='bold')
    plt.xlabel('Date', fontsize=12)
    plt.ylabel('Price (₹/kg)', fontsize=12)
    plt.legend(fontsize=10, loc='best')
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        logger.info(f"✓ Plot saved to {save_path}")
    else:
        plt.show()
    
    plt.close()


def plot_metrics_comparison(
    metrics: Dict[str, Dict[str, float]],
    crop_name: str,
    market_name: str,
    save_path: str = None
):
    """
    Plot metrics comparison bar chart
    
    Args:
        metrics: Dictionary of metrics for each model
        crop_name: Crop name
        market_name: Market name
        save_path: Path to save plot
    """
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    
    models = list(metrics.keys())
    metric_names = ['MAPE (%)', 'RMSE (₹)', 'MAE (₹)']
    metric_keys = ['mape', 'rmse', 'mae']
    
    for idx, (ax, metric_name, metric_key) in enumerate(zip(axes, metric_names, metric_keys)):
        values = [metrics[model][metric_key] for model in models]
        colors = ['blue', 'green', 'red']
        
        bars = ax.bar(models, values, color=colors, alpha=0.7, edgecolor='black')
        ax.set_ylabel(metric_name, fontsize=11)
        ax.set_title(metric_name, fontsize=12, fontweight='bold')
        ax.grid(True, alpha=0.3, axis='y')
        
        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{height:.2f}',
                   ha='center', va='bottom', fontsize=10)
    
    fig.suptitle(f'Model Comparison: {crop_name.title()} in {market_name.title()}', 
                 fontsize=14, fontweight='bold')
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        logger.info(f"✓ Metrics plot saved to {save_path}")
    else:
        plt.show()
    
    plt.close()


def evaluate_model(
    crop_name: str,
    market_name: str,
    config: Dict[str, Any],
    plot: bool = True
) -> Dict[str, Any]:
    """
    Evaluate trained models
    
    Args:
        crop_name: Name of the crop
        market_name: Name of the market
        config: Configuration dictionary
        plot: Whether to generate plots
        
    Returns:
        Dictionary with evaluation results
    """
    logger.info(f"\n{'='*60}")
    logger.info(f"Evaluating models for {crop_name.upper()} in {market_name.upper()}")
    logger.info(f"{'='*60}\n")
    
    # Load data
    data_loader = PriceDataLoader()
    train_df, test_df = data_loader.load_data(crop_name, market_name)
    
    # Load models
    arima_model, lstm_model, scaler = load_models(crop_name, market_name, config)
    
    # Get test data
    test_prices = test_df['price_per_kg'].values
    test_dates = test_df.index
    
    # ARIMA forecast
    logger.info("Generating ARIMA forecast...")
    arima_forecast = arima_model.forecast(steps=len(test_df))
    arima_metrics = evaluate_metrics(test_prices, arima_forecast)
    
    # LSTM forecast
    logger.info("Generating LSTM forecast...")
    sequence_length = config['lstm']['sequence_length']
    forecast_days = config['lstm']['forecast_days']
    
    lstm_full_forecast = []
    current_sequence = train_df['price_per_kg'].values[-sequence_length:]
    
    for i in range(0, len(test_df), forecast_days):
        # Normalize
        current_sequence_scaled = scaler.transform(current_sequence.reshape(-1, 1))
        X = current_sequence_scaled.reshape(1, sequence_length, 1)
        
        # Predict
        forecast_scaled = lstm_model.predict(X, verbose=0)
        forecast = scaler.inverse_transform(forecast_scaled.reshape(-1, 1)).flatten()
        
        lstm_full_forecast.extend(forecast)
        
        # Update sequence with actual values
        if i + forecast_days < len(test_df):
            current_sequence = np.concatenate([
                current_sequence[forecast_days:],
                test_prices[i:i + forecast_days]
            ])
    
    lstm_full_forecast = np.array(lstm_full_forecast[:len(test_df)])
    lstm_metrics = evaluate_metrics(test_prices, lstm_full_forecast)
    
    # Ensemble forecast
    logger.info("Generating ensemble forecast...")
    ensemble_forecaster = EnsembleForecaster(config)
    ensemble_forecast = ensemble_forecaster.forecast(arima_forecast, lstm_full_forecast)
    ensemble_metrics = evaluate_metrics(test_prices, ensemble_forecast)
    
    # Print results
    logger.info(f"\n{'='*60}")
    logger.info("EVALUATION RESULTS")
    logger.info(f"{'='*60}\n")
    
    logger.info("ARIMA Model:")
    logger.info(f"  MAPE: {arima_metrics['mape']:.2f}%")
    logger.info(f"  Accuracy: {arima_metrics['accuracy']:.2f}%")
    logger.info(f"  RMSE: ₹{arima_metrics['rmse']:.2f}")
    logger.info(f"  MAE: ₹{arima_metrics['mae']:.2f}")
    
    logger.info("\nLSTM Model:")
    logger.info(f"  MAPE: {lstm_metrics['mape']:.2f}%")
    logger.info(f"  Accuracy: {lstm_metrics['accuracy']:.2f}%")
    logger.info(f"  RMSE: ₹{lstm_metrics['rmse']:.2f}")
    logger.info(f"  MAE: ₹{lstm_metrics['mae']:.2f}")
    
    logger.info("\nEnsemble Model:")
    logger.info(f"  MAPE: {ensemble_metrics['mape']:.2f}%")
    logger.info(f"  Accuracy: {ensemble_metrics['accuracy']:.2f}%")
    logger.info(f"  RMSE: ₹{ensemble_metrics['rmse']:.2f}")
    logger.info(f"  MAE: ₹{ensemble_metrics['mae']:.2f}")
    
    # Check target
    target_mape = config['evaluation']['target_mape']
    if ensemble_metrics['mape'] <= target_mape:
        logger.info(f"\n✓ Target accuracy achieved! MAPE {ensemble_metrics['mape']:.2f}% <= {target_mape}%")
    else:
        logger.warning(f"\n⚠ Target accuracy not achieved. MAPE {ensemble_metrics['mape']:.2f}% > {target_mape}%")
    
    # Generate plots
    if plot:
        plots_dir = 'plots'
        os.makedirs(plots_dir, exist_ok=True)
        
        # Forecast plot
        forecast_plot_path = os.path.join(
            plots_dir,
            f'forecast_{crop_name}_{market_name}.png'
        )
        plot_forecast(
            test_dates,
            test_prices,
            arima_forecast,
            lstm_full_forecast,
            ensemble_forecast,
            crop_name,
            market_name,
            forecast_plot_path
        )
        
        # Metrics comparison plot
        metrics_plot_path = os.path.join(
            plots_dir,
            f'metrics_{crop_name}_{market_name}.png'
        )
        plot_metrics_comparison(
            {
                'ARIMA': arima_metrics,
                'LSTM': lstm_metrics,
                'Ensemble': ensemble_metrics
            },
            crop_name,
            market_name,
            metrics_plot_path
        )
    
    return {
        'arima_metrics': arima_metrics,
        'lstm_metrics': lstm_metrics,
        'ensemble_metrics': ensemble_metrics,
        'test_prices': test_prices,
        'arima_forecast': arima_forecast,
        'lstm_forecast': lstm_full_forecast,
        'ensemble_forecast': ensemble_forecast
    }


def main():
    """Main evaluation function"""
    parser = argparse.ArgumentParser(description='Evaluate price forecasting models')
    parser.add_argument('--crop', type=str, required=True, help='Crop name (e.g., tomato)')
    parser.add_argument('--market', type=str, required=True, help='Market name (e.g., pune)')
    parser.add_argument('--config', type=str, default='config.yaml', help='Config file path')
    parser.add_argument('--no-plot', action='store_true', help='Disable plotting')
    
    args = parser.parse_args()
    
    # Load config
    with open(args.config, 'r') as f:
        config = yaml.safe_load(f)
    
    # Evaluate
    evaluate_model(args.crop, args.market, config, plot=not args.no_plot)


if __name__ == '__main__':
    main()
