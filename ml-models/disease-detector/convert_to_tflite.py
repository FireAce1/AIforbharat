"""
Convert trained Keras model to TensorFlow Lite format for mobile deployment.
Includes model versioning and OTA update preparation.
"""
import argparse
import yaml
import os
import json
import hashlib
from pathlib import Path
from datetime import datetime
import tensorflow as tf
from tensorflow import keras
import numpy as np
from tensorflow.keras.preprocessing.image import ImageDataGenerator

def load_config():
    """Load configuration from config.yaml"""
    with open('config.yaml', 'r') as f:
        return yaml.safe_load(f)

def calculate_model_hash(model_path):
    """Calculate SHA256 hash of model file for versioning"""
    sha256_hash = hashlib.sha256()
    with open(model_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def create_model_metadata(model_path, model_size, config, accuracy=None):
    """Create metadata for model versioning and OTA updates"""
    model_hash = calculate_model_hash(model_path)
    
    # Generate version number (format: YYYYMMDD.HHMM)
    version = datetime.now().strftime('%Y%m%d.%H%M')
    
    metadata = {
        'version': version,
        'created_at': datetime.now().isoformat(),
        'model_hash': model_hash,
        'model_size_mb': round(model_size, 2),
        'model_type': 'disease_detector',
        'framework': 'tensorflow_lite',
        'input_shape': config['model']['input_shape'],
        'num_classes': config['model']['num_classes'],
        'quantization': 'float16',
        'target_platform': 'android',
        'min_android_version': 26,
        'accuracy': accuracy if accuracy else 'not_measured'
    }
    
    return metadata, version

def convert_to_tflite(model_path, config, quantize=True):
    """Convert Keras model to TensorFlow Lite"""
    print(f"Loading model from: {model_path}")
    model = keras.models.load_model(model_path)
    
    # Convert to TensorFlow Lite
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    
    if quantize:
        print("Applying post-training quantization...")
        # Enable optimizations
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        
        # Optional: Use float16 quantization for better accuracy
        converter.target_spec.supported_types = [tf.float16]
    
    print("Converting model...")
    tflite_model = converter.convert()
    
    # Save TFLite model
    tflite_path = Path(config['paths']['models_dir']) / 'disease_detector.tflite'
    with open(tflite_path, 'wb') as f:
        f.write(tflite_model)
    
    # Get model size
    model_size_mb = len(tflite_model) / (1024 * 1024)
    print(f"\nTFLite model saved to: {tflite_path}")
    print(f"Model size: {model_size_mb:.2f} MB")
    
    # Check if size target is met
    target_size = config['tflite']['target_size_mb']
    if model_size_mb <= target_size:
        print(f"✓ Target size achieved: {model_size_mb:.2f} MB <= {target_size} MB")
    else:
        print(f"✗ Target size exceeded: {model_size_mb:.2f} MB > {target_size} MB")
        print("Consider using more aggressive quantization.")
    
    return tflite_path, model_size_mb

def test_tflite_model(tflite_path, config):
    """Test TFLite model inference"""
    print("\nTesting TFLite model inference...")
    
    # Load TFLite model
    interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
    interpreter.allocate_tensors()
    
    # Get input and output details
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    print(f"Input shape: {input_details[0]['shape']}")
    print(f"Input dtype: {input_details[0]['dtype']}")
    print(f"Output shape: {output_details[0]['shape']}")
    print(f"Output dtype: {output_details[0]['dtype']}")
    
    # Create random test input
    input_shape = input_details[0]['shape']
    test_input = np.random.rand(*input_shape).astype(np.float32)
    
    # Run inference
    interpreter.set_tensor(input_details[0]['index'], test_input)
    
    import time
    start_time = time.time()
    interpreter.invoke()
    inference_time = (time.time() - start_time) * 1000  # Convert to ms
    
    output_data = interpreter.get_tensor(output_details[0]['index'])
    
    print(f"\nInference time: {inference_time:.2f} ms")
    print(f"Output shape: {output_data.shape}")
    print(f"Top prediction confidence: {np.max(output_data):.4f}")
    
    # Check if inference time target is met (2 seconds = 2000 ms)
    if inference_time <= 2000:
        print(f"✓ Target inference time achieved: {inference_time:.2f} ms <= 2000 ms")
    else:
        print(f"✗ Target inference time exceeded: {inference_time:.2f} ms > 2000 ms")
    
    return inference_time

def verify_accuracy_on_validation_set(original_model_path, tflite_path, config):
    """Verify TFLite model accuracy on validation set"""
    print("\nVerifying accuracy on validation set...")
    
    # Create validation data generator
    val_datagen = ImageDataGenerator(rescale=1./255)
    
    data_dir = Path(config['paths']['data_dir']) / 'plantvillage'
    
    # Find the actual dataset directory
    if not data_dir.exists():
        possible_paths = [
            Path(config['paths']['data_dir']) / 'PlantVillage',
            Path(config['paths']['data_dir']) / 'color',
            Path(config['paths']['data_dir']) / 'plantvillage-dataset'
        ]
        for path in possible_paths:
            if path.exists():
                data_dir = path
                break
    
    if not data_dir.exists():
        print("⚠ Dataset not found. Skipping validation set accuracy check.")
        print("  To verify accuracy, ensure dataset is available and run:")
        print("  python evaluate.py --model-path models/disease_detector.tflite")
        return None, None
    
    # Create validation generator (use 20% split)
    val_datagen_split = ImageDataGenerator(
        rescale=1./255,
        validation_split=config['training']['validation_split']
    )
    
    val_generator = val_datagen_split.flow_from_directory(
        data_dir,
        target_size=tuple(config['model']['input_shape'][:2]),
        batch_size=32,
        class_mode='categorical',
        subset='validation',
        shuffle=False
    )
    
    print(f"Validation samples: {val_generator.samples}")
    
    # Load original model
    print("Evaluating original model...")
    original_model = keras.models.load_model(original_model_path)
    original_results = original_model.evaluate(val_generator, verbose=0)
    original_accuracy = original_results[1]
    
    print(f"Original model accuracy: {original_accuracy:.4f} ({original_accuracy*100:.2f}%)")
    
    # Evaluate TFLite model
    print("Evaluating TFLite model...")
    interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    # Get predictions
    correct = 0
    total = 0
    
    val_generator.reset()
    for i in range(len(val_generator)):
        batch_images, batch_labels = val_generator[i]
        
        for img, label in zip(batch_images, batch_labels):
            interpreter.set_tensor(input_details[0]['index'], img[np.newaxis, ...])
            interpreter.invoke()
            output = interpreter.get_tensor(output_details[0]['index'])
            
            predicted_class = np.argmax(output[0])
            true_class = np.argmax(label)
            
            if predicted_class == true_class:
                correct += 1
            total += 1
    
    tflite_accuracy = correct / total
    accuracy_drop = original_accuracy - tflite_accuracy
    
    print(f"TFLite model accuracy: {tflite_accuracy:.4f} ({tflite_accuracy*100:.2f}%)")
    print(f"Accuracy drop: {accuracy_drop:.4f} ({accuracy_drop*100:.2f}%)")
    
    # Check if accuracy target is met (>90%)
    if tflite_accuracy >= 0.90:
        print(f"✓ Target accuracy achieved: {tflite_accuracy*100:.2f}% >= 90%")
    else:
        print(f"✗ Target accuracy not met: {tflite_accuracy*100:.2f}% < 90%")
        print("Consider using less aggressive quantization or retraining.")
    
    return original_accuracy, tflite_accuracy

def compare_models(original_model_path, tflite_path, config):
    """Compare original and TFLite model outputs"""
    print("\nComparing original and TFLite model outputs...")
    
    # Load original model
    original_model = keras.models.load_model(original_model_path)
    
    # Load TFLite model
    interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    # Create test inputs
    num_tests = 10
    input_shape = tuple(config['model']['input_shape'])
    test_inputs = np.random.rand(num_tests, *input_shape).astype(np.float32)
    
    # Get predictions from both models
    original_predictions = original_model.predict(test_inputs, verbose=0)
    
    tflite_predictions = []
    for test_input in test_inputs:
        interpreter.set_tensor(input_details[0]['index'], test_input[np.newaxis, ...])
        interpreter.invoke()
        output = interpreter.get_tensor(output_details[0]['index'])
        tflite_predictions.append(output[0])
    
    tflite_predictions = np.array(tflite_predictions)
    
    # Calculate difference
    max_diff = np.max(np.abs(original_predictions - tflite_predictions))
    mean_diff = np.mean(np.abs(original_predictions - tflite_predictions))
    
    print(f"Maximum difference: {max_diff:.6f}")
    print(f"Mean difference: {mean_diff:.6f}")
    
    # Check if predictions match (within tolerance)
    if max_diff < 0.01:
        print("✓ Model outputs are very similar (max diff < 0.01)")
    elif max_diff < 0.05:
        print("✓ Model outputs are similar (max diff < 0.05)")
    else:
        print("⚠ Model outputs differ significantly (max diff >= 0.05)")
        print("This may be due to quantization. Verify accuracy on validation set.")
    
    return max_diff, mean_diff

def create_ota_package(tflite_path, metadata, config):
    """Create OTA update package with model and manifest"""
    print("\nCreating OTA update package...")
    
    models_dir = Path(config['paths']['models_dir'])
    version = metadata['version']
    
    # Create OTA directory
    ota_dir = models_dir / 'ota' / f'v{version}'
    ota_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy TFLite model to OTA directory
    ota_model_path = ota_dir / 'disease_detector.tflite'
    import shutil
    shutil.copy2(tflite_path, ota_model_path)
    
    # Copy class indices
    class_indices_src = models_dir / 'class_indices.json'
    if class_indices_src.exists():
        class_indices_dst = ota_dir / 'class_indices.json'
        shutil.copy2(class_indices_src, class_indices_dst)
    
    # Create OTA manifest
    manifest = {
        'model_version': version,
        'model_type': 'disease_detector',
        'release_date': datetime.now().isoformat(),
        'model_url': f'https://cdn.krishiai.com/models/disease_detector/v{version}/disease_detector.tflite',
        'class_indices_url': f'https://cdn.krishiai.com/models/disease_detector/v{version}/class_indices.json',
        'model_hash': metadata['model_hash'],
        'model_size_bytes': int(metadata['model_size_mb'] * 1024 * 1024),
        'min_app_version': '1.0.0',
        'required': False,  # Optional update
        'changelog': [
            'Improved disease detection accuracy',
            'Optimized model size for faster downloads',
            'Enhanced support for low-light conditions'
        ],
        'metadata': metadata
    }
    
    manifest_path = ota_dir / 'manifest.json'
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    # Create version registry (tracks all versions)
    registry_path = models_dir / 'ota' / 'version_registry.json'
    
    if registry_path.exists():
        with open(registry_path, 'r') as f:
            registry = json.load(f)
    else:
        registry = {'versions': []}
    
    # Add new version to registry
    version_entry = {
        'version': version,
        'release_date': datetime.now().isoformat(),
        'model_size_mb': metadata['model_size_mb'],
        'accuracy': metadata['accuracy'],
        'manifest_url': f'https://cdn.krishiai.com/models/disease_detector/v{version}/manifest.json'
    }
    
    # Remove existing entry if version exists
    registry['versions'] = [v for v in registry['versions'] if v['version'] != version]
    registry['versions'].append(version_entry)
    
    # Sort by version (newest first)
    registry['versions'].sort(key=lambda x: x['version'], reverse=True)
    
    # Mark latest version
    if registry['versions']:
        registry['latest_version'] = registry['versions'][0]['version']
    
    with open(registry_path, 'w') as f:
        json.dump(registry, f, indent=2)
    
    print(f"OTA package created: {ota_dir}")
    print(f"OTA manifest: {manifest_path}")
    print(f"Version registry updated: {registry_path}")
    
    return {
        'package_path': str(ota_dir),
        'manifest_path': str(manifest_path),
        'registry_path': str(registry_path),
        'version': version
    }

def main():
    """Main conversion function"""
    parser = argparse.ArgumentParser(description='Convert model to TensorFlow Lite')
    parser.add_argument('--model-path', type=str, default='models/disease_detector.h5',
                        help='Path to trained Keras model')
    parser.add_argument('--no-quantize', action='store_true',
                        help='Disable quantization')
    parser.add_argument('--skip-validation', action='store_true',
                        help='Skip validation set accuracy check')
    args = parser.parse_args()
    
    config = load_config()
    
    print("="*60)
    print("TensorFlow Lite Model Conversion")
    print("="*60)
    print(f"Input model: {args.model_path}")
    print(f"Quantization: {'Disabled' if args.no_quantize else 'Enabled'}")
    print(f"Target size: {config['tflite']['target_size_mb']} MB")
    print("="*60)
    
    # Convert model
    tflite_path, model_size = convert_to_tflite(
        args.model_path, 
        config, 
        quantize=not args.no_quantize
    )
    
    # Test inference
    inference_time = test_tflite_model(tflite_path, config)
    
    # Compare models
    max_diff, mean_diff = compare_models(args.model_path, tflite_path, config)
    
    # Verify accuracy on validation set
    original_accuracy = None
    tflite_accuracy = None
    
    if not args.skip_validation:
        original_accuracy, tflite_accuracy = verify_accuracy_on_validation_set(
            args.model_path, tflite_path, config
        )
    
    # Create model metadata for versioning
    metadata, version = create_model_metadata(
        tflite_path, 
        model_size, 
        config,
        accuracy=tflite_accuracy
    )
    
    # Save metadata
    metadata_path = Path(config['paths']['models_dir']) / f'model_metadata_v{version}.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\nModel metadata saved to: {metadata_path}")
    
    # Create OTA update package
    ota_package = create_ota_package(tflite_path, metadata, config)
    
    print("\n" + "="*60)
    print("Conversion Summary")
    print("="*60)
    print(f"TFLite model: {tflite_path}")
    print(f"Model version: {version}")
    print(f"Model size: {model_size:.2f} MB")
    print(f"Inference time: {inference_time:.2f} ms")
    print(f"Max output difference: {max_diff:.6f}")
    print(f"Mean output difference: {mean_diff:.6f}")
    
    if original_accuracy and tflite_accuracy:
        print(f"Original accuracy: {original_accuracy*100:.2f}%")
        print(f"TFLite accuracy: {tflite_accuracy*100:.2f}%")
        print(f"Accuracy drop: {(original_accuracy - tflite_accuracy)*100:.2f}%")
    
    print(f"\nOTA package: {ota_package['package_path']}")
    print(f"OTA manifest: {ota_package['manifest_path']}")
    print("="*60)
    
    print("\nConversion complete!")
    print("\nNext steps:")
    print("1. Copy disease_detector.tflite to mobile/krishiai-app/android/app/src/main/assets/")
    print("2. Copy class_indices.json to mobile app for disease name mapping")
    print("3. Test inference in mobile app")
    print("4. For OTA updates, upload OTA package to CDN and update manifest URL in app")

if __name__ == '__main__':
    main()
