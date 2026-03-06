# Disease Detection Model

This module contains the training pipeline for the plant disease detection model using MobileNetV3-Small.

## Overview

- **Model**: MobileNetV3-Small with custom classification head
- **Dataset**: PlantVillage (87K images, 120 diseases)
- **Target Accuracy**: >90% on validation set
- **Output**: TensorFlow Lite model for mobile deployment (<15MB)
- **Inference Time**: <2 seconds on mobile devices

## Requirements

- Python 3.8+
- TensorFlow 2.13.0
- CUDA-capable GPU (recommended for training)
- 16GB RAM minimum
- 50GB disk space for dataset

## Setup

### 1. Install Dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Download Dataset

The model uses the PlantVillage dataset from Kaggle. You need Kaggle API credentials:

```bash
# Set up Kaggle API credentials
# 1. Go to https://www.kaggle.com/account
# 2. Create API token (downloads kaggle.json)
# 3. Place kaggle.json in ~/.kaggle/ (Linux/Mac) or C:\Users\<username>\.kaggle\ (Windows)

# Download dataset
python scripts/download_dataset.py
```

**Manual Download Alternative:**
If Kaggle API doesn't work, download manually:
1. Visit: https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset
2. Download and extract to `./data/plantvillage/`

### 3. Train Model

```bash
# Train with default settings (50 epochs)
python train.py

# Train with custom settings
python train.py --epochs 100 --batch-size 64 --learning-rate 0.0005

# Monitor training with TensorBoard
tensorboard --logdir logs/
```

**Training Process:**
- **Phase 1**: Train custom classification head (frozen base model)
- **Phase 2**: Fine-tune entire model with lower learning rate
- **Duration**: ~4-6 hours on GPU, ~24-48 hours on CPU

### 4. Evaluate Model

```bash
# Evaluate trained model
python evaluate.py --model-path models/disease_detector.h5
```

**Evaluation Outputs:**
- Overall accuracy and loss
- Top-3 accuracy
- Per-class classification report
- Confusion matrix visualization
- Detailed evaluation report (saved to `models/evaluation_report.txt`)

### 5. Convert to TensorFlow Lite

```bash
# Convert with quantization (recommended)
python convert_to_tflite.py --model-path models/disease_detector.h5

# Convert without quantization (larger file, slightly better accuracy)
python convert_to_tflite.py --model-path models/disease_detector.h5 --no-quantize

# Skip validation set accuracy check (faster)
python convert_to_tflite.py --skip-validation
```

**Conversion Outputs:**
- `disease_detector.tflite` - Optimized model for mobile
- `model_metadata_v{version}.json` - Model versioning metadata
- `ota/v{version}/` - OTA update package
- `ota/version_registry.json` - Version registry for updates
- Model size verification (<15MB target)
- Inference time test (<2s target)
- Accuracy verification on validation set (>90% target)

### 6. Test on Simulated Android Device

```bash
# Test inference speed on simulated 2GB RAM device
python test_android_emulator.py --model-path models/disease_detector.tflite

# Run with more iterations for better statistics
python test_android_emulator.py --iterations 200

# Save results to JSON file
python test_android_emulator.py --save-results
```

**Test Outputs:**
- Inference speed statistics (mean, median, P95, P99)
- Memory usage estimation
- Performance rating (Excellent/Good/Acceptable/Poor)
- Target verification (<2s inference time)

## Model Architecture

### Base Model
- **Architecture**: MobileNetV3-Small (pre-trained on ImageNet)
- **Input**: 224x224x3 RGB images
- **Weights**: ImageNet pre-trained (transfer learning)

### Custom Classification Head
```
GlobalAveragePooling2D
    ↓
Dropout(0.3)
    ↓
Dense(256, activation='relu')
    ↓
Dropout(0.3)
    ↓
Dense(120, activation='softmax')  # 120 disease classes
```

### Training Strategy
1. **Phase 1**: Freeze base model, train classification head (25 epochs)
2. **Phase 2**: Unfreeze all layers, fine-tune with lower LR (25 epochs)

## Data Augmentation

Applied during training to improve model generalization:

- **Rotation**: ±20 degrees
- **Width/Height Shift**: ±20%
- **Horizontal Flip**: Yes
- **Zoom**: ±20%
- **Brightness**: 80-120%
- **Fill Mode**: Nearest neighbor

## Training Configuration

Default settings in `config.yaml`:

```yaml
training:
  epochs: 50
  batch_size: 32
  learning_rate: 0.001
  validation_split: 0.2
  early_stopping_patience: 5
  reduce_lr_patience: 3
```

## Performance Targets

| Metric | Target | Typical Result |
|--------|--------|----------------|
| Validation Accuracy | >90% | 92-95% |
| Top-3 Accuracy | >95% | 97-99% |
| Model Size (TFLite) | <15MB | 10-12MB |
| Inference Time (Mobile) | <2s | 0.5-1.5s |

## Dataset Information

**PlantVillage Dataset:**
- **Total Images**: ~87,000
- **Disease Classes**: 120 (covering 38 crop types)
- **Image Resolution**: Variable (resized to 224x224)
- **Format**: JPG/JPEG
- **Split**: 80% training, 20% validation

**Crop Coverage:**
- Apple, Blueberry, Cherry, Corn, Grape, Orange, Peach, Pepper, Potato, Raspberry, Soybean, Squash, Strawberry, Tomato, and more

**Disease Types:**
- Fungal diseases (e.g., Early Blight, Late Blight, Powdery Mildew)
- Bacterial diseases (e.g., Bacterial Spot)
- Viral diseases (e.g., Mosaic Virus)
- Healthy plant images (for comparison)

## Output Files

After training and conversion:

```
ml-models/disease-detector/
├── models/
│   ├── disease_detector.h5          # Trained Keras model
│   ├── disease_detector.tflite      # TFLite model for mobile
│   ├── class_indices.json           # Disease class mappings
│   ├── training_history.json        # Training metrics
│   ├── evaluation_report.txt        # Evaluation results
│   ├── model_metadata_v{version}.json  # Model versioning metadata
│   ├── android_test_results.json    # Android performance test results
│   └── ota/                         # OTA update packages
│       ├── version_registry.json    # Version registry
│       ├── v20240115.1430/
│       │   ├── manifest.json
│       │   ├── disease_detector.tflite
│       │   └── class_indices.json
│       └── v20240120.0900/
│           ├── manifest.json
│           ├── disease_detector.tflite
│           └── class_indices.json
├── checkpoints/
│   └── model_best_*.h5              # Best model checkpoints
└── logs/
    └── */                           # TensorBoard logs
```

## Mobile Deployment

### Initial Deployment (App Release)

```bash
# Copy TFLite model to mobile app assets
cp models/disease_detector.tflite ../mobile/krishiai-app/android/app/src/main/assets/

# Copy class indices
cp models/class_indices.json ../mobile/krishiai-app/android/app/src/main/assets/
```

### OTA (Over-The-Air) Updates

For subsequent model updates without requiring app updates:

**1. Create OTA Package**
```bash
# Convert model and create OTA package
python convert_to_tflite.py --model-path models/disease_detector.h5
```

**2. Upload to CDN**
```bash
# Upload to AWS S3 (example)
aws s3 sync models/ota/ s3://krishiai-cdn/models/disease_detector/ \
  --acl public-read \
  --cache-control "max-age=86400"

# Invalidate CloudFlare cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://cdn.krishiai.com/models/disease_detector/version_registry.json"]}'
```

**3. Mobile App Auto-Update**

The mobile app automatically:
- Checks for updates on WiFi connection
- Downloads new model in background
- Verifies integrity (SHA256 hash)
- Installs update seamlessly

See [OTA_UPDATE_GUIDE.md](OTA_UPDATE_GUIDE.md) for complete documentation.

### Integration Steps

1. Install TensorFlow Lite in React Native app
2. Load model on app startup
3. Preprocess images (resize to 224x224, normalize to [0,1])
4. Run inference
5. Map output indices to disease names using class_indices.json

See mobile app integration examples in [OTA_UPDATE_GUIDE.md](OTA_UPDATE_GUIDE.md).

## Troubleshooting

### Out of Memory During Training
- Reduce batch size: `--batch-size 16`
- Use mixed precision training (add to train.py)
- Close other applications

### Low Accuracy (<90%)
- Train for more epochs: `--epochs 100`
- Adjust learning rate: `--learning-rate 0.0005`
- Check dataset quality and balance
- Increase data augmentation

### TFLite Model Too Large (>15MB)
- Enable quantization (default)
- Use int8 quantization (requires representative dataset)
- Reduce model complexity (fewer layers in classification head)

### Slow Inference on Mobile
- Verify quantization is enabled
- Use GPU delegate on mobile (if available)
- Reduce input image size (trade-off with accuracy)

## Advanced Usage

### Custom Dataset

To train on your own dataset:

1. Organize images in this structure:
```
data/custom_dataset/
├── disease_class_1/
│   ├── image1.jpg
│   ├── image2.jpg
│   └── ...
├── disease_class_2/
│   └── ...
└── ...
```

2. Update `config.yaml`:
```yaml
dataset:
  data_dir: ./data/custom_dataset
  num_diseases: <your_class_count>
```

3. Train as usual

### Hyperparameter Tuning

Experiment with different configurations:

```bash
# Higher learning rate for faster convergence
python train.py --learning-rate 0.005

# Larger batch size (requires more memory)
python train.py --batch-size 64

# More epochs for better accuracy
python train.py --epochs 100
```

## Citation

If you use this model or training pipeline, please cite:

**PlantVillage Dataset:**
```
Hughes, D. P., & Salathé, M. (2015). An open access repository of images on plant health to enable the development of mobile disease diagnostics. arXiv preprint arXiv:1511.08060.
```

**MobileNetV3:**
```
Howard, A., Sandler, M., Chu, G., Chen, L. C., Chen, B., Tan, M., ... & Adam, H. (2019). Searching for mobilenetv3. In Proceedings of the IEEE/CVF International Conference on Computer Vision (pp. 1314-1324).
```

## License

This training pipeline is part of the KrishiAI platform. See LICENSE file for details.

## Support

For issues or questions:
- Check existing issues in the repository
- Create a new issue with detailed description
- Include training logs and error messages
