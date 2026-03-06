"""Services module for business logic."""

from .image_optimizer import ImageOptimizer

try:
    from .crop_service import CropService
except ImportError:
    CropService = None

try:
    from .disease_service import DiseaseService
except ImportError:
    DiseaseService = None

__all__ = ["CropService", "DiseaseService", "ImageOptimizer"]
