# TLS/HTTPS Configuration

This directory contains TLS/HTTPS configuration for the KrishiAI platform.

## Overview

All API endpoints are configured with TLS 1.3 encryption to ensure secure communication between the mobile app and backend services.

## Certificate Management

### Staging Environment
- Uses Let's Encrypt certificates (free, auto-renewable)
- Certificates stored in `./certs/staging/`
- Auto-renewal via certbot

### Production Environment
- Uses commercial SSL certificates (DigiCert/Sectigo)
- Certificates stored in `./certs/production/`
- Manual renewal process with 90-day reminder

## Configuration Files

- `nginx.conf` - Main NGINX configuration with TLS 1.3
- `ssl-params.conf` - SSL/TLS parameters and security headers
- `certbot-setup.sh` - Script to obtain Let's Encrypt certificates
- `cert-renewal.sh` - Script to renew certificates

## Security Features

1. **TLS 1.3 Only**: Disabled older TLS versions for maximum security
2. **HSTS Headers**: Enabled with max-age=31536000 (1 year)
3. **HTTP to HTTPS Redirect**: All HTTP traffic automatically redirected
4. **Certificate Pinning**: Mobile app pins certificates for added security
5. **Strong Cipher Suites**: Only secure ciphers enabled

## Setup Instructions

### For Staging (Let's Encrypt)

```bash
# Run certbot setup script
cd infrastructure/tls
chmod +x certbot-setup.sh
./certbot-setup.sh staging

# Verify certificates
ls -la certs/staging/
```

### For Production (Commercial Certificates)

```bash
# Place certificates in production directory
cp your-cert.crt certs/production/fullchain.pem
cp your-key.key certs/production/privkey.pem

# Set proper permissions
chmod 600 certs/production/privkey.pem
chmod 644 certs/production/fullchain.pem
```

## Certificate Renewal

### Automatic (Let's Encrypt)

```bash
# Set up cron job for auto-renewal
crontab -e

# Add this line to renew daily at 2 AM
0 2 * * * /path/to/infrastructure/tls/cert-renewal.sh
```

### Manual (Commercial)

1. Receive renewal reminder 30 days before expiry
2. Purchase renewed certificate from provider
3. Replace certificates in `certs/production/`
4. Reload NGINX: `kubectl rollout restart deployment/nginx-ingress`

## Testing

```bash
# Test TLS configuration
openssl s_client -connect api.krishiai.com:443 -tls1_3

# Verify HSTS headers
curl -I https://api.krishiai.com

# Check SSL Labs rating (should be A+)
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=api.krishiai.com
```

## Troubleshooting

### Certificate Not Found
- Verify certificate files exist in correct directory
- Check file permissions (privkey.pem should be 600)
- Verify NGINX configuration points to correct paths

### TLS Handshake Failures
- Ensure TLS 1.3 is supported by client
- Check cipher suite compatibility
- Verify certificate chain is complete

### HSTS Not Working
- Clear browser HSTS cache
- Verify HSTS header in response
- Check max-age value is set correctly
