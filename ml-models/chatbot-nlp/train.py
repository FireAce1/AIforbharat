"""
Train IndicBERT model for intent classification.
Fine-tunes ai4bharat/indic-bert on farming intent dataset.
"""

import json
import yaml
import torch
import numpy as np
from pathlib import Path
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback
)
from datasets import Dataset
from sklearn.metrics import accuracy_score, f1_score, classification_report
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class IntentClassificationTrainer:
    def __init__(self, config_path="config.yaml"):
        """Initialize trainer with configuration"""
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
        
        self.model_name = self.config['model']['name']
        self.num_labels = self.config['model']['num_labels']
        self.max_length = self.config['model']['max_length']
        
        # Create output directories
        Path(self.config['output']['model_dir']).mkdir(parents=True, exist_ok=True)
        Path(self.config['output']['logs_dir']).mkdir(parents=True, exist_ok=True)
        
        # Intent to ID mapping
        self.intent2id = {intent: idx for idx, intent in enumerate(self.config['intents'])}
        self.id2intent = {idx: intent for intent, idx in self.intent2id.items()}
        
        logger.info(f"Initialized trainer with {self.num_labels} intents")
    
    def load_data(self):
        """Load training and validation datasets"""
        logger.info("Loading datasets...")
        
        with open(self.config['data']['training_file'], 'r', encoding='utf-8') as f:
            train_data = json.load(f)
        
        with open(self.config['data']['validation_file'], 'r', encoding='utf-8') as f:
            val_data = json.load(f)
        
        # Convert to Hugging Face Dataset format
        train_dataset = Dataset.from_dict({
            'text': [item['text'] for item in train_data],
            'label': [self.intent2id[item['intent']] for item in train_data],
            'language': [item['language'] for item in train_data]
        })
        
        val_dataset = Dataset.from_dict({
            'text': [item['text'] for item in val_data],
            'label': [self.intent2id[item['intent']] for item in val_data],
            'language': [item['language'] for item in val_data]
        })
        
        logger.info(f"Loaded {len(train_dataset)} training examples")
        logger.info(f"Loaded {len(val_dataset)} validation examples")
        
        return train_dataset, val_dataset
    
    def preprocess_data(self, dataset):
        """Tokenize dataset"""
        logger.info("Tokenizing dataset...")
        
        tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        
        def tokenize_function(examples):
            return tokenizer(
                examples['text'],
                padding='max_length',
                truncation=True,
                max_length=self.max_length
            )
        
        tokenized_dataset = dataset.map(tokenize_function, batched=True)
        return tokenized_dataset, tokenizer
    
    def compute_metrics(self, eval_pred):
        """Compute evaluation metrics"""
        predictions, labels = eval_pred
        predictions = np.argmax(predictions, axis=1)
        
        accuracy = accuracy_score(labels, predictions)
        f1 = f1_score(labels, predictions, average='weighted')
        
        return {
            'accuracy': accuracy,
            'f1': f1
        }
    
    def train(self):
        """Train the model"""
        logger.info("Starting training...")
        
        # Load data
        train_dataset, val_dataset = self.load_data()
        
        # Tokenize
        train_dataset, tokenizer = self.preprocess_data(train_dataset)
        val_dataset, _ = self.preprocess_data(val_dataset)
        
        # Load model
        logger.info(f"Loading model: {self.model_name}")
        model = AutoModelForSequenceClassification.from_pretrained(
            self.model_name,
            num_labels=self.num_labels
        )
        
        # Training arguments
        training_args = TrainingArguments(
            output_dir=self.config['output']['logs_dir'],
            num_train_epochs=self.config['training']['epochs'],
            per_device_train_batch_size=self.config['training']['batch_size'],
            per_device_eval_batch_size=self.config['training']['batch_size'],
            learning_rate=self.config['training']['learning_rate'],
            warmup_steps=self.config['training']['warmup_steps'],
            weight_decay=self.config['training']['weight_decay'],
            logging_dir=f"{self.config['output']['logs_dir']}/runs",
            logging_steps=50,
            evaluation_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model="accuracy",
            greater_is_better=True,
            save_total_limit=2,
            report_to="tensorboard"
        )
        
        # Initialize trainer
        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            compute_metrics=self.compute_metrics,
            callbacks=[EarlyStoppingCallback(
                early_stopping_patience=self.config['training']['early_stopping_patience']
            )]
        )
        
        # Train
        logger.info("Training model...")
        trainer.train()
        
        # Evaluate
        logger.info("Evaluating model...")
        eval_results = trainer.evaluate()
        logger.info(f"Evaluation results: {eval_results}")
        
        # Save model
        logger.info(f"Saving model to {self.config['output']['model_dir']}")
        trainer.save_model(self.config['output']['model_dir'])
        tokenizer.save_pretrained(self.config['output']['tokenizer_dir'])
        
        # Save intent mappings
        with open(f"{self.config['output']['model_dir']}/intent_mapping.json", 'w') as f:
            json.dump({
                'intent2id': self.intent2id,
                'id2intent': self.id2intent
            }, f, indent=2)
        
        logger.info("Training complete!")
        
        return eval_results

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Train chatbot intent classifier')
    parser.add_argument('--config', type=str, default='config.yaml', help='Config file path')
    parser.add_argument('--epochs', type=int, help='Number of epochs (overrides config)')
    parser.add_argument('--batch-size', type=int, help='Batch size (overrides config)')
    
    args = parser.parse_args()
    
    # Initialize trainer
    trainer = IntentClassificationTrainer(args.config)
    
    # Override config if specified
    if args.epochs:
        trainer.config['training']['epochs'] = args.epochs
    if args.batch_size:
        trainer.config['training']['batch_size'] = args.batch_size
    
    # Train model
    results = trainer.train()
    
    print("\n" + "="*50)
    print("TRAINING COMPLETE")
    print("="*50)
    print(f"Final Accuracy: {results['eval_accuracy']:.4f}")
    print(f"Final F1 Score: {results['eval_f1']:.4f}")
    print(f"Model saved to: {trainer.config['output']['model_dir']}")
