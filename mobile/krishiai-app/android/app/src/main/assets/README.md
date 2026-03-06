# TensorFlow Lite Model Assets

This directory contains the TensorFlow Lite models used by the KrishiAI mobile app.

## Required Files

### disease_detector.tflite
The disease detection model converted from the trained MobileNetV3 model.

**Source**: `ml-models/disease-detector/models/disease_detector.tflite`

**To copy the model**:
```bash
# From the project root
cp ml-models/disease-detector/models/disease_detector.tflite mobile/krishiai-app/android/app/src/main/assets/
```

**Model Specifications**:
- Input: 224x224x3 RGB image
- Output: 120 disease classes
- Size: <15MB (quantized)
- Format: TensorFlow Lite (float16 quantization)

### class_indices.json
Mapping of model output indices to disease names.

**Source**: Generated during model training

**Format**:
```json
{
  "0": "Apple___Apple_scab",
  "1": "Apple___Black_rot",
  "2": "Apple___Cedar_apple_rust",
  ...
}
```

## Model Updates

Models can be updated via OTA (Over-The-Air) updates. See the OTA Update Guide in `ml-models/disease-detector/OTA_UPDATE_GUIDE.md` for details.

## Note

The actual model files are not committed to version control due to their size. They must be copied from the `ml-models/disease-detector/models/` directory after training.
