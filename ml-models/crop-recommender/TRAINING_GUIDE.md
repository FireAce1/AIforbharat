# Crop Recommendation Model - Training Guide

## Overview

This guide explains how to train the XGBoost-based crop recommendation model that analyzes soil, weather, farm, and market conditions to suggest optimal crops for farmers.

## Model Architecture

### Algorithm
- **XGBoost Classifier** (Extreme Gradient Boosting)
- Multi-class classification (50 crop classes)
- Ensemble of decision trees

### Hyperparameters
- `n_estimators`: 100 (number of trees)
- `max_depth`: 6 (maximum tree depth)
- `learning_rate`: 0.1
- `subsample`: 0.8 (row sampling)
- `colsample_bytree`: 0.8 (column sampling)

## Features (12 total)

### 1. Soil Features (4)
- **soil_nitrogen**: Nitrogen content (kg/ha)
- **soil_phosphorus**: Phosphorus content (kg/ha)
- **soil_potassium**: Potassium content (kg/ha)
- **soil_ph**: pH level (5.5-8.5)

### 2. Climate Features (3)
- **rainfall_avg_3m**: Average rainfall over 3 months (mm)
- **temperature_avg_3m**: Average temperature over 3 months (°C)
- **humidity_avg_3m**: Average humidity over 3 months (%)

### 3. Farm Features (3)
- **farm_size**: Farm size in hectares
- **irrigation_type**: Type of irrigation (encoded)
  - Options: rainfed, borewell, canal, drip, sprinkler
- **previous_crop**: Previously grown crop (encoded)

### 4. Market Features (2)
- **price_trend_30d**: Price trend over 30 days (%)
- **demand_forecast**: Demand forecast score (0-1)

## Training Data

### Current Implementation
The training pipeline includes synthetic data generation for demonstration purposes. In production, this should be replaced with real agricultural data from:

- Historical farm records
- Soil test results
- Weather station data
- Market price databases
- Yield records

### Data Requirements
- **Minimum samples**: 10,000 records
- **Crop classes**: 50 major Indian crops
- **Data split**: 80% training, 20% testing
- **Cross-validation**: 5-fold

## Setup Instructions

### Prerequisites
- Python 3.8 or higher
- pip package manager
- 2GB RAM minimum
- 1GB disk space

### Installation

#### Linux/Mac
```bash
cd ml-models/crop-recommender
chmod +x setup.sh
./setup.sh
source venv/bin/activate
```

#### Windows
```powershell
cd ml-models\crop-recommender
.\setup.ps1
.\venv\Scripts\Activate.ps1
```

## Training Process

### Step 1: Prepare Data
If using real data, place your CSV file at `data/crop_training_data.csv` with the following columns:
- soil_nitrogen
- soil_phosphorus
- soil_potassium
- soil_ph
- rainfall_avg_3m
- temperature_avg_3m
- humidity_avg_3m
- farm_size
- irrigation_type
- previous_crop
- price_trend_30d
- demand_forecast
- crop (target label)

If no data is provided, the training script will generate synthetic data automatically.

### Step 2: Train Model
```bash
python train.py
```

Expected output:
```
============================================================
Starting Crop Recommendation Model Training
============================================================
Loading training data from data/crop_training_data.csv
Loaded 10000 samples with 13 features
Preprocessing data...
Preprocessed features shape: (10000, 12)
Number of crop classes: 50
Training XGBoost model...
Training set: 8000 samples
Test set: 2000 samples
Fitting model...
Test set accuracy: 0.8750
Performing 5-fold cross-validation...
Cross-validation accuracy: 0.8623 (+/- 0.0145)
✓ Target accuracy of 0.85 achieved!

Top 5 most important features:
  soil_nitrogen: 0.1523
  rainfall_avg_3m: 0.1342
  temperature_avg_3m: 0.1198
  soil_ph: 0.1087
  price_trend_30d: 0.0956

Saving model and preprocessors...
Saved model to models/crop_recommender.pkl
Saved feature scaler to models/feature_scaler.pkl
Saved label encoder to models/label_encoder.pkl
============================================================
Training Complete!
Time elapsed: 45.23 seconds
Test Accuracy: 0.8750
CV Accuracy: 0.8623 (+/- 0.0145)
============================================================
✓ Model training successful! Ready for deployment.
```

### Step 3: Evaluate Model
```bash
python evaluate.py
```

This will:
- Load the trained model
- Evaluate on test set
- Display accuracy metrics
- Show sample predictions
- Generate classification report

### Step 4: Test Inference
```bash
python crop_recommender.py
```

This runs a sample inference to verify the model works correctly.

## Model Outputs

The trained model generates three files in the `models/` directory:

1. **crop_recommender.pkl** (5-10 MB)
   - Trained XGBoost model
   - Used for inference

2. **feature_scaler.pkl** (50-100 KB)
   - StandardScaler for numerical features
   - LabelEncoders for categorical features

3. **label_encoder.pkl** (10-20 KB)
   - Maps crop indices to crop names

## Performance Targets

### Accuracy
- **Target**: >85% accuracy
- **Metric**: 5-fold cross-validation
- **Top-3 Accuracy**: >95% (at least one correct crop in top 3)

### Inference Speed
- **Target**: <100ms per prediction
- **Measured on**: Standard CPU (no GPU required)

### Model Size
- **Target**: <15 MB total
- **Actual**: ~5-10 MB (XGBoost model is compact)

## Integration with Crop Service

The trained model is used by the Crop Service API:

```python
from crop_recommender import load_recommender

# Load model
recommender = load_recommender('models')

# Get recommendations
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
    'previous_crop': 'Wheat',
    'price_trend_30d': 5.2,
    'demand_forecast': 0.8
}

recommendations = recommender.predict(features, top_k=3)
# Returns: [
#   {'crop': 'Rice', 'confidence': 0.87, 'rank': 1},
#   {'crop': 'Cotton', 'confidence': 0.76, 'rank': 2},
#   {'crop': 'Sugarcane', 'confidence': 0.68, 'rank': 3}
# ]
```

## Troubleshooting

### Issue: Low Accuracy (<85%)
**Solutions:**
- Increase training data size
- Tune hyperparameters (n_estimators, max_depth, learning_rate)
- Add more features (organic carbon, micronutrients)
- Balance class distribution
- Use real agricultural data instead of synthetic

### Issue: Slow Training
**Solutions:**
- Reduce n_estimators (try 50 instead of 100)
- Reduce max_depth (try 4 instead of 6)
- Use fewer cross-validation folds (3 instead of 5)
- Enable GPU acceleration (if available)

### Issue: Model File Not Found
**Solutions:**
- Ensure training completed successfully
- Check `models/` directory exists
- Verify file paths in config.yaml

### Issue: Import Errors
**Solutions:**
- Activate virtual environment
- Reinstall dependencies: `pip install -r requirements.txt`
- Check Python version (3.8+)

## Next Steps

After successful training:

1. **Copy model files to Crop Service**
   ```bash
   cp models/*.pkl ../services/crop-service/models/
   ```

2. **Update Crop Service configuration**
   - Verify model paths in `services/crop-service/src/config.py`

3. **Test API endpoint**
   ```bash
   curl -X POST http://localhost:8001/api/v1/crop/recommend \
     -H "Content-Type: application/json" \
     -d '{"farm_id": "uuid", "features": {...}}'
   ```

4. **Deploy to production**
   - Build Docker image with model files
   - Deploy to Kubernetes cluster
   - Monitor inference latency and accuracy

## Production Considerations

### Data Collection
- Integrate with soil testing labs for accurate N/P/K/pH data
- Use IMD API for historical weather data
- Collect market price data from Agmarknet
- Track actual yields for model validation

### Model Retraining
- Retrain quarterly with new data
- Monitor model drift (accuracy degradation)
- A/B test new models before deployment
- Maintain model versioning

### Monitoring
- Track inference latency (<100ms target)
- Monitor prediction confidence scores
- Log feature distributions for drift detection
- Collect user feedback on recommendations

## References

- XGBoost Documentation: https://xgboost.readthedocs.io/
- Scikit-learn: https://scikit-learn.org/
- FAO Crop Requirements: http://www.fao.org/land-water/databases-and-software/crop-information/en/
- Indian Agricultural Research: https://icar.org.in/
