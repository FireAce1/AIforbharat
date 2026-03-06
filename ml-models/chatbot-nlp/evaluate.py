"""
Evaluate trained intent classification model.
"""

import json
import yaml
import torch
import numpy as np
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from datasets import Dataset
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    classification_report,
    confusion_matrix
)
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class IntentClassificationEvaluator:
    def __init__(self, model_dir, config_path="config.yaml"):
        """Initialize evaluator"""
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
        
        self.model_dir = model_dir
        self.max_length = self.config['model']['max_length']
        
        # Load intent mappings
        with open(f"{model_dir}/intent_mapping.json", 'r') as f:
            mappings = json.load(f)
            self.intent2id = mappings['intent2id']
            self.id2intent = {int(k): v for k, v in mappings['id2intent'].items()}
        
        # Load model and tokenizer
        logger.info(f"Loading model from {model_dir}")
        self.tokenizer = AutoTokenizer.from_pretrained(model_dir)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_dir)
        self.model.eval()
        
        # Move to GPU if available
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model.to(self.device)
        logger.info(f"Using device: {self.device}")
    
    def load_validation_data(self):
        """Load validation dataset"""
        logger.info("Loading validation data...")
        
        with open(self.config['data']['validation_file'], 'r', encoding='utf-8') as f:
            val_data = json.load(f)
        
        return val_data
    
    def predict(self, texts):
        """Predict intents for a batch of texts"""
        inputs = self.tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors='pt'
        )
        
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = self.model(**inputs)
            predictions = torch.argmax(outputs.logits, dim=-1)
            probabilities = torch.softmax(outputs.logits, dim=-1)
        
        return predictions.cpu().numpy(), probabilities.cpu().numpy()
    
    def evaluate(self):
        """Evaluate model on validation set"""
        logger.info("Evaluating model...")
        
        val_data = self.load_validation_data()
        
        texts = [item['text'] for item in val_data]
        true_labels = [self.intent2id[item['intent']] for item in val_data]
        
        # Predict in batches
        batch_size = 32
        all_predictions = []
        all_probabilities = []
        
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]
            predictions, probabilities = self.predict(batch_texts)
            all_predictions.extend(predictions)
            all_probabilities.extend(probabilities)
        
        all_predictions = np.array(all_predictions)
        all_probabilities = np.array(all_probabilities)
        
        # Calculate metrics
        accuracy = accuracy_score(true_labels, all_predictions)
        f1 = f1_score(true_labels, all_predictions, average='weighted')
        precision = precision_score(true_labels, all_predictions, average='weighted')
        recall = recall_score(true_labels, all_predictions, average='weighted')
        
        logger.info(f"\nOverall Metrics:")
        logger.info(f"Accuracy: {accuracy:.4f}")
        logger.info(f"F1 Score: {f1:.4f}")
        logger.info(f"Precision: {precision:.4f}")
        logger.info(f"Recall: {recall:.4f}")
        
        # Per-intent metrics
        logger.info("\nPer-Intent Classification Report:")
        target_names = [self.id2intent[i] for i in range(len(self.id2intent))]
        print(classification_report(true_labels, all_predictions, target_names=target_names))
        
        # Confusion matrix
        cm = confusion_matrix(true_labels, all_predictions)
        logger.info(f"\nConfusion Matrix Shape: {cm.shape}")
        
        # Check if accuracy meets requirement (>85%)
        if accuracy >= 0.85:
            logger.info(f"✓ Model meets accuracy requirement (>85%): {accuracy:.4f}")
        else:
            logger.warning(f"✗ Model does not meet accuracy requirement: {accuracy:.4f} < 0.85")
        
        # Confidence analysis
        max_probs = np.max(all_probabilities, axis=1)
        avg_confidence = np.mean(max_probs)
        logger.info(f"\nAverage Confidence: {avg_confidence:.4f}")
        logger.info(f"Low Confidence Predictions (<0.85): {np.sum(max_probs < 0.85)} / {len(max_probs)}")
        
        return {
            'accuracy': accuracy,
            'f1': f1,
            'precision': precision,
            'recall': recall,
            'avg_confidence': avg_confidence,
            'confusion_matrix': cm.tolist()
        }

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Evaluate intent classifier')
    parser.add_argument('--model-dir', type=str, default='models/intent_classifier',
                       help='Path to trained model directory')
    parser.add_argument('--config', type=str, default='config.yaml',
                       help='Config file path')
    
    args = parser.parse_args()
    
    # Initialize evaluator
    evaluator = IntentClassificationEvaluator(args.model_dir, args.config)
    
    # Evaluate
    results = evaluator.evaluate()
    
    # Save results
    output_file = f"{args.model_dir}/evaluation_results.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    logger.info(f"\nEvaluation results saved to: {output_file}")
