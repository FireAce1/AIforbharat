#!/bin/bash

# Disease Detection Model Setup Script
# This script sets up the environment and prepares for training

set -e  # Exit on error

echo "=========================================="
echo "Disease Detection Model Setup"
echo "=========================================="

# Check Python version
echo "Checking Python version..."
python_version=$(python --version 2>&1 | awk '{print $2}')
echo "Python version: $python_version"

if ! python -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)"; then
    echo "Error: Python 3.8 or higher is required"
    exit 1
fi

# Create virtual environment
echo ""
echo "Creating virtual environment..."
if [ ! -d "venv" ]; then
    python -m venv venv
    echo "Virtual environment created"
else
    echo "Virtual environment already exists"
fi

# Activate virtual environment
echo ""
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo ""
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo ""
echo "Installing dependencies..."
pip install -r requirements.txt

# Create necessary directories
echo ""
echo "Creating directories..."
mkdir -p data
mkdir -p models
mkdir -p checkpoints
mkdir -p logs

# Create .gitkeep files
touch data/.gitkeep
touch models/.gitkeep
touch checkpoints/.gitkeep
touch logs/.gitkeep

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Activate virtual environment: source venv/bin/activate"
echo "2. Download dataset: python scripts/download_dataset.py"
echo "3. Train model: python train.py"
echo ""
echo "For more information, see README.md"
