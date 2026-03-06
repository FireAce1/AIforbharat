#!/usr/bin/env python3
"""
Setup script for Price Forecaster environment
"""

import os
import sys
import subprocess
from pathlib import Path

def create_directories():
    """Create necessary directories"""
    directories = ['models', 'logs', 'data']
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
        print(f"✓ Created directory: {directory}/")

def install_dependencies():
    """Install Python dependencies"""
    print("\nInstalling dependencies...")
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])
        print("✓ Dependencies installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install dependencies: {e}")
        sys.exit(1)

def create_env_file():
    """Create .env file if it doesn't exist"""
    env_file = Path('.env')
    if not env_file.exists():
        with open(env_file, 'w') as f:
            f.write("# Database Configuration\n")
            f.write("DB_HOST=localhost\n")
            f.write("DB_PORT=5432\n")
            f.write("DB_NAME=krishiai_db\n")
            f.write("DB_USER=krishiai_user\n")
            f.write("DB_PASSWORD=your_password_here\n")
        print("✓ Created .env file (please update with your credentials)")
    else:
        print("✓ .env file already exists")

def main():
    """Main setup function"""
    print("=" * 60)
    print("Price Forecaster Model - Setup")
    print("=" * 60)
    
    create_directories()
    install_dependencies()
    create_env_file()
    
    print("\n" + "=" * 60)
    print("Setup completed successfully!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Update .env file with your database credentials")
    print("2. Ensure PostgreSQL is running with market_prices data")
    print("3. Run: python train.py --crop tomato --market pune")
    print("=" * 60)

if __name__ == '__main__':
    main()
