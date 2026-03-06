#!/bin/bash

# Certificate Renewal Script for Let's Encrypt
# Run this script daily via cron to auto-renew certificates

set -e

LOG_FILE="/var/log/krishiai-cert-renewal.log"
CERT_DIR="./certs/production"

echo "=========================================="  | tee -a "$LOG_FILE"
echo "KrishiAI Certificate Renewal Check"        | tee -a "$LOG_FILE"
echo "Date: $(date)"                              | tee -a "$LOG_FILE"
echo "=========================================="  | tee -a "$LOG_FILE"

# Attempt certificate renewal
echo "Checking for certificate renewal..."       | tee -a "$LOG_FILE"
sudo certbot renew --quiet --nginx 2>&1 | tee -a "$LOG_FILE"

# Check if renewal occurred
if [ $? -eq 0 ]; then
    echo "Certificate renewal check completed successfully" | tee -a "$LOG_FILE"
    
    # Copy renewed certificates to local directory
    if [ -f "/etc/letsencrypt/live/krishiai/fullchain.pem" ]; then
        echo "Copying renewed certificates to $CERT_DIR" | tee -a "$LOG_FILE"
        sudo cp /etc/letsencrypt/live/krishiai/fullchain.pem "$CERT_DIR/"
        sudo cp /etc/letsencrypt/live/krishiai/privkey.pem "$CERT_DIR/"
        sudo cp /etc/letsencrypt/live/krishiai/chain.pem "$CERT_DIR/"
        
        # Set proper permissions
        sudo chmod 644 "$CERT_DIR/fullchain.pem"
        sudo chmod 644 "$CERT_DIR/chain.pem"
        sudo chmod 600 "$CERT_DIR/privkey.pem"
        
        # Reload nginx to use new certificates
        echo "Reloading nginx with new certificates..." | tee -a "$LOG_FILE"
        sudo systemctl reload nginx
        
        # Send notification (optional - requires mail setup)
        # echo "Certificates renewed successfully" | mail -s "KrishiAI Certificate Renewal" admin@krishiai.com
        
        echo "Certificate renewal completed successfully" | tee -a "$LOG_FILE"
    fi
else
    echo "Certificate renewal failed or not needed" | tee -a "$LOG_FILE"
fi

# Check certificate expiry
EXPIRY_DATE=$(sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/krishiai/fullchain.pem | cut -d= -f2)
echo "Certificate expires: $EXPIRY_DATE" | tee -a "$LOG_FILE"

# Calculate days until expiry
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

echo "Days until expiry: $DAYS_UNTIL_EXPIRY" | tee -a "$LOG_FILE"

# Alert if expiring soon (less than 30 days)
if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
    echo "WARNING: Certificate expires in less than 30 days!" | tee -a "$LOG_FILE"
    # Send alert (optional - requires mail setup)
    # echo "Certificate expires in $DAYS_UNTIL_EXPIRY days" | mail -s "KrishiAI Certificate Expiry Warning" admin@krishiai.com
fi

echo "=========================================="  | tee -a "$LOG_FILE"
echo ""                                           | tee -a "$LOG_FILE"
