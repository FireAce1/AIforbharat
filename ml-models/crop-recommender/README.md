# Crop Recommendation Model

XGBoost-based crop recommendation system that analyzes soil, weather, and market conditions to suggest optimal crops for farmers.

## Model Architecture

- **Algorithm**: XGBoost Classifier
- **Features**: 12 engineered features
- **Output**: Top 3 crop recommendations with confidence scores
- **Target Accuracy**: >85% with 5-fold cross-validation

## Features

### Soil Features (4)
- Nitrogen (N) content
- Phosphorus (P) content
- Potassium (K) content
- pH level

### Climate Features (3)
- Average rainfall (3-month)
- Average temperature (3-month)
- Average humidity (3-month)

### Farm Features (3)
- Farm size (hectares)
- Irrigation type (encoded)
- Previous crop (encoded)

### Market Features (2)
- Price trend (30-day)
- Demand forecast

## Training Data

The model is trained on synthetic agricultural data covering:
- **50 crop classes**: Rice, Wheat, Cotton, Tomato, Onion, Sugarcane, etc.
- **Training samples**: 10,000+ records
- **Validation split**: 20%

## Model Performance

- **Accuracy**: >85% on validation set
- **Cross-validation**: 5-fold CV
- **Inference time**: <100ms

## Files

- `train.py` - Training pipeline
- `config.yaml` - Training configuration
- `requirements.txt` - Python dependencies
- `data/` - Training data directory
- `models/` - Saved model files
- `logs/` - Training logs

## Usage

### Training

```bash
# Install dependencies
pip install -r requirements.txt

# Train model
python train.py

# Evaluate model
python evaluate.py
```

### Inference

```python
from crop_recommender import CropRecommender

recommender = CropRecommender('models/crop_recommender.pkl')

features = {
    'soil_nitrogen': 45.0,
    'soil_phosphorus': 30.0,
    'soil_potassium': 25.0,
    'soil_ph': 6.5,
    'rainfall_avg_3m': 150.0,
    'temperature_avg_3m': 28.0,
    'humidity_avg_3m': 70.0,
    'farm_size': 2.0,
    'irrigation_type': 'drip',
    'previous_crop': 'wheat',
    'price_trend_30d': 5.2,
    'demand_forecast': 0.8
}

recommendations = recommender.predict(features, top_k=3)
```

## Integration

The trained model is integrated into the Crop Service API:
- Endpoint: `POST /api/v1/crop/recommend`
- Response time: <500ms
- Caching: 24-hour TTL in Redis
