#!/bin/bash

# Certbot Setup Script for Let's Encrypt Certificates
# Usage: ./certbot-setup.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}
DOMAINS="api.krishiai.com auth.krishiai.com crop.krishiai.com market.krishiai.com climate.krishiai.com govt.krishiai.com"
EMAIL="admin@krishiai.com"

echo "=========================================="
echo "KrishiAI TLS Certificate Setup"
echo "Environment: $ENVIRONMENT"
echo "=========================================="

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Error: certbot is not installed"
    echo "Install with: sudo apt-get install certbot python3-certbot-nginx"
    exit 1
fi

# Create certificate directory
CERT_DIR="./certs/$ENVIRONMENT"
mkdir -p "$CERT_DIR"

# Build domain arguments
DOMAIN_ARGS=""
for domain in $DOMAINS; do
    DOMAIN_ARGS="$DOMAIN_ARGS -d $domain"
done

# Staging or production
if [ "$ENVIRONMENT" = "staging" ]; then
    echo "Using Let's Encrypt staging server (for testing)"
    STAGING_FLAG="--staging"
else
    echo "Using Let's Encrypt production server"
    STAGING_FLAG=""
fi

# Obtain certificates
echo "Obtaining certificates for domains: $DOMAINS"
sudo certbot certonly \
    --nginx \
    $STAGING_FLAG \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    $DOMAIN_ARGS \
    --cert-name krishiai

# Copy certificates to local directory
echo "Copying certificates to $CERT_DIR"
sudo cp /etc/letsencrypt/live/krishiai/fullchain.pem "$CERT_DIR/"
sudo cp /etc/letsencrypt/live/krishiai/privkey.pem "$CERT_DIR/"
sudo cp /etc/letsencrypt/live/krishiai/chain.pem "$CERT_DIR/"

# Set proper permissions
sudo chmod 644 "$CERT_DIR/fullchain.pem"
sudo chmod 644 "$CERT_DIR/chain.pem"
sudo chmod 600 "$CERT_DIR/privkey.pem"
sudo chown $USER:$USER "$CERT_DIR"/*

# Generate Diffie-Hellman parameters if not exists
if [ ! -f "./dhparam.pem" ]; then
    echo "Generating Diffie-Hellman parameters (this may take a while)..."
    openssl dhparam -out ./dhparam.pem 2048
fi

echo "=========================================="
echo "Certificate setup complete!"
echo "Certificates stored in: $CERT_DIR"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update nginx.conf to point to certificate paths"
echo "2. Test nginx configuration: sudo nginx -t"
echo "3. Reload nginx: sudo systemctl reload nginx"
echo "4. Set up auto-renewal cron job: ./cert-renewal.sh"
echo ""
echo "Verify certificates:"
echo "  openssl x509 -in $CERT_DIR/fullchain.pem -text -noout"
echo ""
echo "Test TLS connection:"
echo "  openssl s_client -connect api.krishiai.com:443 -tls1_3"
