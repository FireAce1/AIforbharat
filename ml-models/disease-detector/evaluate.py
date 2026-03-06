"""
Evaluate trained disease detection model.
"""
import argparse
import yaml
import json
import numpy as np
from pathlib import Path
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns

def load_config():
    """Load configuration from config.yaml"""
    with open('config.yaml', 'r') as f:
        return yaml.safe_load(f)

def create_test_generator(config):
    """Create test data generator"""
    test_datagen = ImageDataGenerator(rescale=1./255)
    
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
    
    test_generator = test_datagen.flow_from_directory(
        data_dir,
        target_size=tuple(config['model']['input_shape'][:2]),
        batch_size=config['training']['batch_size'],
        class_mode='categorical',
        shuffle=False
    )
    
    return test_generator

def evaluate_model(model_path, config):
    """Evaluate model on test set"""
    print("Loading model...")
    model = keras.models.load_model(model_path)
    
    print("Creating test generator...")
    test_generator = create_test_generator(config)
    
    print(f"Test samples: {test_generator.samples}")
    print(f"Number of classes: {test_generator.num_classes}")
    
    # Evaluate
    print("\nEvaluating model...")
    results = model.evaluate(test_generator, verbose=1)
    
    print("\n" + "="*60)
    print("Evaluation Results")
    print("="*60)
    print(f"Loss: {results[0]:.4f}")
    print(f"Accuracy: {results[1]:.4f} ({results[1]*100:.2f}%)")
    if len(results) > 2:
        print(f"Top-3 Accuracy: {results[2]:.4f} ({results[2]*100:.2f}%)")
    
    # Get predictions
    print("\nGenerating predictions...")
    predictions = model.predict(test_generator, verbose=1)
    predicted_classes = np.argmax(predictions, axis=1)
    true_classes = test_generator.classes
    
    # Load class names
    class_indices_path = Path(config['paths']['models_dir']) / 'class_indices.json'
    with open(class_indices_path, 'r') as f:
        class_indices = json.load(f)
    
    class_names = {v: k for k, v in class_indices.items()}
    class_names_list = [class_names[i] for i in range(len(class_names))]
    
    # Classification report
    print("\n" + "="*60)
    print("Classification Report")
    print("="*60)
    report = classification_report(
        true_classes, 
        predicted_classes, 
        target_names=class_names_list,
        digits=4
    )
    print(report)
    
    # Save report
    report_path = Path(config['paths']['models_dir']) / 'evaluation_report.txt'
    with open(report_path, 'w') as f:
        f.write("Evaluation Results\n")
        f.write("="*60 + "\n")
        f.write(f"Loss: {results[0]:.4f}\n")
        f.write(f"Accuracy: {results[1]:.4f} ({results[1]*100:.2f}%)\n")
        if len(results) > 2:
            f.write(f"Top-3 Accuracy: {results[2]:.4f} ({results[2]*100:.2f}%)\n")
        f.write("\n" + "="*60 + "\n")
        f.write("Classification Report\n")
        f.write("="*60 + "\n")
        f.write(report)
    
    print(f"\nEvaluation report saved to: {report_path}")
    
    # Confusion matrix (for top 10 classes)
    print("\nGenerating confusion matrix...")
    cm = confusion_matrix(true_classes, predicted_classes)
    
    # Plot confusion matrix for top 10 most common classes
    top_10_classes = np.argsort(np.bincount(true_classes))[-10:]
    cm_top10 = cm[top_10_classes][:, top_10_classes]
    class_names_top10 = [class_names_list[i] for i in top_10_classes]
    
    plt.figure(figsize=(12, 10))
    sns.heatmap(cm_top10, annot=True, fmt='d', cmap='Blues',
                xticklabels=class_names_top10,
                yticklabels=class_names_top10)
    plt.title('Confusion Matrix (Top 10 Classes)')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.xticks(rotation=45, ha='right')
    plt.yticks(rotation=0)
    plt.tight_layout()
    
    cm_path = Path(config['paths']['models_dir']) / 'confusion_matrix.png'
    plt.savefig(cm_path, dpi=300, bbox_inches='tight')
    print(f"Confusion matrix saved to: {cm_path}")
    
    # Per-class accuracy
    per_class_accuracy = cm.diagonal() / cm.sum(axis=1)
    
    print("\n" + "="*60)
    print("Per-Class Accuracy (Top 10 and Bottom 10)")
    print("="*60)
    
    sorted_indices = np.argsort(per_class_accuracy)
    
    print("\nBottom 10 (Lowest Accuracy):")
    for idx in sorted_indices[:10]:
        print(f"{class_names_list[idx]}: {per_class_accuracy[idx]*100:.2f}%")
    
    print("\nTop 10 (Highest Accuracy):")
    for idx in sorted_indices[-10:]:
        print(f"{class_names_list[idx]}: {per_class_accuracy[idx]*100:.2f}%")
    
    # Check if target accuracy is met
    accuracy = results[1]
    if accuracy >= 0.90:
        print(f"\n✓ Target accuracy achieved: {accuracy*100:.2f}% >= 90%")
    else:
        print(f"\n✗ Target accuracy not met: {accuracy*100:.2f}% < 90%")
    
    return results, report

def main():
    """Main evaluation function"""
    parser = argparse.ArgumentParser(description='Evaluate disease detection model')
    parser.add_argument('--model-path', type=str, default='models/disease_detector.h5',
                        help='Path to trained model')
    args = parser.parse_args()
    
    config = load_config()
    
    print("="*60)
    print("Disease Detection Model Evaluation")
    print("="*60)
    print(f"Model: {args.model_path}")
    print("="*60)
    
    evaluate_model(args.model_path, config)
    
    print("\nEvaluation complete!")

if __name__ == '__main__':
    main()
