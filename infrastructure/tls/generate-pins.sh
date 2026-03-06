#!/bin/bash

# Generate Certificate Pins for Mobile App
# Extracts SHA-256 hashes of certificate public keys for certificate pinning

set -e

CERT_FILE=${1:-"./certs/production/fullchain.pem"}
BACKUP_CERT_FILE=${2:-"./certs/production/backup-fullchain.pem"}

echo "=========================================="
echo "Certificate Pin Generator for KrishiAI"
echo "=========================================="
echo ""

if [ ! -f "$CERT_FILE" ]; then
    echo "Error: Certificate file not found: $CERT_FILE"
    echo "Usage: ./generate-pins.sh <cert-file> [backup-cert-file]"
    exit 1
fi

echo "Generating pin from certificate: $CERT_FILE"
echo ""

# Extract public key and generate SHA-256 hash
PRIMARY_PIN=$(openssl x509 -in "$CERT_FILE" -pubkey -noout | \
    openssl pkey -pubin -outform der | \
    openssl dgst -sha256 -binary | \
    openssl enc -base64)

echo "Primary Certificate Pin:"
echo "  $PRIMARY_PIN"
echo ""

# Generate backup pin if backup certificate exists
if [ -f "$BACKUP_CERT_FILE" ]; then
    echo "Generating pin from backup certificate: $BACKUP_CERT_FILE"
    BACKUP_PIN=$(openssl x509 -in "$BACKUP_CERT_FILE" -pubkey -noout | \
        openssl pkey -pubin -outform der | \
        openssl dgst -sha256 -binary | \
        openssl enc -base64)
    
    echo "Backup Certificate Pin:"
    echo "  $BACKUP_PIN"
    echo ""
else
    echo "No backup certificate found. Using primary pin as backup."
    BACKUP_PIN=$PRIMARY_PIN
    echo ""
fi

# Display certificate information
echo "Certificate Information:"
openssl x509 -in "$CERT_FILE" -noout -subject -issuer -dates
echo ""

# Generate configuration snippets
echo "=========================================="
echo "Configuration Updates Required"
echo "=========================================="
echo ""

echo "1. Update mobile/krishiai-app/src/config/certificatePinning.ts:"
echo ""
echo "  publicKeyHashes: ["
echo "    '$PRIMARY_PIN', // Primary"
echo "    '$BACKUP_PIN',  // Backup"
echo "  ],"
echo ""

echo "2. Update mobile/krishiai-app/android/app/src/main/res/xml/network_security_config.xml:"
echo ""
echo "  <pin-set expiration=\"$(date -d '+1 year' +%Y-%m-%d)\">"
echo "    <pin digest=\"SHA-256\">$PRIMARY_PIN</pin>"
echo "    <pin digest=\"SHA-256\">$BACKUP_PIN</pin>"
echo "  </pin-set>"
echo ""

echo "3. Rebuild mobile app after updating pins:"
echo "  cd mobile/krishiai-app"
echo "  npm run android"
echo ""

echo "=========================================="
echo "Certificate Pin Generation Complete"
echo "=========================================="
echo ""
echo "IMPORTANT NOTES:"
echo "- Update pins in both certificatePinning.ts and network_security_config.xml"
echo "- Keep backup pin from previous certificate during rotation"
echo "- Test thoroughly before deploying to production"
echo "- Update pins before certificate expiry (30 days notice)"
echo ""
