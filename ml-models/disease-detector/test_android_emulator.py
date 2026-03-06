"""
Test TFLite model inference speed on Android emulator.
This script simulates Android device performance characteristics.
"""
import argparse
import yaml
import time
import numpy as np
import tensorflow as tf
from pathlib import Path
import json

def load_config():
    """Load configuration from config.yaml"""
    with open('config.yaml', 'r') as f:
        return yaml.safe_load(f)

def simulate_android_performance(num_threads=2):
    """
    Simulate Android device performance by limiting threads.
    Low-end Android devices (2GB RAM) typically have 4-8 cores but limited performance.
    """
    tf.config.threading.set_inter_op_parallelism_threads(num_threads)
    tf.config.threading.set_intra_op_parallelism_threads(num_threads)

def test_inference_speed(tflite_path, config, num_iterations=100):
    """Test inference speed with multiple iterations"""
    print(f"\nTesting inference speed on simulated Android device...")
    print(f"Model: {tflite_path}")
    print(f"Iterations: {num_iterations}")
    print(f"Target: <2000ms per inference")
    print("-" * 60)
    
    # Load TFLite model
    interpreter = tf.lite.Interpreter(
        model_path=str(tflite_path),
        num_threads=2  # Simulate low-end device
    )
    interpreter.allocate_tensors()
    
    # Get input and output details
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    input_shape = input_details[0]['shape']
    print(f"Input shape: {input_shape}")
    print(f"Input dtype: {input_details[0]['dtype']}")
    
    # Warm-up runs (first few inferences are slower)
    print("\nPerforming warm-up runs...")
    for _ in range(5):
        test_input = np.random.rand(*input_shape).astype(np.float32)
        interpreter.set_tensor(input_details[0]['index'], test_input)
        interpreter.invoke()
    
    # Actual timing runs
    print(f"\nRunning {num_iterations} inference iterations...")
    inference_times = []
    
    for i in range(num_iterations):
        # Create random test input
        test_input = np.random.rand(*input_shape).astype(np.float32)
        
        # Measure inference time
        start_time = time.time()
        interpreter.set_tensor(input_details[0]['index'], test_input)
        interpreter.invoke()
        output_data = interpreter.get_tensor(output_details[0]['index'])
        end_time = time.time()
        
        inference_time_ms = (end_time - start_time) * 1000
        inference_times.append(inference_time_ms)
        
        if (i + 1) % 10 == 0:
            print(f"  Completed {i + 1}/{num_iterations} iterations...")
    
    # Calculate statistics
    inference_times = np.array(inference_times)
    mean_time = np.mean(inference_times)
    median_time = np.median(inference_times)
    min_time = np.min(inference_times)
    max_time = np.max(inference_times)
    p95_time = np.percentile(inference_times, 95)
    p99_time = np.percentile(inference_times, 99)
    std_time = np.std(inference_times)
    
    print("\n" + "=" * 60)
    print("Inference Speed Results (Simulated Android Device)")
    print("=" * 60)
    print(f"Mean:       {mean_time:.2f} ms")
    print(f"Median:     {median_time:.2f} ms")
    print(f"Min:        {min_time:.2f} ms")
    print(f"Max:        {max_time:.2f} ms")
    print(f"P95:        {p95_time:.2f} ms")
    print(f"P99:        {p99_time:.2f} ms")
    print(f"Std Dev:    {std_time:.2f} ms")
    print("=" * 60)
    
    # Check if target is met
    target_time = 2000  # 2 seconds
    
    if p95_time <= target_time:
        print(f"\n✓ Target inference time achieved!")
        print(f"  P95: {p95_time:.2f} ms <= {target_time} ms")
    else:
        print(f"\n✗ Target inference time NOT met!")
        print(f"  P95: {p95_time:.2f} ms > {target_time} ms")
        print("\nRecommendations:")
        print("  - Use more aggressive quantization (int8)")
        print("  - Reduce model complexity")
        print("  - Optimize model architecture")
    
    # Performance rating
    if mean_time < 500:
        rating = "Excellent"
    elif mean_time < 1000:
        rating = "Good"
    elif mean_time < 2000:
        rating = "Acceptable"
    else:
        rating = "Poor"
    
    print(f"\nPerformance Rating: {rating}")
    
    return {
        'mean': mean_time,
        'median': median_time,
        'min': min_time,
        'max': max_time,
        'p95': p95_time,
        'p99': p99_time,
        'std': std_time,
        'target_met': p95_time <= target_time,
        'rating': rating
    }

def test_memory_usage(tflite_path):
    """Estimate memory usage of TFLite model"""
    print("\nEstimating memory usage...")
    
    # Model file size
    model_size_bytes = Path(tflite_path).stat().st_size
    model_size_mb = model_size_bytes / (1024 * 1024)
    
    # Load model and check tensor sizes
    interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
    interpreter.allocate_tensors()
    
    # Calculate total tensor memory
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    input_size = np.prod(input_details[0]['shape']) * 4  # float32 = 4 bytes
    output_size = np.prod(output_details[0]['shape']) * 4
    
    total_tensor_mb = (input_size + output_size) / (1024 * 1024)
    
    # Estimate total memory (model + tensors + overhead)
    estimated_total_mb = model_size_mb + total_tensor_mb + 5  # 5MB overhead
    
    print(f"Model file size:        {model_size_mb:.2f} MB")
    print(f"Input tensor size:      {input_size / (1024 * 1024):.2f} MB")
    print(f"Output tensor size:     {output_size / (1024 * 1024):.2f} MB")
    print(f"Estimated total memory: {estimated_total_mb:.2f} MB")
    
    # Check if suitable for 2GB RAM device
    if estimated_total_mb < 50:
        print(f"\n✓ Memory usage acceptable for 2GB RAM devices")
    else:
        print(f"\n⚠ Memory usage may be high for 2GB RAM devices")
    
    return {
        'model_size_mb': model_size_mb,
        'input_tensor_mb': input_size / (1024 * 1024),
        'output_tensor_mb': output_size / (1024 * 1024),
        'estimated_total_mb': estimated_total_mb
    }

def main():
    """Main testing function"""
    parser = argparse.ArgumentParser(
        description='Test TFLite model on simulated Android device'
    )
    parser.add_argument(
        '--model-path',
        type=str,
        default='models/disease_detector.tflite',
        help='Path to TFLite model'
    )
    parser.add_argument(
        '--iterations',
        type=int,
        default=100,
        help='Number of inference iterations'
    )
    parser.add_argument(
        '--save-results',
        action='store_true',
        help='Save results to JSON file'
    )
    args = parser.parse_args()
    
    config = load_config()
    
    print("=" * 60)
    print("Android Emulator Performance Test")
    print("=" * 60)
    print(f"Model: {args.model_path}")
    print(f"Simulating: Low-end Android device (2GB RAM, 4 cores)")
    print("=" * 60)
    
    # Simulate Android device performance
    simulate_android_performance(num_threads=2)
    
    # Test inference speed
    speed_results = test_inference_speed(
        args.model_path,
        config,
        num_iterations=args.iterations
    )
    
    # Test memory usage
    memory_results = test_memory_usage(args.model_path)
    
    # Combined results
    results = {
        'model_path': args.model_path,
        'test_date': time.strftime('%Y-%m-%d %H:%M:%S'),
        'device_simulation': {
            'ram': '2GB',
            'cores': 4,
            'threads': 2
        },
        'inference_speed': speed_results,
        'memory_usage': memory_results
    }
    
    # Save results if requested
    if args.save_results:
        results_path = Path(config['paths']['models_dir']) / 'android_test_results.json'
        with open(results_path, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved to: {results_path}")
    
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print(f"Inference Speed: {speed_results['rating']}")
    print(f"  Mean: {speed_results['mean']:.2f} ms")
    print(f"  P95:  {speed_results['p95']:.2f} ms")
    print(f"  Target Met: {'Yes' if speed_results['target_met'] else 'No'}")
    print(f"\nMemory Usage: {memory_results['estimated_total_mb']:.2f} MB")
    print(f"  Model Size: {memory_results['model_size_mb']:.2f} MB")
    print("=" * 60)
    
    print("\nTest complete!")
    
    if not speed_results['target_met']:
        print("\n⚠ WARNING: Inference speed target not met!")
        print("Consider optimizing the model before deployment.")
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())
