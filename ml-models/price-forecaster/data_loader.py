"""
Data loader for price forecasting model
Fetches historical price data from PostgreSQL TimescaleDB
"""

import os
import psycopg2
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Tuple, Optional
import yaml
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PriceDataLoader:
    """Load and preprocess historical price data"""
    
    def __init__(self, config_path: str = 'config.yaml'):
        """Initialize data loader with configuration"""
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
        
        self.db_config = self.config['database']
        self.data_config = self.config['data']
        
    def connect_db(self) -> psycopg2.extensions.connection:
        """Create database connection"""
        try:
            conn = psycopg2.connect(
                host=os.getenv('DB_HOST', self.db_config['host']),
                port=os.getenv('DB_PORT', self.db_config['port']),
                database=os.getenv('DB_NAME', self.db_config['database']),
                user=os.getenv('DB_USER', self.db_config['user']),
                password=os.getenv('DB_PASSWORD', self.db_config['password'])
            )
            logger.info("✓ Database connection established")
            return conn
        except Exception as e:
            logger.error(f"✗ Database connection failed: {e}")
            raise
    
    def fetch_historical_data(
        self, 
        crop_name: str, 
        market_name: str,
        years: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Fetch historical price data for a crop-market pair
        
        Args:
            crop_name: Name of the crop (e.g., 'tomato')
            market_name: Name of the market (e.g., 'pune')
            years: Number of years of historical data (default from config)
            
        Returns:
            DataFrame with columns: date, price_per_kg, quantity_traded
        """
        if years is None:
            years = self.data_config['historical_years']
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=years * 365)
        
        query = """
        SELECT 
            time::date as date,
            AVG(price_per_kg) as price_per_kg,
            SUM(quantity_traded) as quantity_traded
        FROM market_prices
        WHERE crop_name = %s
          AND market_name = %s
          AND time >= %s
          AND time <= %s
        GROUP BY time::date
        ORDER BY date ASC
        """
        
        conn = self.connect_db()
        try:
            df = pd.read_sql_query(
                query, 
                conn, 
                params=(crop_name, market_name, start_date, end_date)
            )
            logger.info(f"✓ Fetched {len(df)} records for {crop_name} in {market_name}")
            
            if len(df) < self.data_config['min_records']:
                logger.warning(
                    f"⚠ Insufficient data: {len(df)} records "
                    f"(minimum: {self.data_config['min_records']})"
                )
            
            return df
        finally:
            conn.close()
    
    def preprocess_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Preprocess price data
        - Handle missing values
        - Remove outliers
        - Ensure daily frequency
        
        Args:
            df: Raw price data
            
        Returns:
            Preprocessed DataFrame
        """
        # Convert date to datetime
        df['date'] = pd.to_datetime(df['date'])
        df = df.set_index('date')
        
        # Ensure daily frequency (fill missing dates)
        df = df.asfreq('D')
        
        # Forward fill missing prices (up to 3 days)
        df['price_per_kg'] = df['price_per_kg'].fillna(method='ffill', limit=3)
        
        # Backward fill remaining missing values
        df['price_per_kg'] = df['price_per_kg'].fillna(method='bfill', limit=3)
        
        # Drop any remaining NaN values
        df = df.dropna(subset=['price_per_kg'])
        
        # Remove outliers using IQR method
        Q1 = df['price_per_kg'].quantile(0.25)
        Q3 = df['price_per_kg'].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 3 * IQR
        upper_bound = Q3 + 3 * IQR
        
        outliers_before = len(df)
        df = df[(df['price_per_kg'] >= lower_bound) & (df['price_per_kg'] <= upper_bound)]
        outliers_removed = outliers_before - len(df)
        
        if outliers_removed > 0:
            logger.info(f"✓ Removed {outliers_removed} outliers")
        
        logger.info(f"✓ Preprocessed data: {len(df)} records")
        return df
    
    def split_data(
        self, 
        df: pd.DataFrame, 
        train_ratio: Optional[float] = None
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Split data into train and test sets
        
        Args:
            df: Preprocessed data
            train_ratio: Ratio of training data (default from config)
            
        Returns:
            Tuple of (train_df, test_df)
        """
        if train_ratio is None:
            train_ratio = self.data_config['train_test_split']
        
        split_idx = int(len(df) * train_ratio)
        train_df = df.iloc[:split_idx]
        test_df = df.iloc[split_idx:]
        
        logger.info(f"✓ Train set: {len(train_df)} records")
        logger.info(f"✓ Test set: {len(test_df)} records")
        
        return train_df, test_df
    
    def load_data(
        self, 
        crop_name: str, 
        market_name: str
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Complete data loading pipeline
        
        Args:
            crop_name: Name of the crop
            market_name: Name of the market
            
        Returns:
            Tuple of (train_df, test_df)
        """
        logger.info(f"Loading data for {crop_name} in {market_name}...")
        
        # Fetch data
        df = self.fetch_historical_data(crop_name, market_name)
        
        # Preprocess
        df = self.preprocess_data(df)
        
        # Split
        train_df, test_df = self.split_data(df)
        
        logger.info("✓ Data loading complete")
        return train_df, test_df


if __name__ == '__main__':
    # Test data loader
    loader = PriceDataLoader()
    train_df, test_df = loader.load_data('tomato', 'pune')
    print(f"\nTrain data shape: {train_df.shape}")
    print(f"Test data shape: {test_df.shape}")
    print(f"\nSample data:\n{train_df.head()}")
