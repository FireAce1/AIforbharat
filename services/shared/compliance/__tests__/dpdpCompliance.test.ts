/**
 * DPDP Compliance Service Tests
 */

import { Pool } from 'pg';
import { DPDPComplianceService, ConsentType, ConsentStatus, AuditAction } from '../dpdpCompliance';

// Mock database
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockRelease = jest.fn();

const mockClient = {
  query: mockQuery,
  release: mockRelease
};

const mockPool = {
  connect: mockConnect,
  query: mockQuery
} as unknown as Pool;

describe('DPDPComplianceService', () => {
  let service: DPDPComplianceService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(mockClient);
    service = new DPDPComplianceService(mockPool);
  });

  describe('recordConsent', () => {
    it('should record user consent successfully', async () => {
      const userId = 'user-123';
      const consentType = ConsentType.DATA_COLLECTION;
      const status = ConsentStatus.GRANTED;

      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'consent-123',
          user_id: userId,
          consent_type: consentType,
          status,
          granted_at: new Date(),
          withdrawn_at: null
        }]
      }); // INSERT consent
      mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT audit log
      mockQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.recordConsent(userId, consentType, status, {
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent'
      });

      expect(result.userId).toBe(userId);
      expect(result.consentType).toBe(consentType);
      expect(result.status).toBe(status);
      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on error', async () => {
      const userId = 'user-123';
      const consentType = ConsentType.DATA_COLLECTION;
      const status = ConsentStatus.GRANTED;

      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockQuery.mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      await expect(
        service.recordConsent(userId, consentType, status)
      ).rejects.toThrow('Database error');

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getConsent', () => {
    it('should retrieve user consent', async () => {
      const userId = 'user-123';
      const consentType = ConsentType.DATA_PROCESSING;

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'consent-123',
          user_id: userId,
          consent_type: consentType,
          status: ConsentStatus.GRANTED,
          granted_at: new Date()
        }]
      });

      const result = await service.getConsent(userId, consentType);

      expect(result).toBeDefined();
      expect(result?.consentType).toBe(consentType);
      expect(result?.status).toBe(ConsentStatus.GRANTED);
    });

    it('should return null if consent not found', async () => {
      const userId = 'user-123';
      const consentType = ConsentType.MARKETING;

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getConsent(userId, consentType);

      expect(result).toBeNull();
    });
  });

  describe('hasConsent', () => {
    it('should return true if consent is granted', async () => {
      const userId = 'user-123';
      const consentType = ConsentType.ANALYTICS;

      mockQuery.mockResolvedValueOnce({
        rows: [{
          status: ConsentStatus.GRANTED
        }]
      });

      const result = await service.hasConsent(userId, consentType);

      expect(result).toBe(true);
    });

    it('should return false if consent is withdrawn', async () => {
      const userId = 'user-123';
      const consentType = ConsentType.ANALYTICS;

      mockQuery.mockResolvedValueOnce({
        rows: [{
          status: ConsentStatus.WITHDRAWN
        }]
      });

      const result = await service.hasConsent(userId, consentType);

      expect(result).toBe(false);
    });

    it('should return false if consent not found', async () => {
      const userId = 'user-123';
      const consentType = ConsentType.ANALYTICS;

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.hasConsent(userId, consentType);

      expect(result).toBe(false);
    });
  });

  describe('exportUserData', () => {
    it('should export all user data', async () => {
      const userId = 'user-123';

      // Mock all data queries
      mockQuery.mockResolvedValueOnce({ rows: [] }); // audit log
      mockQuery.mockResolvedValueOnce({ rows: [{ id: userId, phone: '+911234567890' }] }); // user
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'farm-1' }] }); // farms
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'crop-1' }] }); // crops
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'detection-1' }] }); // detections
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'consent-1' }] }); // consents
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'audit-1' }] }); // audit logs

      const result = await service.exportUserData(userId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.data).toBeDefined();
      expect(result.data.profile).toBeDefined();
      expect(result.data.farms).toBeDefined();
      expect(result.data.crops).toBeDefined();
    });
  });

  describe('deleteUserData', () => {
    it('should delete all user data', async () => {
      const userId = 'user-123';
      const reason = 'No longer needed';

      mockQuery.mockResolvedValue({ rows: [] });

      await service.deleteUserData(userId, reason, {
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent'
      });

      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
      // Should delete from multiple tables
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM disease_detections'),
        expect.any(Array)
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM users'),
        expect.any(Array)
      );
    });

    it('should rollback on deletion error', async () => {
      const userId = 'user-123';

      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [] }); // audit log
      mockQuery.mockRejectedValueOnce(new Error('Deletion failed')); // DELETE fails

      await expect(
        service.deleteUserData(userId)
      ).rejects.toThrow('Deletion failed');

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('logAudit', () => {
    it('should log audit entry', async () => {
      const entry = {
        userId: 'user-123',
        action: AuditAction.READ,
        resourceType: 'farm',
        resourceId: 'farm-123',
        timestamp: new Date()
      };

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.logAudit(entry);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          entry.userId,
          entry.action,
          entry.resourceType,
          entry.resourceId
        ])
      );
    });

    it('should not throw on audit logging failure', async () => {
      const entry = {
        userId: 'user-123',
        action: AuditAction.READ,
        resourceType: 'farm',
        timestamp: new Date()
      };

      mockQuery.mockRejectedValueOnce(new Error('Audit log failed'));

      // Should not throw
      await expect(service.logAudit(entry)).resolves.not.toThrow();
    });
  });

  describe('validateDataMinimization', () => {
    it('should only include allowed fields', () => {
      const data = {
        name: 'John Doe',
        phone: '+911234567890',
        email: 'john@example.com',
        ssn: '123-45-6789'
      };

      const allowedFields = ['name', 'phone'];

      const result = service.validateDataMinimization(data, allowedFields);

      expect(result).toEqual({
        name: 'John Doe',
        phone: '+911234567890'
      });
      expect(result.email).toBeUndefined();
      expect(result.ssn).toBeUndefined();
    });

    it('should handle missing fields', () => {
      const data = {
        name: 'John Doe'
      };

      const allowedFields = ['name', 'phone', 'email'];

      const result = service.validateDataMinimization(data, allowedFields);

      expect(result).toEqual({
        name: 'John Doe'
      });
    });
  });
});
