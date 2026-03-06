/**
 * Certificate Pinning Configuration for KrishiAI Mobile App
 * 
 * Implements certificate pinning to prevent man-in-the-middle attacks
 * by validating the server's SSL certificate against known public keys.
 */

export interface CertificatePinConfig {
  hostname: string;
  publicKeyHashes: string[];
}

/**
 * Certificate pins for KrishiAI API endpoints
 * 
 * Public key hashes are SHA-256 hashes of the certificate's Subject Public Key Info (SPKI)
 * 
 * To generate a pin from a certificate:
 * openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64
 * 
 * IMPORTANT: Update these hashes when certificates are renewed!
 */
export const CERTIFICATE_PINS: CertificatePinConfig[] = [
  {
    hostname: 'api.krishiai.com',
    publicKeyHashes: [
      // Primary certificate pin (current)
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Replace with actual pin
      // Backup certificate pin (for rotation)
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // Replace with actual pin
    ],
  },
  {
    hostname: 'auth.krishiai.com',
    publicKeyHashes: [
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Replace with actual pin
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // Replace with actual pin
    ],
  },
  {
    hostname: 'crop.krishiai.com',
    publicKeyHashes: [
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Replace with actual pin
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // Replace with actual pin
    ],
  },
  {
    hostname: 'market.krishiai.com',
    publicKeyHashes: [
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Replace with actual pin
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // Replace with actual pin
    ],
  },
  {
    hostname: 'climate.krishiai.com',
    publicKeyHashes: [
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Replace with actual pin
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // Replace with actual pin
    ],
  },
  {
    hostname: 'govt.krishiai.com',
    publicKeyHashes: [
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Replace with actual pin
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // Replace with actual pin
    ],
  },
];

/**
 * Certificate pinning configuration for development/staging
 * Disabled in development to allow self-signed certificates
 */
export const ENABLE_CERTIFICATE_PINNING = __DEV__ ? false : true;

/**
 * Get certificate pins for a specific hostname
 */
export const getCertificatePins = (hostname: string): string[] => {
  const config = CERTIFICATE_PINS.find(pin => pin.hostname === hostname);
  return config?.publicKeyHashes || [];
};

/**
 * Validate if certificate pinning is properly configured
 */
export const validateCertificatePinning = (): boolean => {
  if (!ENABLE_CERTIFICATE_PINNING) {
    console.warn('Certificate pinning is disabled in development mode');
    return true;
  }

  // Check if all pins are configured (not placeholder values)
  const hasPlaceholders = CERTIFICATE_PINS.some(config =>
    config.publicKeyHashes.some(hash => hash.startsWith('AAA') || hash.startsWith('BBB'))
  );

  if (hasPlaceholders) {
    console.error('Certificate pins contain placeholder values. Update with actual certificate pins!');
    return false;
  }

  return true;
};

/**
 * Certificate pinning error handler
 */
export const handleCertificatePinningError = (error: any, hostname: string): void => {
  console.error(`Certificate pinning failed for ${hostname}:`, error);
  
  // Log to error tracking service (Sentry)
  if (typeof global.Sentry !== 'undefined') {
    global.Sentry.captureException(error, {
      tags: {
        type: 'certificate_pinning_failure',
        hostname,
      },
    });
  }
  
  // In production, this should prevent the connection
  // In development, we can allow it to proceed with a warning
  if (!__DEV__) {
    throw new Error(`Certificate pinning validation failed for ${hostname}. Connection blocked for security.`);
  }
};
