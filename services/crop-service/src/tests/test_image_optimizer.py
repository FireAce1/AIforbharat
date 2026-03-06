"""
Tests for Image Optimization Service

Tests image resizing, WebP conversion, validation, and thumbnail creation.
"""

import io
import pytest
from PIL import Image
from src.services.image_optimizer import (
    ImageOptimizer,
    ImageOptimizationError,
    optimize_image,
    create_thumbnail,
    validate_image,
    get_image_optimizer
)


@pytest.fixture
def sample_image_bytes():
    """Create a sample test image"""
    img = Image.new('RGB', (1200, 900), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=95)
    return buffer.getvalue()


@pytest.fixture
def small_image_bytes():
    """Create a small test image (already within limits)"""
    img = Image.new('RGB', (600, 400), color='blue')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=95)
    return buffer.getvalue()


@pytest.fixture
def large_image_bytes():
    """Create a large test image"""
    img = Image.new('RGB', (3000, 2000), color='green')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=95)
    return buffer.getvalue()


@pytest.fixture
def png_image_bytes():
    """Create a PNG test image"""
    img = Image.new('RGBA', (1000, 800), color=(255, 0, 0, 128))
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()


@pytest.fixture
def optimizer():
    """Create an ImageOptimizer instance"""
    return ImageOptimizer()


class TestImageOptimizer:
    """Test ImageOptimizer class"""
    
    def test_initialization(self):
        """Test optimizer initialization with custom parameters"""
        optimizer = ImageOptimizer(
            max_width=1024,
            max_height=768,
            quality=85,
            max_size_mb=5
        )
        
        assert optimizer.max_width == 1024
        assert optimizer.max_height == 768
        assert optimizer.quality == 85
        assert optimizer.max_size_mb == 5
    
    def test_validate_image_success(self, optimizer, sample_image_bytes):
        """Test successful image validation"""
        is_valid, error = optimizer.validate_image(sample_image_bytes)
        
        assert is_valid is True
        assert error is None
    
    def test_validate_image_too_large(self, optimizer):
        """Test validation fails for oversized images"""
        # Create a very large image (> 10MB) by creating raw uncompressed data
        # BMP format stores uncompressed data
        img = Image.new('RGB', (3000, 3000), color='red')
        buffer = io.BytesIO()
        img.save(buffer, format='BMP')  # BMP is uncompressed
        large_data = buffer.getvalue()
        
        # Verify it's actually > 10MB
        size_mb = len(large_data) / (1024 * 1024)
        
        # If BMP isn't large enough, skip this test
        if size_mb <= 10:
            pytest.skip(f"Could not create image > 10MB (got {size_mb:.2f}MB)")
        
        is_valid, error = optimizer.validate_image(large_data)
        
        assert is_valid is False
        assert 'too large' in error.lower()
    
    def test_validate_image_invalid_data(self, optimizer):
        """Test validation fails for invalid image data"""
        invalid_data = b'not an image'
        
        is_valid, error = optimizer.validate_image(invalid_data)
        
        assert is_valid is False
        assert 'invalid' in error.lower()
    
    def test_validate_image_too_small(self, optimizer):
        """Test validation fails for images that are too small"""
        img = Image.new('RGB', (50, 50), color='red')
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        small_data = buffer.getvalue()
        
        is_valid, error = optimizer.validate_image(small_data)
        
        assert is_valid is False
        assert 'too small' in error.lower()
    
    def test_calculate_resize_dimensions_landscape(self, optimizer):
        """Test dimension calculation for landscape images"""
        new_width, new_height = optimizer.calculate_resize_dimensions(1200, 900)
        
        assert new_width == 800
        assert new_height == 600
        assert new_width / new_height == pytest.approx(1200 / 900)
    
    def test_calculate_resize_dimensions_portrait(self, optimizer):
        """Test dimension calculation for portrait images"""
        new_width, new_height = optimizer.calculate_resize_dimensions(900, 1200)
        
        assert new_width == 600
        assert new_height == 800
        assert new_width / new_height == pytest.approx(900 / 1200)
    
    def test_calculate_resize_dimensions_no_upscale(self, optimizer):
        """Test that small images are not upscaled"""
        new_width, new_height = optimizer.calculate_resize_dimensions(600, 400)
        
        assert new_width == 600
        assert new_height == 400
    
    def test_optimize_image_resize_and_convert(self, optimizer, sample_image_bytes):
        """Test image optimization: resize and convert to WebP"""
        optimized_data, metadata = optimizer.optimize_image(sample_image_bytes)
        
        # Verify optimized data
        assert len(optimized_data) > 0
        assert len(optimized_data) < len(sample_image_bytes)
        
        # Verify it's a valid WebP image
        img = Image.open(io.BytesIO(optimized_data))
        assert img.format == 'WEBP'
        assert img.width == 800
        assert img.height == 600
        
        # Verify metadata
        assert metadata['original_format'] == 'JPEG'
        assert metadata['original_width'] == 1200
        assert metadata['original_height'] == 900
        assert metadata['optimized_format'] == 'WEBP'
        assert metadata['optimized_width'] == 800
        assert metadata['optimized_height'] == 600
        assert metadata['compression_ratio'] > 0
        assert metadata['quality'] == 80
    
    def test_optimize_image_no_resize_needed(self, optimizer, small_image_bytes):
        """Test optimization when image is already within limits"""
        optimized_data, metadata = optimizer.optimize_image(small_image_bytes)
        
        # Verify dimensions unchanged
        img = Image.open(io.BytesIO(optimized_data))
        assert img.width == 600
        assert img.height == 400
        
        # Verify format converted
        assert img.format == 'WEBP'
        assert metadata['optimized_format'] == 'WEBP'
    
    def test_optimize_image_jpeg_output(self, optimizer, sample_image_bytes):
        """Test optimization with JPEG output format"""
        optimized_data, metadata = optimizer.optimize_image(
            sample_image_bytes,
            output_format='JPEG'
        )
        
        # Verify it's a valid JPEG image
        img = Image.open(io.BytesIO(optimized_data))
        assert img.format == 'JPEG'
        assert metadata['optimized_format'] == 'JPEG'
    
    def test_optimize_image_png_to_webp(self, optimizer, png_image_bytes):
        """Test PNG to WebP conversion"""
        optimized_data, metadata = optimizer.optimize_image(png_image_bytes)
        
        # Verify conversion
        img = Image.open(io.BytesIO(optimized_data))
        assert img.format == 'WEBP'
        assert metadata['original_format'] == 'PNG'
        assert metadata['optimized_format'] == 'WEBP'
    
    def test_optimize_image_invalid_format(self, optimizer, sample_image_bytes):
        """Test optimization fails with invalid output format"""
        with pytest.raises(ImageOptimizationError) as exc_info:
            optimizer.optimize_image(sample_image_bytes, output_format='BMP')
        
        assert 'unsupported output format' in str(exc_info.value).lower()
    
    def test_optimize_image_invalid_input(self, optimizer):
        """Test optimization fails with invalid input"""
        with pytest.raises(ImageOptimizationError):
            optimizer.optimize_image(b'not an image')
    
    def test_create_thumbnail(self, optimizer, sample_image_bytes):
        """Test thumbnail creation"""
        thumbnail_data = optimizer.create_thumbnail(sample_image_bytes)
        
        # Verify thumbnail
        assert len(thumbnail_data) > 0
        assert len(thumbnail_data) < len(sample_image_bytes)
        
        img = Image.open(io.BytesIO(thumbnail_data))
        assert img.format == 'WEBP'
        assert img.width <= 200
        assert img.height <= 200
    
    def test_create_thumbnail_maintains_aspect_ratio(self, optimizer, sample_image_bytes):
        """Test thumbnail maintains aspect ratio"""
        thumbnail_data = optimizer.create_thumbnail(sample_image_bytes)
        
        img = Image.open(io.BytesIO(thumbnail_data))
        aspect_ratio = img.width / img.height
        
        # Original is 1200x900 = 4:3 ratio
        assert aspect_ratio == pytest.approx(4/3, rel=0.01)
    
    def test_create_thumbnail_custom_size(self, optimizer, sample_image_bytes):
        """Test thumbnail with custom size"""
        thumbnail_data = optimizer.create_thumbnail(
            sample_image_bytes,
            thumbnail_size=(100, 100)
        )
        
        img = Image.open(io.BytesIO(thumbnail_data))
        assert img.width <= 100
        assert img.height <= 100
    
    def test_optimize_batch_success(self, optimizer, sample_image_bytes, small_image_bytes):
        """Test batch optimization"""
        images = [sample_image_bytes, small_image_bytes]
        results = optimizer.optimize_batch(images)
        
        assert len(results) == 2
        
        # Check first result
        optimized1, metadata1 = results[0]
        assert optimized1 is not None
        assert metadata1['optimized_format'] == 'WEBP'
        
        # Check second result
        optimized2, metadata2 = results[1]
        assert optimized2 is not None
        assert metadata2['optimized_format'] == 'WEBP'
    
    def test_optimize_batch_with_errors(self, optimizer, sample_image_bytes):
        """Test batch optimization handles errors gracefully"""
        images = [sample_image_bytes, b'invalid', sample_image_bytes]
        results = optimizer.optimize_batch(images)
        
        assert len(results) == 3
        
        # First should succeed
        assert results[0][0] is not None
        
        # Second should fail
        assert results[1][0] is None
        assert 'error' in results[1][1]
        
        # Third should succeed
        assert results[2][0] is not None


class TestConvenienceFunctions:
    """Test convenience functions"""
    
    def test_get_image_optimizer_singleton(self):
        """Test singleton pattern"""
        optimizer1 = get_image_optimizer()
        optimizer2 = get_image_optimizer()
        
        assert optimizer1 is optimizer2
    
    def test_optimize_image_function(self, sample_image_bytes):
        """Test optimize_image convenience function"""
        optimized_data, metadata = optimize_image(sample_image_bytes)
        
        assert len(optimized_data) > 0
        assert metadata['optimized_format'] == 'WEBP'
    
    def test_create_thumbnail_function(self, sample_image_bytes):
        """Test create_thumbnail convenience function"""
        thumbnail_data = create_thumbnail(sample_image_bytes)
        
        assert len(thumbnail_data) > 0
        
        img = Image.open(io.BytesIO(thumbnail_data))
        assert img.format == 'WEBP'
        assert img.width <= 200
    
    def test_validate_image_function(self, sample_image_bytes):
        """Test validate_image convenience function"""
        is_valid, error = validate_image(sample_image_bytes)
        
        assert is_valid is True
        assert error is None


class TestCompressionRatio:
    """Test compression effectiveness"""
    
    def test_compression_reduces_size(self, optimizer, large_image_bytes):
        """Test that optimization significantly reduces file size"""
        optimized_data, metadata = optimizer.optimize_image(large_image_bytes)
        
        original_size = metadata['original_size']
        optimized_size = metadata['optimized_size']
        compression_ratio = metadata['compression_ratio']
        
        assert optimized_size < original_size
        assert compression_ratio > 50  # At least 50% reduction
    
    def test_webp_better_than_jpeg(self, optimizer, sample_image_bytes):
        """Test that WebP provides better compression than JPEG"""
        webp_data, webp_meta = optimizer.optimize_image(
            sample_image_bytes,
            output_format='WEBP'
        )
        jpeg_data, jpeg_meta = optimizer.optimize_image(
            sample_image_bytes,
            output_format='JPEG'
        )
        
        # WebP should be smaller or similar size
        assert len(webp_data) <= len(jpeg_data) * 1.1  # Allow 10% margin


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_square_image(self, optimizer):
        """Test optimization of square images"""
        img = Image.new('RGB', (1000, 1000), color='red')
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        square_data = buffer.getvalue()
        
        optimized_data, metadata = optimizer.optimize_image(square_data)
        
        img_out = Image.open(io.BytesIO(optimized_data))
        assert img_out.width == 800
        assert img_out.height == 800
    
    def test_very_wide_image(self, optimizer):
        """Test optimization of very wide images"""
        img = Image.new('RGB', (2000, 500), color='red')
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        wide_data = buffer.getvalue()
        
        optimized_data, metadata = optimizer.optimize_image(wide_data)
        
        img_out = Image.open(io.BytesIO(optimized_data))
        assert img_out.width == 800
        assert img_out.height == 200
    
    def test_grayscale_image(self, optimizer):
        """Test optimization of grayscale images"""
        img = Image.new('L', (1200, 900), color=128)
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        gray_data = buffer.getvalue()
        
        optimized_data, metadata = optimizer.optimize_image(gray_data)
        
        # Should convert to RGB
        img_out = Image.open(io.BytesIO(optimized_data))
        assert img_out.format == 'WEBP'
        assert img_out.mode in ('RGB', 'RGBA')
    
    def test_empty_batch(self, optimizer):
        """Test batch optimization with empty list"""
        results = optimizer.optimize_batch([])
        
        assert len(results) == 0


class TestPerformance:
    """Test performance characteristics"""
    
    def test_optimization_speed(self, optimizer, sample_image_bytes):
        """Test that optimization completes quickly"""
        import time
        
        start = time.time()
        optimizer.optimize_image(sample_image_bytes)
        duration = time.time() - start
        
        # Should complete in under 1 second
        assert duration < 1.0
    
    def test_batch_optimization_speed(self, optimizer, sample_image_bytes):
        """Test batch optimization performance"""
        import time
        
        images = [sample_image_bytes] * 5
        
        start = time.time()
        optimizer.optimize_batch(images)
        duration = time.time() - start
        
        # Should complete in under 5 seconds for 5 images
        assert duration < 5.0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
