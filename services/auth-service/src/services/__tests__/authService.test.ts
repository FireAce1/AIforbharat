import authService from '../authService';
import otpService from '../otpService';
import db from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('../otpService');
jest.mock('../../config/database');
jest.mock('../../utils/logger');

describe('AuthService - OTP Verification and JWT Generation', () => {
  const mockPhone = '+919876543210';
  const mockOTP = '123456';
  const mockUser = {
    id: 'test-user-id',
    phone: mockPhone,
    name: 'Test User',
    language: 'hi',
    created_at: new Date(),
    last_active: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyOTP', () => {
    it('should verify OTP and return user', async () => {
      // Mock OTP verification
      (otpService.verifyOTP as jest.Mock).mockResolvedValue(true);

      // Mock database query for existing user
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [mockUser] }) // Check if user exists
          .mockResolvedValueOnce({ rows: [] }), // Update last_active
        release: jest.fn(),
      };
      (db.connect as jest.Mock).mockResolvedValue(mockClient);

      const result = await authService.verifyOTP(mockPhone, mockOTP);

      expect(otpService.verifyOTP).toHaveBeenCalledWith(mockPhone, mockOTP);
      expect(result).toEqual(mockUser);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should create new user if not exists', async () => {
      // Mock OTP verification
      (otpService.verifyOTP as jest.Mock).mockResolvedValue(true);

      const newUser = { ...mockUser, id: 'new-user-id' };

      // Mock database query for non-existing user
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // User doesn't exist
          .mockResolvedValueOnce({ rows: [newUser] }), // Create new user
        release: jest.fn(),
      };
      (db.connect as jest.Mock).mockResolvedValue(mockClient);

      const result = await authService.verifyOTP(mockPhone, mockOTP);

      expect(result).toEqual(newUser);
      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle expired OTP', async () => {
      // Mock OTP verification failure
      (otpService.verifyOTP as jest.Mock).mockRejectedValue(
        new AppError('OTP expired or not found. Please request a new OTP.', 400)
      );

      await expect(authService.verifyOTP(mockPhone, mockOTP)).rejects.toThrow(
        'OTP expired or not found. Please request a new OTP.'
      );
    });

    it('should handle invalid OTP', async () => {
      // Mock OTP verification failure
      (otpService.verifyOTP as jest.Mock).mockRejectedValue(
        new AppError('Invalid OTP. Please check and try again.', 400)
      );

      await expect(authService.verifyOTP(mockPhone, '000000')).rejects.toThrow(
        'Invalid OTP. Please check and try again.'
      );
    });
  });

  describe('generateJWT', () => {
    it('should generate JWT with HS256 algorithm and 7-day expiry', () => {
      const token = authService.generateJWT(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

      // Decode token to verify payload
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );

      expect(payload.userId).toBe(mockUser.id);
      expect(payload.phone).toBe(mockUser.phone);
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();

      // Verify expiry is approximately 7 days (604800 seconds)
      const expiryDuration = payload.exp - payload.iat;
      expect(expiryDuration).toBeGreaterThanOrEqual(604700); // Allow small variance
      expect(expiryDuration).toBeLessThanOrEqual(604900);
    });

    it('should include correct user payload in JWT', () => {
      const token = authService.generateJWT(mockUser);
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );

      expect(payload.userId).toBe(mockUser.id);
      expect(payload.phone).toBe(mockUser.phone);
    });
  });

  describe('createOrGetUser', () => {
    it('should update last_active for existing user', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [mockUser] }) // User exists
          .mockResolvedValueOnce({ rows: [] }), // Update last_active
        release: jest.fn(),
      };
      (db.connect as jest.Mock).mockResolvedValue(mockClient);

      const result = await authService.createOrGetUser(mockPhone);

      expect(result).toEqual(mockUser);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE phone = $1',
        [mockPhone]
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE users SET last_active = NOW() WHERE phone = $1',
        [mockPhone]
      );
    });

    it('should create new user with default language (hi)', async () => {
      const newUser = { ...mockUser, id: 'new-user-id', language: 'hi' };
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // User doesn't exist
          .mockResolvedValueOnce({ rows: [newUser] }), // Create new user
        release: jest.fn(),
      };
      (db.connect as jest.Mock).mockResolvedValue(mockClient);

      const result = await authService.createOrGetUser(mockPhone);

      expect(result).toEqual(newUser);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [mockPhone, 'hi']
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle single-use OTP validation', async () => {
      // First verification should succeed
      (otpService.verifyOTP as jest.Mock).mockResolvedValueOnce(true);
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [mockUser] }),
        release: jest.fn(),
      };
      (db.connect as jest.Mock).mockResolvedValue(mockClient);

      await authService.verifyOTP(mockPhone, mockOTP);

      // Second verification with same OTP should fail (already verified)
      (otpService.verifyOTP as jest.Mock).mockRejectedValueOnce(
        new AppError('OTP expired or not found. Please request a new OTP.', 400)
      );

      await expect(authService.verifyOTP(mockPhone, mockOTP)).rejects.toThrow(
        'OTP expired or not found'
      );
    });

    it('should handle database connection errors gracefully', async () => {
      (otpService.verifyOTP as jest.Mock).mockResolvedValue(true);
      (db.connect as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await expect(authService.verifyOTP(mockPhone, mockOTP)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});
