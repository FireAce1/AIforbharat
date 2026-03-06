"""
Standalone test for Image Optimization

Run with: python test_image_optimization.py
"""

import io
import base64
from PIL import Image
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src', 'services'))

# Import directly from the module file
import image_optimizer
ImageOptimizer = image_optimizer.ImageOptimizer
optimize_disease_detection_image = image_optimizer.optimize_disease_detection_image


def create_test_image(width: int, height: int, format: str = 'PNG') -> bytes:
    """Create a test image with specified dimensions."""
    image = Image.new('RGB', (width, height), color='red')
    buffer = io.BytesIO()
    image.save(buffer, format=format)
    return buffer.getvalue()


def test_resize_large_image():
    """Test that large images are resized to max 800x800."""
    print("Test 1: Resize large image (1200x1200 -> 800x800)")
    
    large_image = create_test_image(1200, 1200)
    optimized, metadata = ImageOptimizer.optimize_image(large_image)
    
    assert metadata['original_dimensions'] == (1200, 1200), "Original dimensions incorrect"
    assert max(metadata['optimized_dimensions']) <= 800, "Image not resized properly"
    assert metadata['optimized_format'] == 'WEBP', "Not converted to WebP"
    
    print(f"  ✓ Original: {metadata['original_dimensions']}")
    print(f"  ✓ Optimized: {metadata['optimized_dimensions']}")
    print(f"  ✓ Format: {metadata['optimized_format']}")
    print(f"  ✓ Compression: {metadata['compression_ratio_percent']}%")
    print()


def test_no_resize_small_image():
    """Test that small images are not resized."""
    print("Test 2: Small image not resized (600x400 stays 600x400)")
    
    small_image = create_test_image(600, 400)
    optimized, metadata = ImageOptimizer.optimize_image(small_image)
    
    assert metadata['optimized_dimensions'] == (600, 400), "Small image was resized"
    
    print(f"  ✓ Dimensions maintained: {metadata['optimized_dimensions']}")
    print(f"  ✓ Compression: {metadata['compression_ratio_percent']}%")
    print()


def test_webp_conversion():
    """Test conversion to WebP format."""
    print("Test 3: PNG to WebP conversion")
    
    png_image = create_test_image(500, 500, format='PNG')
    optimized, metadata = ImageOptimizer.optimize_image(png_image)
    
    assert metadata['original_format'] == 'PNG', "Original format incorrect"
    assert metadata['optimized_format'] == 'WEBP', "Not converted to WebP"
    
    # Verify it's a valid WebP image
    optimized_image = Image.open(io.BytesIO(optimized))
    assert optimized_image.format == 'WEBP', "Output is not valid WebP"
    
    print(f"  ✓ Converted: {metadata['original_format']} -> {metadata['optimized_format']}")
    print(f"  ✓ Size reduction: {metadata['original_size_bytes']} -> {metadata['optimized_size_bytes']} bytes")
    print()


def test_compression():
    """Test that images are compressed."""
    print("Test 4: Image compression")
    
    large_image = create_test_image(1000, 1000)
    optimized, metadata = ImageOptimizer.optimize_image(large_image)
    
    assert metadata['optimized_size_bytes'] < metadata['original_size_bytes'], "No compression"
    assert metadata['compression_ratio_percent'] > 0, "Compression ratio is 0"
    
    print(f"  ✓ Original size: {metadata['original_size_bytes']} bytes")
    print(f"  ✓ Optimized size: {metadata['optimized_size_bytes']} bytes")
    print(f"  ✓ Saved: {metadata['compression_ratio_percent']}%")
    print()


def test_aspect_ratio():
    """Test that aspect ratio is maintained."""
    print("Test 5: Aspect ratio preservation (1600x800 -> 800x400)")
    
    wide_image = create_test_image(1600, 800)
    optimized, metadata = ImageOptimizer.optimize_image(wide_image)
    
    orig_ratio = metadata['original_dimensions'][0] / metadata['original_dimensions'][1]
    opt_ratio = metadata['optimized_dimensions'][0] / metadata['optimized_dimensions'][1]
    
    assert abs(orig_ratio - opt_ratio) < 0.01, "Aspect ratio not maintained"
    
    print(f"  ✓ Original: {metadata['original_dimensions']} (ratio: {orig_ratio:.2f})")
    print(f"  ✓ Optimized: {metadata['optimized_dimensions']} (ratio: {opt_ratio:.2f})")
    print()


def test_base64_optimization():
    """Test base64 image optimization."""
    print("Test 6: Base64 image optimization")
    
    image_bytes = create_test_image(1000, 1000)
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    
    optimized_base64, metadata = ImageOptimizer.optimize_base64_image(base64_image)
    
    assert isinstance(optimized_base64, str), "Output is not string"
    assert len(optimized_base64) > 0, "Empty output"
    
    # Verify it's valid base64
    decoded = base64.b64decode(optimized_base64)
    assert len(decoded) > 0, "Invalid base64"
    
    print(f"  ✓ Input length: {len(base64_image)} chars")
    print(f"  ✓ Output length: {len(optimized_base64)} chars")
    print(f"  ✓ Compression: {metadata['compression_ratio_percent']}%")
    print()


def test_thumbnail_creation():
    """Test thumbnail creation."""
    print("Test 7: Thumbnail creation (1000x1000 -> 200x200)")
    
    large_image = create_test_image(1000, 1000)
    thumbnail = ImageOptimizer.create_thumbnail(large_image, size=(200, 200))
    
    thumb_image = Image.open(io.BytesIO(thumbnail))
    assert max(thumb_image.size) <= 200, "Thumbnail too large"
    assert thumb_image.format == 'WEBP', "Thumbnail not WebP"
    
    print(f"  ✓ Thumbnail size: {thumb_image.size}")
    print(f"  ✓ Format: {thumb_image.format}")
    print(f"  ✓ File size: {len(thumbnail)} bytes")
    print()


def test_disease_detection_optimization():
    """Test disease detection image optimization."""
    print("Test 8: Disease detection optimization")
    
    image_bytes = create_test_image(1200, 1200)
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    
    optimized, metadata = optimize_disease_detection_image(base64_image)
    
    assert max(metadata['optimized_dimensions']) <= 800, "Not resized to 800"
    assert metadata['quality'] == 80, "Quality not 80%"
    assert metadata['optimized_format'] == 'WEBP', "Not WebP"
    
    print(f"  ✓ Optimized to: {metadata['optimized_dimensions']}")
    print(f"  ✓ Quality: {metadata['quality']}%")
    print(f"  ✓ Compression: {metadata['compression_ratio_percent']}%")
    print()


def test_image_validation():
    """Test image validation."""
    print("Test 9: Image validation")
    
    valid_image = create_test_image(800, 800)
    assert ImageOptimizer.validate_image(valid_image) is True, "Valid image rejected"
    
    invalid_data = b"not an image"
    assert ImageOptimizer.validate_image(invalid_data) is False, "Invalid data accepted"
    
    print("  ✓ Valid image accepted")
    print("  ✓ Invalid data rejected")
    print()


def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("Image Optimization Tests")
    print("=" * 60)
    print()
    
    tests = [
        test_resize_large_image,
        test_no_resize_small_image,
        test_webp_conversion,
        test_compression,
        test_aspect_ratio,
        test_base64_optimization,
        test_thumbnail_creation,
        test_disease_detection_optimization,
        test_image_validation,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"  ✗ FAILED: {e}")
            print()
            failed += 1
        except Exception as e:
            print(f"  ✗ ERROR: {e}")
            print()
            failed += 1
    
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return failed == 0


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
