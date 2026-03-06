# Chatbot NLP Model - IndicBERT Intent Classification

## Overview

This module implements a multilingual chatbot for farming queries using IndicBERT (ai4bharat/indic-bert) fine-tuned for intent classification. The model supports Hindi and Marathi languages and recognizes 20+ farming-related intents with >85% accuracy.

## Features

- **Intent Recognition**: 20+ farming intents (weather, prices, diseases, schemes, etc.)
- **Multilingual Support**: Hindi and Marathi
- **High Accuracy**: >85% intent recognition on validation set
- **Fast Inference**: <1s response time for real-time queries
- **Fallback Handling**: Low confidence (<0.85) queries handled gracefully

## Model Architecture

- **Base Model**: ai4bharat/indic-bert (pre-trained on 12 Indian languages)
- **Fine-tuning**: Intent classification with 20+ farming intents
- **Training Data**: 100+ examples per intent in Hindi and Marathi (2000+ total examples)
- **Validation Split**: 80/20 train/validation split

## Supported Intents

1. weather_query - Weather forecast queries
2. price_query - Market price queries
3. disease_identification - Disease identification requests
4. crop_recommendation - Crop recommendation requests
5. irrigation_advice - Irrigation and water management
6. scheme_information - Government scheme queries
7. pest_control - Pest control advice
8. fertilizer_advice - Fertilizer recommendations
9. market_information - Market and mandi information
10. sowing_time - Optimal sowing time queries
11. harvest_time - Harvest timing queries
12. soil_health - Soil health and testing
13. organic_farming - Organic farming practices
14. loan_information - Agricultural loan queries
15. insurance_query - Crop insurance queries
16. subsidy_query - Subsidy information
17. general_farming - General farming questions
18. equipment_advice - Farm equipment recommendations
19. storage_advice - Crop storage guidance
20. transport_help - Transportation assistance

## Directory Structure

```
ml-models/chatbot-nlp/
├── data/
│   ├── training_data.json       # Training dataset (Hindi + Marathi)
│   ├── validation_data.json     # Validation dataset
│   └── response_templates.json  # Response templates by intent
├── models/
│   ├── intent_classifier/       # Fine-tuned IndicBERT model
│   └── tokenizer/               # Tokenizer files
├── train.py                     # Training script
├── evaluate.py                  # Evaluation script
├── inference.py                 # Inference utilities
├── config.yaml                  # Configuration
├── requirements.txt             # Python dependencies
└── README.md                    # This file
```

## Setup

### Prerequisites

- Python 3.8+
- CUDA-capable GPU (recommended for training)
- 8GB+ RAM

### Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download IndicBERT base model (automatic on first run)
```

## Training

```bash
# Train the model
python train.py

# With custom config
python train.py --config config.yaml --epochs 10 --batch-size 16
```

Training parameters:
- Epochs: 10 (default)
- Batch size: 16
- Learning rate: 2e-5
- Max sequence length: 128
- Validation split: 0.2

## Evaluation

```bash
# Evaluate on validation set
python evaluate.py

# Expected output:
# Accuracy: >85%
# F1 Score: >0.85
# Confusion matrix and per-intent metrics
```

## Inference

```python
from inference import IntentClassifier

# Load model
classifier = IntentClassifier('models/intent_classifier')

# Classify intent
result = classifier.predict("आज का मौसम कैसा है?")
print(result)
# {
#   'intent': 'weather_query',
#   'confidence': 0.92,
#   'language': 'hi'
# }
```

## Integration with FastAPI Service

The trained model is deployed as a FastAPI service in `services/govt-service` for real-time inference.

## Performance Metrics

- **Accuracy**: >85% on validation set
- **Inference Time**: <1s per query
- **Model Size**: ~500MB (IndicBERT base)
- **Supported Languages**: Hindi (hi), Marathi (mr)

## Response Templates

Response templates are stored in `data/response_templates.json` and support:
- Dynamic variable substitution
- Language-specific responses
- Fallback responses for low confidence

## License

This model uses the IndicBERT base model from AI4Bharat, licensed under MIT License.
