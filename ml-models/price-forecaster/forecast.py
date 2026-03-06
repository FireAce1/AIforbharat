"""
Price Forecasting Script
Generate price forecasts using trained models
"""

import os
import argparse
import yaml
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any

from tensorflow import keras

from data_loader import PriceDataLoader
from train import ARIMATrainer, LSTMTrainer, EnsembleForecaster
from evaluate import load_models

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def generate_forecast(
    crop_name: str,
    market_name: str,
    days: int,
    config: Dict[str, Any]
) -> pd.DataFrame:
    """
    Generate price forecast
    
    Args:
        crop_name: Name of the crop
        market_name: Name of the market
        days: Number of days to forecast (7, 30, or 90)
        config: Configuration dictionary
        
    Returns:
        DataFrame with forecast results
    """
    logger.info(f"\n{'='*60}")
    logger.info(f"Generating {days}-day forecast for {crop_name.upper()} in {market_name.upper()}")
    logger.info(f"{'='*60}\n")
    
    # Load recent data
    data_loader = PriceDataLoader()
    logger.info("Loading historical data...")
    
    # Fetch all available data
    df = data_loader.fetch_historical_data(crop_name, market_name)
    df = data_loader.preprocess_data(df)
    
    # Load models
    logger.info("Loading trained models...")
    arima_model, lstm_model, scaler = load_models(crop_name, market_name, config)
    
    # Generate ARIMA forecast
    logger.info("Generating ARIMA forecast...")
    arima_forecast = arima_model.forecast(steps=days)
    
    # Generate LSTM forecast
    logger.info("Generating LSTM forecast...")
    sequence_length = config['lstm']['sequence_length']
    forecast_days = config['lstm']['forecast_days']
    
    # Get last sequence from historical data
    last_prices = df['price_per_kg'].values[-sequence_length:]
    
    lstm_forecast = []
    current_sequence = last_prices.copy()
    
    for i in range(0, days, forecast_days):
        # Normalize
        current_sequence_scaled = scaler.transform(current_sequence.reshape(-1, 1))
        X = current_sequence_scaled.reshape(1, sequence_length, 1)
        
        # Predict
        forecast_scaled = lstm_model.predict(X, verbose=0)
        forecast = scaler.inverse_transform(forecast_scaled.reshape(-1, 1)).flatten()
        
        lstm_forecast.extend(forecast)
        
        # Update sequence with predictions for next iteration
        if i + forecast_days < days:
            current_sequence = np.concatenate([
                current_sequence[forecast_days:],
                forecast
            ])
    
    lstm_forecast = np.array(lstm_forecast[:days])
    
    # Generate ensemble forecast
    logger.info("Generating ensemble forecast...")
    ensemble_forecaster = EnsembleForecaster(config)
    ensemble_forecast = ensemble_forecaster.forecast(arima_forecast, lstm_forecast)
    
    # Create forecast DataFrame
    last_date = df.index[-1]
    forecast_dates = pd.date_range(
        start=last_date + timedelta(days=1),
        periods=days,
        freq='D'
    )
    
    forecast_df = pd.DataFrame({
        'date': forecast_dates,
        'arima_forecast': arima_forecast[:days],
        'lstm_forecast': lstm_forecast,
        'ensemble_forecast': ensemble_forecast,
        'crop_name': crop_name,
        'market_name': market_name
    })
    
    # Add price change indicators
    last_price = df['price_per_kg'].values[-1]
    forecast_df['price_change'] = forecast_df['ensemble_forecast'] - last_price
    forecast_df['price_change_pct'] = (forecast_df['price_change'] / last_price) * 100
    
    # Add trend indicators
    forecast_df['trend'] = forecast_df['price_change_pct'].apply(
        lambda x: 'up' if x > 2 else ('down' if x < -2 else 'stable')
    )
    
    logger.info("\n✓ Forecast generated successfully")
    logger.info(f"\nCurrent Price: ₹{last_price:.2f}/kg")
    logger.info(f"7-day Forecast: ₹{forecast_df.iloc[6]['ensemble_forecast']:.2f}/kg")
    
    if days >= 30:
        logger.info(f"30-day Forecast: ₹{forecast_df.iloc[29]['ensemble_forecast']:.2f}/kg")
    
    if days >= 90:
        logger.info(f"90-day Forecast: ₹{forecast_df.iloc[89]['ensemble_forecast']:.2f}/kg")
    
    return forecast_df


def save_forecast(
    forecast_df: pd.DataFrame,
    output_path: str = None
):
    """
    Save forecast to CSV
    
    Args:
        forecast_df: Forecast DataFrame
        output_path: Output file path
    """
    if output_path is None:
        forecasts_dir = 'forecasts'
        os.makedirs(forecasts_dir, exist_ok=True)
        
        crop = forecast_df['crop_name'].iloc[0]
        market = forecast_df['market_name'].iloc[0]
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        output_path = os.path.join(
            forecasts_dir,
            f'forecast_{crop}_{market}_{timestamp}.csv'
        )
    
    forecast_df.to_csv(output_path, index=False)
    logger.info(f"✓ Forecast saved to {output_path}")


def print_forecast_summary(forecast_df: pd.DataFrame):
    """Print forecast summary"""
    logger.info(f"\n{'='*60}")
    logger.info("FORECAST SUMMARY")
    logger.info(f"{'='*60}\n")
    
    # Weekly summary
    logger.info("7-Day Forecast:")
    for i in range(min(7, len(forecast_df))):
        row = forecast_df.iloc[i]
        trend_symbol = '↑' if row['trend'] == 'up' else ('↓' if row['trend'] == 'down' else '→')
        logger.info(
            f"  {row['date'].strftime('%Y-%m-%d')}: "
            f"₹{row['ensemble_forecast']:.2f}/kg "
            f"{trend_symbol} ({row['price_change_pct']:+.1f}%)"
        )
    
    # Monthly summary (if available)
    if len(forecast_df) >= 30:
        logger.info("\n30-Day Forecast Summary:")
        logger.info(f"  Average Price: ₹{forecast_df.iloc[:30]['ensemble_forecast'].mean():.2f}/kg")
        logger.info(f"  Min Price: ₹{forecast_df.iloc[:30]['ensemble_forecast'].min():.2f}/kg")
        logger.info(f"  Max Price: ₹{forecast_df.iloc[:30]['ensemble_forecast'].max():.2f}/kg")
    
    # Quarterly summary (if available)
    if len(forecast_df) >= 90:
        logger.info("\n90-Day Forecast Summary:")
        logger.info(f"  Average Price: ₹{forecast_df.iloc[:90]['ensemble_forecast'].mean():.2f}/kg")
        logger.info(f"  Min Price: ₹{forecast_df.iloc[:90]['ensemble_forecast'].min():.2f}/kg")
        logger.info(f"  Max Price: ₹{forecast_df.iloc[:90]['ensemble_forecast'].max():.2f}/kg")


def main():
    """Main forecast function"""
    parser = argparse.ArgumentParser(description='Generate price forecasts')
    parser.add_argument('--crop', type=str, required=True, help='Crop name (e.g., tomato)')
    parser.add_argument('--market', type=str, required=True, help='Market name (e.g., pune)')
    parser.add_argument('--days', type=int, default=7, choices=[7, 30, 90], 
                       help='Forecast horizon (7, 30, or 90 days)')
    parser.add_argument('--config', type=str, default='config.yaml', help='Config file path')
    parser.add_argument('--output', type=str, help='Output CSV file path')
    
    args = parser.parse_args()
    
    # Load config
    with open(args.config, 'r') as f:
        config = yaml.safe_load(f)
    
    # Generate forecast
    forecast_df = generate_forecast(args.crop, args.market, args.days, config)
    
    # Print summary
    print_forecast_summary(forecast_df)
    
    # Save forecast
    save_forecast(forecast_df, args.output)


if __name__ == '__main__':
    main()
