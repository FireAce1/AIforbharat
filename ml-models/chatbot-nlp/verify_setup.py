"""
Verify that the chatbot NLP setup is complete and ready for training.
"""

import os
import json
import yaml
from pathlib import Path

def check_file(filepath, description):
    """Check if a file exists"""
    exists = os.path.exists(filepath)
    status = "✓" if exists else "✗"
    print(f"{status} {description}: {filepath}")
    return exists

def check_directory(dirpath, description):
    """Check if a directory exists"""
    exists = os.path.exists(dirpath) and os.path.isdir(dirpath)
    status = "✓" if exists else "✗"
    print(f"{status} {description}: {dirpath}")
    return exists

def verify_training_data():
    """Verify training data is properly formatted"""
    try:
        with open("data/training_data.json", "r", encoding="utf-8") as f:
            train_data = json.load(f)
        
        with open("data/validation_data.json", "r", encoding="utf-8") as f:
            val_data = json.load(f)
        
        print(f"\n✓ Training data loaded: {len(train_data)} examples")
        print(f"✓ Validation data loaded: {len(val_data)} examples")
        
        # Count intents
        intents = set(item['intent'] for item in train_data)
        print(f"✓ Number of intents: {len(intents)}")
        
        # Check examples per intent
        intent_counts = {}
        for item in train_data + val_data:
            intent_counts[item['intent']] = intent_counts.get(item['intent'], 0) + 1
        
        min_examples = min(intent_counts.values())
        max_examples = max(intent_counts.values())
        print(f"✓ Examples per intent: {min_examples}-{max_examples}")
        
        if min_examples >= 100:
            print("✓ All intents have 100+ examples (requirement met)")
        else:
            print(f"✗ Some intents have <100 examples (requirement: 100+)")
            return False
        
        if len(intents) >= 20:
            print(f"✓ 20+ intents covered (requirement met)")
        else:
            print(f"✗ Only {len(intents)} intents (requirement: 20+)")
            return False
        
        return True
    except Exception as e:
        print(f"✗ Error loading training data: {e}")
        return False

def verify_config():
    """Verify configuration file"""
    try:
        with open("config.yaml", "r") as f:
            config = yaml.safe_load(f)
        
        print("\n✓ Configuration loaded")
        print(f"  Model: {config['model']['name']}")
        print(f"  Intents: {config['model']['num_labels']}")
        print(f"  Epochs: {config['training']['epochs']}")
        print(f"  Batch size: {config['training']['batch_size']}")
        print(f"  Confidence threshold: {config['inference']['confidence_threshold']}")
        
        return True
    except Exception as e:
        print(f"✗ Error loading config: {e}")
        return False

def verify_response_templates():
    """Verify response templates"""
    try:
        with open("data/response_templates.json", "r", encoding="utf-8") as f:
            templates = json.load(f)
        
        print(f"\n✓ Response templates loaded: {len(templates)} intents")
        
        # Check bilingual support
        has_hindi = all('hi' in templates[intent] for intent in templates if intent != 'fallback')
        has_marathi = all('mr' in templates[intent] for intent in templates if intent != 'fallback')
        
        if has_hindi and has_marathi:
            print("✓ Bilingual templates (Hindi + Marathi)")
        else:
            print("✗ Missing bilingual templates")
            return False
        
        return True
    except Exception as e:
        print(f"✗ Error loading response templates: {e}")
        return False

def main():
    print("="*60)
    print("Chatbot NLP Setup Verification")
    print("="*60)
    
    all_checks = []
    
    # Check files
    print("\n1. Checking Files:")
    all_checks.append(check_file("config.yaml", "Configuration"))
    all_checks.append(check_file("requirements.txt", "Requirements"))
    all_checks.append(check_file("train.py", "Training script"))
    all_checks.append(check_file("evaluate.py", "Evaluation script"))
    all_checks.append(check_file("inference.py", "Inference script"))
    all_checks.append(check_file("generate_full_dataset.py", "Data generation"))
    all_checks.append(check_file("setup.ps1", "Setup script"))
    all_checks.append(check_file("README.md", "Documentation"))
    
    # Check directories
    print("\n2. Checking Directories:")
    all_checks.append(check_directory("data", "Data directory"))
    all_checks.append(check_directory("models", "Models directory"))
    all_checks.append(check_directory("logs", "Logs directory"))
    
    # Check data files
    print("\n3. Checking Data Files:")
    all_checks.append(check_file("data/training_data.json", "Training data"))
    all_checks.append(check_file("data/validation_data.json", "Validation data"))
    all_checks.append(check_file("data/response_templates.json", "Response templates"))
    
    # Verify training data
    print("\n4. Verifying Training Data:")
    all_checks.append(verify_training_data())
    
    # Verify configuration
    print("\n5. Verifying Configuration:")
    all_checks.append(verify_config())
    
    # Verify response templates
    print("\n6. Verifying Response Templates:")
    all_checks.append(verify_response_templates())
    
    # Summary
    print("\n" + "="*60)
    passed = sum(all_checks)
    total = len(all_checks)
    
    if passed == total:
        print(f"✓ ALL CHECKS PASSED ({passed}/{total})")
        print("\nSetup is complete! Ready for training.")
        print("\nNext steps:")
        print("  1. Run: python train.py")
        print("  2. Run: python evaluate.py")
        print("  3. Test: python inference.py")
    else:
        print(f"✗ SOME CHECKS FAILED ({passed}/{total})")
        print("\nPlease fix the issues above before training.")
    
    print("="*60)
    
    return passed == total

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
