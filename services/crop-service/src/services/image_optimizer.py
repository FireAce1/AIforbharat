"""
Image Optimization Service

Provides server-side image optimization for uploaded plant disease images.

Features:
- Resize images to max 800x800 pixels
- Convert to WebP format with 80% quality
- Compress before storage to reduce storage costs
- Maintain aspect ratio
- Validate image format and size

Requirements: 16.6 (Compatibility - data compression)
Task: 12.3 (Implement image optimization)
"""

import io
import os
from typing import Tuple, Optional
from PIL import Image
import logging

logger = logging.getLogger(__name__)

# Configuration
MAX_WIDTH = 800
MAX_HEIGHT = 800
WEBP_QUALITY = 80
MAX_FILE_SIZE_MB = 10
SUPPORTED_FORMATS = {'JPEG', 'JPG', 'PNG', 'WEBP', 'BMP'}


class ImageOptimizationError(Exception):
    """Custom exception for image optimization errors"""
    pass


class ImageOptimizer:
    """
    Service for optimizing uploaded images
    """
    
    def __init__(
        self,
        max_width: int = MAX_WIDTH,
        max_height: int = MAX_HEIGHT,
        quality: int = WEBP_QUALITY,
        max_size_mb: int = MAX_FILE_SIZE_MB
    ):
        """
        Initialize image optimizer
        
        Args:
            max_width: Maximum width in pixels
            max_height: Maximum height in pixels
            quality: WebP quality (0-100)
            max_size_mb: Maximum file size in MB
        """
        self.max_width = max_width
        self.max_height = max_height
        self.quality = quality
        self.max_size_mb = max_size_mb
    
    def validate_image(self, image_data: bytes) -> Tuple[bool, Optional[str]]:
        """
        Validate image data
        
        Args:
            image_data: Raw image bytes
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Check file size
            size_mb = len(image_data) / (1024 * 1024)
            if size_mb > self.max_size_mb:
                return False, f"Image too large: {size_mb:.2f}MB (max {self.max_size_mb}MB)"
            
            # Try to open image
            img = Image.open(io.BytesIO(image_data))
            
            # Check format
            if img.format not in SUPPORTED_FORMATS:
                return False, f"Unsupported format: {img.format}. Supported: {', '.join(SUPPORTED_FORMATS)}"
            
            # Check dimensions (reasonable limits)
            if img.width > 10000 or img.height > 10000:
                return False, f"Image dimensions too large: {img.width}x{img.height}"
            
            if img.width < 100 or img.height < 100:
                return False, f"Image dimensions too small: {img.width}x{img.height}"
            
            return True, None
            
        except Exception as e:
            logger.error(f"Image validation failed: {e}")
            return False, f"Invalid image data: {str(e)}"
    
    def calculate_resize_dimensions(
        self,
        original_width: int,
        original_height: int
    ) -> Tuple[int, int]:
        """
        Calculate new dimensions maintaining aspect ratio
        
        Args:
            original_width: Original image width
            original_height: Original image height
            
        Returns:
            Tuple of (new_width, new_height)
        """
        # If image is already smaller, don't upscale
        if original_width <= self.max_width and original_height <= self.max_height:
            return original_width, original_height
        
        # Calculate aspect ratio
        aspect_ratio = original_width / original_height
        
        # Determine new dimensions
        if aspect_ratio > 1:
            # Landscape
            new_width = min(original_width, self.max_width)
            new_height = int(new_width / aspect_ratio)
        else:
            # Portrait or square
            new_height = min(original_height, self.max_height)
            new_width = int(new_height * aspect_ratio)
        
        return new_width, new_height
    
    def optimize_image(
        self,
        image_data: bytes,
        output_format: str = 'WEBP'
    ) -> Tuple[bytes, dict]:
        """
        Optimize image: resize and convert to WebP
        
        Args:
            image_data: Raw image bytes
            output_format: Output format (default: WEBP)
            
        Returns:
            Tuple of (optimized_bytes, metadata)
            
        Raises:
            ImageOptimizationError: If optimization fails
        """
        try:
            # Validate image first
            is_valid, error_msg = self.validate_image(image_data)
            if not is_valid:
                raise ImageOptimizationError(error_msg)
            
            # Open image
            img = Image.open(io.BytesIO(image_data))
            original_format = img.format
            original_size = len(image_data)
            original_width, original_height = img.size
            
            logger.info(
                f"Optimizing image: {original_width}x{original_height}, "
                f"{original_format}, {original_size / 1024:.2f}KB"
            )
            
            # Convert to RGB if necessary (WebP doesn't support all modes)
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')
            
            # Calculate new dimensions
            new_width, new_height = self.calculate_resize_dimensions(
                original_width, original_height
            )
            
            # Resize if needed
            if (new_width, new_height) != (original_width, original_height):
                img = img.resize(
                    (new_width, new_height),
                    Image.Resampling.LANCZOS  # High-quality downsampling
                )
                logger.info(f"Resized to: {new_width}x{new_height}")
            
            # Convert to output format
            output_buffer = io.BytesIO()
            
            if output_format.upper() == 'WEBP':
                img.save(
                    output_buffer,
                    format='WEBP',
                    quality=self.quality,
                    method=6  # Slowest but best compression
                )
            elif output_format.upper() in ('JPEG', 'JPG'):
                # Convert RGBA to RGB for JPEG
                if img.mode == 'RGBA':
                    img = img.convert('RGB')
                img.save(
                    output_buffer,
                    format='JPEG',
                    quality=self.quality,
                    optimize=True
                )
            else:
                raise ImageOptimizationError(f"Unsupported output format: {output_format}")
            
            optimized_data = output_buffer.getvalue()
            optimized_size = len(optimized_data)
            
            # Calculate compression ratio
            compression_ratio = (
                ((original_size - optimized_size) / original_size) * 100
                if original_size > 0 else 0
            )
            
            metadata = {
                'original_format': original_format,
                'original_size': original_size,
                'original_width': original_width,
                'original_height': original_height,
                'optimized_format': output_format.upper(),
                'optimized_size': optimized_size,
                'optimized_width': new_width,
                'optimized_height': new_height,
                'compression_ratio': round(compression_ratio, 2),
                'quality': self.quality
            }
            
            logger.info(
                f"Optimization complete: {optimized_size / 1024:.2f}KB "
                f"({compression_ratio:.1f}% reduction)"
            )
            
            return optimized_data, metadata
            
        except ImageOptimizationError:
            raise
        except Exception as e:
            logger.error(f"Image optimization failed: {e}")
            raise ImageOptimizationError(f"Failed to optimize image: {str(e)}")
    
    def create_thumbnail(
        self,
        image_data: bytes,
        thumbnail_size: Tuple[int, int] = (200, 200)
    ) -> bytes:
        """
        Create a thumbnail for lazy loading
        
        Args:
            image_data: Raw image bytes
            thumbnail_size: Thumbnail dimensions (width, height)
            
        Returns:
            Thumbnail image bytes
            
        Raises:
            ImageOptimizationError: If thumbnail creation fails
        """
        try:
            img = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if necessary
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')
            
            # Create thumbnail (maintains aspect ratio)
            img.thumbnail(thumbnail_size, Image.Resampling.LANCZOS)
            
            # Save as WebP with lower quality for thumbnails
            output_buffer = io.BytesIO()
            img.save(
                output_buffer,
                format='WEBP',
                quality=70,
                method=6
            )
            
            return output_buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Thumbnail creation failed: {e}")
            raise ImageOptimizationError(f"Failed to create thumbnail: {str(e)}")
    
    def optimize_batch(
        self,
        images: list[bytes],
        output_format: str = 'WEBP'
    ) -> list[Tuple[bytes, dict]]:
        """
        Optimize multiple images in batch
        
        Args:
            images: List of raw image bytes
            output_format: Output format (default: WEBP)
            
        Returns:
            List of tuples (optimized_bytes, metadata)
        """
        results = []
        
        for i, image_data in enumerate(images):
            try:
                optimized, metadata = self.optimize_image(image_data, output_format)
                results.append((optimized, metadata))
                logger.info(f"Batch optimization {i+1}/{len(images)} complete")
            except ImageOptimizationError as e:
                logger.error(f"Batch optimization {i+1}/{len(images)} failed: {e}")
                results.append((None, {'error': str(e)}))
        
        return results


# Singleton instance
_optimizer_instance = None


def get_image_optimizer() -> ImageOptimizer:
    """
    Get singleton image optimizer instance
    
    Returns:
        ImageOptimizer instance
    """
    global _optimizer_instance
    if _optimizer_instance is None:
        _optimizer_instance = ImageOptimizer()
    return _optimizer_instance


# Convenience functions
def optimize_image(image_data: bytes, output_format: str = 'WEBP') -> Tuple[bytes, dict]:
    """
    Optimize a single image
    
    Args:
        image_data: Raw image bytes
        output_format: Output format (default: WEBP)
        
    Returns:
        Tuple of (optimized_bytes, metadata)
    """
    optimizer = get_image_optimizer()
    return optimizer.optimize_image(image_data, output_format)


def create_thumbnail(image_data: bytes) -> bytes:
    """
    Create a thumbnail for lazy loading
    
    Args:
        image_data: Raw image bytes
        
    Returns:
        Thumbnail image bytes
    """
    optimizer = get_image_optimizer()
    return optimizer.create_thumbnail(image_data)


def validate_image(image_data: bytes) -> Tuple[bool, Optional[str]]:
    """
    Validate image data
    
    Args:
        image_data: Raw image bytes
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    optimizer = get_image_optimizer()
    return optimizer.validate_image(image_data)
