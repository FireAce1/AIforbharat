"""Quick setup verification script."""

import sys
import importlib.util

def check_import(module_name, file_path):
    """Check if a module can be imported."""
    try:
        spec = importlib.util.spec_from_file_location(module_name, file_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        print(f"✓ {module_name} imports successfully")
        return True
    except Exception as e:
        print(f"✗ {module_name} failed: {e}")
        return False

def main():
    """Run setup verification checks."""
    print("Verifying Crop Service Setup...")
    print("-" * 50)
    
    checks = [
        ("config", "src/config.py"),
        ("database", "src/database.py"),
        ("models.farm", "src/models/farm.py"),
        ("models.crop", "src/models/crop.py"),
        ("models.disease", "src/models/disease.py"),
        ("schemas.crop", "src/schemas/crop.py"),
        ("schemas.disease", "src/schemas/disease.py"),
        ("routes.health", "src/routes/health.py"),
        ("routes.crop", "src/routes/crop.py"),
        ("routes.disease", "src/routes/disease.py"),
        ("services.crop_service", "src/services/crop_service.py"),
        ("services.disease_service", "src/services/disease_service.py"),
        ("ml.crop_recommender", "src/ml/crop_recommender.py"),
    ]
    
    passed = 0
    failed = 0
    
    for module_name, file_path in checks:
        if check_import(module_name, file_path):
            passed += 1
        else:
            failed += 1
    
    print("-" * 50)
    print(f"Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("\n✓ All checks passed! Crop Service is ready.")
        return 0
    else:
        print(f"\n✗ {failed} checks failed. Please review errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
