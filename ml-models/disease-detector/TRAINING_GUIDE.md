# Disease Detection Model - Training Guide

This guide provides step-by-step instructions for training the disease detection model.

## Prerequisites

- Python 3.8 or higher
- 16GB RAM minimum (32GB recommended)
- NVIDIA GPU with CUDA support (optional but highly recommended)
- 50GB free disk space
- Stable internet connection for dataset download

## Quick Start

### Windows

```powershell
# Run setup script
.\setup.ps1

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Download dataset
python scripts\download_dataset.py

# Train model
python train.py
```

### Linux/Mac

```bash
# Run setup script
chmod +x setup.sh
./setup.sh

# Activate virtual environment
source venv/bin/activate

# Download dataset
python scripts/download_dataset.py

# Train model
python train.py
```

## Detailed Steps

### Step 1: Environment Setup

1. **Install Python 3.8+**
   - Download from https://www.python.org/downloads/
   - Verify: `python --version`

2. **Install CUDA (for GPU training)**
   - Download CUDA Toolkit 11.8 from NVIDIA
   - Install cuDNN 8.6
   - Verify: `nvidia-smi`

3. **Run setup script**
   ```bash
   # Linux/Mac
   ./setup.sh
   
   # Windows
   .\setup.ps1
   ```

### Step 2: Dataset Preparation

1. **Set up Kaggle API**
   ```bash
   # Create Kaggle account at kaggle.com
   # Go to Account settings → API → Create New API Token
   # This downloads kaggle.json
   
   # Linux/Mac
   mkdir -p ~/.kaggle
   mv kaggle.json ~/.kaggle/
   chmod 600 ~/.kaggle/kaggle.json
   
   # Windows
   # Place kaggle.json in C:\Users\<username>\.kaggle\
   ```

2. **Download PlantVillage dataset**
   ```bash
   python scripts/download_dataset.py
   ```
   
   This will:
   - Download ~2GB dataset from Kaggle
   - Extract to `data/plantvillage/`
   - Organize into class folders
   - Display dataset statistics

3. **Verify dataset**
   ```bash
   # Should see ~87,000 images in 120 class folders
   ls data/plantvillage/
   ```

### Step 3: Training

1. **Start training with default settings**
   ```bash
   python train.py
   ```
   
   Default configuration:
   - Epochs: 50
   - Batch size: 32
   - Learning rate: 0.001
   - Validation split: 20%

2. **Monitor training with TensorBoard**
   ```bash
   # In a separate terminal
   tensorboard --logdir logs/
   # Open http://localhost:6006 in browser
   ```

3. **Training phases**
   
   **Phase 1 (Epochs 1-25):**
   - Trains only the custom classification head
   - Base MobileNetV3 layers are frozen
   - Faster training, learns task-specific features
   
   **Phase 2 (Epochs 26-50):**
   - Fine-tunes entire model
   - All layers are trainable
   - Lower learning rate (0.0001)
   - Achieves higher accuracy

4. **Expected training time**
   - GPU (NVIDIA RTX 3080): 4-6 hours
   - GPU (NVIDIA T4): 8-12 hours
   - CPU only: 24-48 hours (not recommended)

### Step 4: Evaluation

1. **Evaluate trained model**
   ```bash
   python evaluate.py --model-path models/disease_detector.h5
   ```
   
   This generates:
   - Overall accuracy metrics
   - Per-class classification report
   - Confusion matrix visualization
   - Evaluation report (saved to `models/evaluation_report.txt`)

2. **Check results**
   ```bash
   # View evaluation report
   cat models/evaluation_report.txt
   
   # View confusion matrix
   # Open models/confusion_matrix.png
   ```

3. **Target metrics**
   - Validation accuracy: >90%
   - Top-3 accuracy: >95%
   - Per-class accuracy: >85% for most classes

### Step 5: TensorFlow Lite Conversion

1. **Convert to TFLite**
   ```bash
   python convert_to_tflite.py --model-path models/disease_detector.h5
   ```
   
   This will:
   - Convert Keras model to TFLite format
   - Apply quantization (reduces size)
   - Test inference speed
   - Compare accuracy with original model

2. **Verify conversion**
   ```bash
   # Check model size (should be <15MB)
   ls -lh models/disease_detector.tflite
   
   # Check inference time (should be <2000ms)
   # Displayed in conversion output
   ```

3. **Output files**
   - `disease_detector.tflite` - Optimized model for mobile
   - `class_indices.json` - Disease class mappings
   - `training_history.json` - Training metrics

### Step 6: Mobile Deployment

1. **Copy files to mobile app**
   ```bash
   # Copy TFLite model
   cp models/disease_detector.tflite \
      ../../mobile/krishiai-app/android/app/src/main/assets/
   
   # Copy class indices
   cp models/class_indices.json \
      ../../mobile/krishiai-app/android/app/src/main/assets/
   ```

2. **Verify files in mobile app**
   ```bash
   ls ../../mobile/krishiai-app/android/app/src/main/assets/
   # Should see: disease_detector.tflite, class_indices.json
   ```

## Advanced Training Options

### Custom Hyperparameters

```bash
# Train for more epochs
python train.py --epochs 100

# Larger batch size (requires more memory)
python train.py --batch-size 64

# Custom learning rate
python train.py --learning-rate 0.0005

# Combine options
python train.py --epochs 100 --batch-size 64 --learning-rate 0.0005
```

### Resume Training from Checkpoint

If training is interrupted, you can resume from the best checkpoint:

```python
# Modify train.py to load checkpoint
model = keras.models.load_model('checkpoints/model_best_20240115_123456.h5')
# Continue training...
```

### Custom Dataset

To train on your own dataset:

1. Organize images:
   ```
   data/custom_dataset/
   ├── disease_1/
   │   ├── img1.jpg
   │   └── img2.jpg
   ├── disease_2/
   │   └── ...
   └── ...
   ```

2. Update `config.yaml`:
   ```yaml
   dataset:
     data_dir: ./data/custom_dataset
     num_diseases: <number_of_classes>
   ```

3. Train normally:
   ```bash
   python train.py
   ```

## Troubleshooting

### Out of Memory Error

**Problem:** GPU runs out of memory during training

**Solutions:**
```bash
# Reduce batch size
python train.py --batch-size 16

# Or use CPU (slower)
export CUDA_VISIBLE_DEVICES=""
python train.py
```

### Low Accuracy (<90%)

**Problem:** Model doesn't reach target accuracy

**Solutions:**
1. Train for more epochs:
   ```bash
   python train.py --epochs 100
   ```

2. Adjust learning rate:
   ```bash
   python train.py --learning-rate 0.0005
   ```

3. Check dataset quality:
   - Verify images are not corrupted
   - Check class balance
   - Ensure proper labeling

4. Increase data augmentation in `config.yaml`

### Dataset Download Fails

**Problem:** Kaggle API authentication fails

**Solutions:**
1. Verify kaggle.json is in correct location
2. Check file permissions: `chmod 600 ~/.kaggle/kaggle.json`
3. Download manually from Kaggle website
4. Extract to `data/plantvillage/`

### TFLite Model Too Large

**Problem:** Converted model exceeds 15MB

**Solutions:**
1. Ensure quantization is enabled (default)
2. Use more aggressive quantization:
   ```python
   # In convert_to_tflite.py
   converter.optimizations = [tf.lite.Optimize.DEFAULT]
   converter.target_spec.supported_types = [tf.int8]
   ```

3. Reduce model complexity:
   - Fewer neurons in classification head
   - Remove one Dense layer

### Slow Training

**Problem:** Training takes too long

**Solutions:**
1. Use GPU instead of CPU
2. Increase batch size (if memory allows):
   ```bash
   python train.py --batch-size 64
   ```
3. Reduce number of epochs for initial testing:
   ```bash
   python train.py --epochs 10
   ```

## Performance Optimization Tips

### GPU Utilization

1. **Check GPU usage:**
   ```bash
   # Monitor GPU in real-time
   watch -n 1 nvidia-smi
   ```

2. **Maximize GPU usage:**
   - Increase batch size until memory is ~90% full
   - Use mixed precision training (add to train.py)
   - Enable XLA compilation

### Training Speed

1. **Use SSD for dataset storage**
   - Faster data loading
   - Reduces I/O bottleneck

2. **Increase number of workers**
   - Modify `train.py` to use more CPU cores for data loading

3. **Cache preprocessed data**
   - Preprocess images once and save
   - Load preprocessed data during training

## Validation Checklist

Before deploying the model, verify:

- [ ] Validation accuracy ≥ 90%
- [ ] Top-3 accuracy ≥ 95%
- [ ] TFLite model size ≤ 15MB
- [ ] Inference time ≤ 2 seconds (on target device)
- [ ] Model tested on sample images
- [ ] Class indices file generated
- [ ] Training history saved
- [ ] Evaluation report reviewed
- [ ] Files copied to mobile app

## Next Steps

After successful training:

1. **Test in mobile app**
   - Build and run mobile app
   - Test disease detection feature
   - Verify inference speed and accuracy

2. **Collect feedback**
   - Test with real plant images
   - Gather user feedback
   - Identify misclassifications

3. **Iterate and improve**
   - Collect more training data for weak classes
   - Retrain with improved dataset
   - Fine-tune hyperparameters

## Resources

- **PlantVillage Dataset:** https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset
- **MobileNetV3 Paper:** https://arxiv.org/abs/1905.02244
- **TensorFlow Lite Guide:** https://www.tensorflow.org/lite/guide
- **Transfer Learning Tutorial:** https://www.tensorflow.org/tutorials/images/transfer_learning

## Support

For issues or questions:
- Check README.md for common solutions
- Review training logs in `logs/` directory
- Check TensorBoard for training metrics
- Create an issue in the repository with:
  - Error message
  - Training configuration
  - System specifications
  - Training logs
