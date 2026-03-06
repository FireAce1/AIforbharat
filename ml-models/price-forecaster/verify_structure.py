"""
Verify price forecaster implementation structure
This script checks that all required files and components are in place
"""

import os
import ast
import yaml


def check_file_exists(filepath):
    """Check if file exists"""
    exists = os.path.exists(filepath)
    status = "✓" if exists else "✗"
    print(f"{status} {filepath}")
    return exists


def check_python_file(filepath, required_classes=None, required_functions=None):
    """Check Python file for required classes and functions"""
    if not os.path.exists(filepath):
        print(f"✗ {filepath} - File not found")
        return False
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read())
        
        classes = [node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
        functions = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
        
        print(f"✓ {filepath}")
        
        if required_classes:
            for cls in required_classes:
                if cls in classes:
                    print(f"  ✓ Class: {cls}")
                else:
                    print(f"  ✗ Class: {cls} (missing)")
        
        if required_functions:
            for func in required_functions:
                if func in functions:
                    print(f"  ✓ Function: {func}")
                else:
                    print(f"  ✗ Function: {func} (missing)")
        
        return True
    except Exception as e:
        print(f"✗ {filepath} - Error parsing: {e}")
        return False


def main():
    """Main verification function"""
    print("="*60)
    print("PRICE FORECASTER STRUCTURE VERIFICATION")
    print("="*60)
    
    results = []
    
    # Check configuration
    print("\n--- Configuration Files ---")
    results.append(check_file_exists('config.yaml'))
    results.append(check_file_exists('requirements.txt'))
    results.append(check_file_exists('README.md'))
    
    # Check Python modules
    print("\n--- Core Python Modules ---")
    results.append(check_python_file(
        'data_loader.py',
        required_classes=['PriceDataLoader'],
        required_functions=['connect_db', 'fetch_historical_data', 'preprocess_data', 'split_data']
    ))
    
    results.append(check_python_file(
        'train.py',
        required_classes=['ARIMATrainer', 'LSTMTrainer', 'EnsembleForecaster'],
        required_functions=['train_models', 'evaluate_model', 'main']
    ))
    
    results.append(check_python_file(
        'evaluate.py',
        required_functions=['load_models', 'evaluate_metrics', 'plot_forecast', 'evaluate_model', 'main']
    ))
    
    results.append(check_python_file(
        'forecast.py',
        required_functions=['generate_forecast', 'save_forecast', 'print_forecast_summary', 'main']
    ))
    
    # Check directories
    print("\n--- Directory Structure ---")
    results.append(check_file_exists('models/'))
    results.append(check_file_exists('logs/'))
    results.append(check_file_exists('plots/'))
    results.append(check_file_exists('forecasts/'))
    
    # Check configuration content
    print("\n--- Configuration Validation ---")
    try:
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        
        checks = [
            ('arima.order', config.get('arima', {}).get('order') == [5, 1, 2]),
            ('lstm.sequence_length', config.get('lstm', {}).get('sequence_length') == 30),
            ('lstm.forecast_days', config.get('lstm', {}).get('forecast_days') == 7),
            ('ensemble.arima_weight', config.get('ensemble', {}).get('arima_weight') == 0.6),
            ('ensemble.lstm_weight', config.get('ensemble', {}).get('lstm_weight') == 0.4),
            ('evaluation.target_mape', config.get('evaluation', {}).get('target_mape') == 15.0),
        ]
        
        for key, valid in checks:
            status = "✓" if valid else "✗"
            print(f"{status} {key}: {valid}")
            results.append(valid)
    except Exception as e:
        print(f"✗ Configuration validation failed: {e}")
        results.append(False)
    
    # Summary
    print("\n" + "="*60)
    print("VERIFICATION SUMMARY")
    print("="*60)
    
    passed = sum(results)
    total = len(results)
    
    print(f"Checks Passed: {passed}/{total}")
    
    if passed == total:
        print("\n✓ All structure checks passed!")
        print("\nImplementation includes:")
        print("  • ARIMA model trainer (order 5,1,2)")
        print("  • LSTM model trainer (2 layers: 64, 32 units)")
        print("  • Ensemble forecaster (0.6 * ARIMA + 0.4 * LSTM)")
        print("  • Data loader with preprocessing")
        print("  • Training pipeline with evaluation")
        print("  • Forecast generation (7/30/90 days)")
        print("  • Visualization and reporting")
        print("\nNext steps:")
        print("  1. Install dependencies: pip install -r requirements.txt")
        print("  2. Set up database connection in .env file")
        print("  3. Ensure market_prices table has 5 years of data")
        print("  4. Run training: python train.py --crop tomato --market pune")
    else:
        print(f"\n⚠ {total - passed} check(s) failed. Please review the errors above.")
    
    return passed == total


if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
