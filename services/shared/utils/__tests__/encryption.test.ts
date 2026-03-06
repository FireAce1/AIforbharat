/**
 * Tests for Data Encryption Utility Module
 * 
 * Tests AES-256-GCM encryption/decryption for PII fields
 */

import {
  encrypt,
  decrypt,
  encryptPhone,
  decryptPhone,
  encryptName,
  decryptName,
  encryptCoordinates,
  decryptCoordinates,
  generateEncryptionKey,
  reencrypt,
  isEncrypted,
  getKeyVersion,
} from '../encryption';

// Set up test encryption key
const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_KEY_V2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('Encryption Utility', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    process.env.ENCRYPTION_KEY_V2 = TEST_KEY_V2;
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY_V2;
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'Test message';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'नमस्ते मराठी 你好 🌾';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error when encrypting empty string', () => {
      expect(() => encrypt('')).toThrow('Cannot encrypt empty value');
    });

    it('should throw error when decrypting empty string', () => {
      expect(() => decrypt('')).toThrow('Cannot decrypt empty value');
    });

    it('should throw error when decrypting invalid format', () => {
      expect(() => decrypt('invalid')).toThrow('Invalid encrypted value format');
    });

    it('should throw error when ENCRYPTION_KEY is not set', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set');

      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should throw error when key length is invalid', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'tooshort';

      expect(() => encrypt('test')).toThrow('Encryption key must be 32 bytes');

      process.env.ENCRYPTION_KEY = originalKey;
    });
  });

  describe('encryptPhone and decryptPhone', () => {
    it('should encrypt and decrypt valid phone number', () => {
      const phone = '+919876543210';
      const encrypted = encryptPhone(phone);
      const decrypted = decryptPhone(encrypted);

      expect(decrypted).toBe(phone);
      expect(encrypted).not.toBe(phone);
    });

    it('should throw error for invalid phone format', () => {
      expect(() => encryptPhone('1234567890')).toThrow('Invalid phone number format');
      expect(() => encryptPhone('+911234567890')).toThrow('Invalid phone number format');
      expect(() => encryptPhone('+9198765432')).toThrow('Invalid phone number format');
      expect(() => encryptPhone('+91987654321012')).toThrow('Invalid phone number format');
    });

    it('should accept all valid starting digits (6-9)', () => {
      const validPhones = ['+916123456789', '+917123456789', '+918123456789', '+919123456789'];

      validPhones.forEach((phone) => {
        const encrypted = encryptPhone(phone);
        const decrypted = decryptPhone(encrypted);
        expect(decrypted).toBe(phone);
      });
    });
  });

  describe('encryptName and decryptName', () => {
    it('should encrypt and decrypt valid name', () => {
      const name = 'Rajesh Kumar';
      const encrypted = encryptName(name);
      const decrypted = decryptName(encrypted);

      expect(decrypted).toBe(name);
      expect(encrypted).not.toBe(name);
    });

    it('should handle names with special characters', () => {
      const name = "O'Brien-Smith";
      const encrypted = encryptName(name);
      const decrypted = decryptName(encrypted);

      expect(decrypted).toBe(name);
    });

    it('should handle unicode names', () => {
      const name = 'राजेश कुमार';
      const encrypted = encryptName(name);
      const decrypted = decryptName(encrypted);

      expect(decrypted).toBe(name);
    });

    it('should throw error for name too short', () => {
      expect(() => encryptName('A')).toThrow('Invalid name. Must be 2-100 characters');
    });

    it('should throw error for name too long', () => {
      const longName = 'A'.repeat(101);
      expect(() => encryptName(longName)).toThrow('Invalid name. Must be 2-100 characters');
    });

    it('should accept name at boundaries', () => {
      const minName = 'AB';
      const maxName = 'A'.repeat(100);

      expect(() => encryptName(minName)).not.toThrow();
      expect(() => encryptName(maxName)).not.toThrow();
    });
  });

  describe('encryptCoordinates and decryptCoordinates', () => {
    it('should encrypt and decrypt valid coordinates', () => {
      const latitude = 19.076;
      const longitude = 72.8777;

      const encrypted = encryptCoordinates(latitude, longitude);
      const decrypted = decryptCoordinates(encrypted);

      expect(decrypted.latitude).toBe(latitude);
      expect(decrypted.longitude).toBe(longitude);
    });

    it('should handle boundary coordinates', () => {
      const testCases = [
        { lat: 90, lon: 180 },
        { lat: -90, lon: -180 },
        { lat: 0, lon: 0 },
      ];

      testCases.forEach(({ lat, lon }) => {
        const encrypted = encryptCoordinates(lat, lon);
        const decrypted = decryptCoordinates(encrypted);

        expect(decrypted.latitude).toBe(lat);
        expect(decrypted.longitude).toBe(lon);
      });
    });

    it('should throw error for invalid latitude', () => {
      expect(() => encryptCoordinates(91, 72)).toThrow('Invalid latitude');
      expect(() => encryptCoordinates(-91, 72)).toThrow('Invalid latitude');
    });

    it('should throw error for invalid longitude', () => {
      expect(() => encryptCoordinates(19, 181)).toThrow('Invalid longitude');
      expect(() => encryptCoordinates(19, -181)).toThrow('Invalid longitude');
    });

    it('should throw error for invalid encrypted coordinates format', () => {
      expect(() => decryptCoordinates('invalid')).toThrow('Invalid encrypted coordinates format');
    });
  });

  describe('key versioning', () => {
    it('should encrypt with specific key version', () => {
      const plaintext = 'Test message';
      const encrypted = encrypt(plaintext, 2);

      expect(getKeyVersion(encrypted)).toBe(2);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it('should decrypt with correct key version automatically', () => {
      const plaintext = 'Test message';
      const encryptedV1 = encrypt(plaintext, 1);
      const encryptedV2 = encrypt(plaintext, 2);

      expect(decrypt(encryptedV1)).toBe(plaintext);
      expect(decrypt(encryptedV2)).toBe(plaintext);
    });

    it('should throw error for invalid key version', () => {
      expect(() => encrypt('test', 0)).toThrow();
      expect(() => encrypt('test', -1)).toThrow();
    });

    it('should throw error when key version not found', () => {
      expect(() => encrypt('test', 99)).toThrow('ENCRYPTION_KEY_V99 environment variable is not set');
    });
  });

  describe('reencrypt', () => {
    it('should re-encrypt with new key version', () => {
      const plaintext = 'Test message';
      const encryptedV1 = encrypt(plaintext, 1);

      expect(getKeyVersion(encryptedV1)).toBe(1);

      const encryptedV2 = reencrypt(encryptedV1, 2);

      expect(getKeyVersion(encryptedV2)).toBe(2);
      expect(decrypt(encryptedV2)).toBe(plaintext);
    });

    it('should maintain data integrity during re-encryption', () => {
      const phone = '+919876543210';
      const encryptedV1 = encryptPhone(phone, 1);
      const encryptedV2 = reencrypt(encryptedV1, 2);

      expect(decryptPhone(encryptedV2)).toBe(phone);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted values', () => {
      const encrypted = encrypt('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plaintext values', () => {
      expect(isEncrypted('plaintext')).toBe(false);
      expect(isEncrypted('+919876543210')).toBe(false);
      expect(isEncrypted('Rajesh Kumar')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for invalid format', () => {
      expect(isEncrypted('1:2:3')).toBe(false);
      expect(isEncrypted('invalid:format:here:now')).toBe(false);
      expect(isEncrypted('0:abc:def:ghi')).toBe(false);
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate valid 256-bit key', () => {
      const key = generateEncryptionKey();

      expect(key).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate different keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate keys that work for encryption', () => {
      const key = generateEncryptionKey();
      process.env.ENCRYPTION_KEY_V3 = key;

      const plaintext = 'Test with generated key';
      const encrypted = encrypt(plaintext, 3);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);

      delete process.env.ENCRYPTION_KEY_V3;
    });
  });

  describe('getKeyVersion', () => {
    it('should return correct key version', () => {
      const encryptedV1 = encrypt('test', 1);
      const encryptedV2 = encrypt('test', 2);

      expect(getKeyVersion(encryptedV1)).toBe(1);
      expect(getKeyVersion(encryptedV2)).toBe(2);
    });

    it('should throw error for empty value', () => {
      expect(() => getKeyVersion('')).toThrow('Cannot get key version from empty value');
    });

    it('should throw error for invalid format', () => {
      expect(() => getKeyVersion('invalid')).toThrow('Invalid encrypted value format');
    });

    it('should throw error for invalid version number', () => {
      expect(() => getKeyVersion('abc:def:ghi:jkl')).toThrow('Invalid key version');
      expect(() => getKeyVersion('0:def:ghi:jkl')).toThrow('Invalid key version');
    });
  });

  describe('authentication tag verification', () => {
    it('should fail decryption if ciphertext is tampered', () => {
      const plaintext = 'Important data';
      const encrypted = encrypt(plaintext);

      // Tamper with the ciphertext part
      const parts = encrypted.split(':');
      parts[3] = parts[3].slice(0, -2) + 'ff'; // Change last byte
      const tampered = parts.join(':');

      expect(() => decrypt(tampered)).toThrow('Decryption failed');
    });

    it('should fail decryption if auth tag is tampered', () => {
      const plaintext = 'Important data';
      const encrypted = encrypt(plaintext);

      // Tamper with the auth tag
      const parts = encrypted.split(':');
      parts[2] = parts[2].slice(0, -2) + 'ff'; // Change last byte of auth tag
      const tampered = parts.join(':');

      expect(() => decrypt(tampered)).toThrow('Decryption failed');
    });

    it('should fail decryption if IV is tampered', () => {
      const plaintext = 'Important data';
      const encrypted = encrypt(plaintext);

      // Tamper with the IV
      const parts = encrypted.split(':');
      parts[1] = parts[1].slice(0, -2) + 'ff'; // Change last byte of IV
      const tampered = parts.join(':');

      expect(() => decrypt(tampered)).toThrow('Decryption failed');
    });
  });

  describe('performance', () => {
    it('should encrypt and decrypt within reasonable time', () => {
      const plaintext = 'Performance test data';
      const iterations = 1000;

      const startEncrypt = Date.now();
      for (let i = 0; i < iterations; i++) {
        encrypt(plaintext);
      }
      const encryptTime = Date.now() - startEncrypt;

      const encrypted = encrypt(plaintext);
      const startDecrypt = Date.now();
      for (let i = 0; i < iterations; i++) {
        decrypt(encrypted);
      }
      const decryptTime = Date.now() - startDecrypt;

      // Should complete 1000 operations in under 1 second each
      expect(encryptTime).toBeLessThan(1000);
      expect(decryptTime).toBeLessThan(1000);
    });
  });
});
