/**
 * DPDP Act 2023 Compliance Module
 * 
 * Implements Digital Personal Data Protection Act 2023 requirements:
 * - User consent management
 * - Right to be forgotten (data deletion)
 * - Data minimization
 * - Audit logging
 * - Data export functionality
 */

import { Pool } from 'pg';
import { createLogger } from '../utils/logger';
import { encrypt, decrypt } from '../utils/encryption';

const logger = createLogger('dpdp-compliance');

export enum ConsentType {
  DATA_COLLECTION = 'data_collection',
  DATA_PROCESSING = 'data_processing',
  DATA_SHARING = 'data_sharing',
  MARKETING = 'marketing',
  ANALYTICS = 'analytics'
}

export enum ConsentStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  WITHDRAWN = 'withdrawn'
}

export enum AuditAction {
  READ = 'read',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  EXPORT = 'export',
  CONSENT_CHANGE = 'consent_change'
}

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: ConsentType;
  status: ConsentStatus;
  grantedAt?: Date;
  withdrawnAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  details?: any;
}

export class DPDPComplianceService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Record user consent for data processing
   */
  async recordConsent(
    userId: string,
    consentType: ConsentType,
    status: ConsentStatus,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<ConsentRecord> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Insert consent record
      const result = await client.query(
        `INSERT INTO user_consents 
         (user_id, consent_type, status, granted_at, withdrawn_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          userId,
          consentType,
          status,
          status === ConsentStatus.GRANTED ? new Date() : null,
          status === ConsentStatus.WITHDRAWN ? new Date() : null,
          metadata?.ipAddress,
          metadata?.userAgent
        ]
      );

      // Log the consent change
      await this.logAudit({
        userId,
        action: AuditAction.CONSENT_CHANGE,
        resourceType: 'consent',
        resourceId: result.rows[0].id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        timestamp: new Date(),
        details: { consentType, status }
      });

      await client.query('COMMIT');

      logger.info('Consent recorded', { userId, consentType, status });

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to record consent', { error, userId, consentType });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's current consent status
   */
  async getConsent(userId: string, consentType: ConsentType): Promise<ConsentRecord | null> {
    const result = await this.db.query(
      `SELECT * FROM user_consents 
       WHERE user_id = $1 AND consent_type = $2 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId, consentType]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all consents for a user
   */
  async getAllConsents(userId: string): Promise<ConsentRecord[]> {
    const result = await this.db.query(
      `SELECT DISTINCT ON (consent_type) *
       FROM user_consents 
       WHERE user_id = $1 
       ORDER BY consent_type, created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Withdraw consent (user can revoke consent at any time)
   */
  async withdrawConsent(
    userId: string,
    consentType: ConsentType,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    await this.recordConsent(userId, consentType, ConsentStatus.WITHDRAWN, metadata);
    logger.info('Consent withdrawn', { userId, consentType });
  }

  /**
   * Check if user has granted specific consent
   */
  async hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
    const consent = await this.getConsent(userId, consentType);
    return consent?.status === ConsentStatus.GRANTED;
  }

  /**
   * Log audit trail for data access and modifications
   */
  async logAudit(entry: Omit<AuditLogEntry, 'id'>): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO audit_logs 
         (user_id, action, resource_type, resource_id, ip_address, user_agent, timestamp, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.userId,
          entry.action,
          entry.resourceType,
          entry.resourceId,
          entry.ipAddress,
          entry.userAgent,
          entry.timestamp,
          JSON.stringify(entry.details)
        ]
      );
    } catch (error) {
      logger.error('Failed to log audit entry', { error, entry });
      // Don't throw - audit logging should not break main functionality
    }
  }

  /**
   * Export all user data (DPDP Act right to data portability)
   */
  async exportUserData(userId: string): Promise<any> {
    const client = await this.db.connect();

    try {
      // Log the export action
      await this.logAudit({
        userId,
        action: AuditAction.EXPORT,
        resourceType: 'user_data',
        timestamp: new Date(),
        details: { exportType: 'full' }
      });

      // Collect all user data from various tables
      const userData: any = {};

      // User profile
      const userResult = await client.query(
        'SELECT id, phone, name, language, created_at, last_active FROM users WHERE id = $1',
        [userId]
      );
      userData.profile = userResult.rows[0];

      // Farms
      const farmsResult = await client.query(
        'SELECT * FROM farms WHERE user_id = $1',
        [userId]
      );
      userData.farms = farmsResult.rows;

      // Crops
      const cropsResult = await client.query(
        `SELECT c.* FROM crops c 
         JOIN farms f ON c.farm_id = f.id 
         WHERE f.user_id = $1`,
        [userId]
      );
      userData.crops = cropsResult.rows;

      // Disease detections
      const detectionsResult = await client.query(
        `SELECT d.* FROM disease_detections d
         JOIN crops c ON d.crop_id = c.id
         JOIN farms f ON c.farm_id = f.id
         WHERE f.user_id = $1`,
        [userId]
      );
      userData.diseaseDetections = detectionsResult.rows;

      // Consents
      const consentsResult = await client.query(
        'SELECT * FROM user_consents WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      userData.consents = consentsResult.rows;

      // Audit logs (last 90 days)
      const auditResult = await client.query(
        `SELECT * FROM audit_logs 
         WHERE user_id = $1 AND timestamp > NOW() - INTERVAL '90 days'
         ORDER BY timestamp DESC`,
        [userId]
      );
      userData.auditLogs = auditResult.rows;

      logger.info('User data exported', { userId });

      return {
        exportDate: new Date().toISOString(),
        userId,
        data: userData
      };
    } finally {
      client.release();
    }
  }

  /**
   * Delete all user data (DPDP Act right to be forgotten)
   * This is a hard delete that removes all personal data
   */
  async deleteUserData(
    userId: string,
    reason?: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Log the deletion request before deleting
      await this.logAudit({
        userId,
        action: AuditAction.DELETE,
        resourceType: 'user_account',
        timestamp: new Date(),
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        details: { reason, deletionType: 'full' }
      });

      // Delete in reverse order of dependencies
      
      // 1. Disease detections
      await client.query(
        `DELETE FROM disease_detections 
         WHERE crop_id IN (
           SELECT c.id FROM crops c
           JOIN farms f ON c.farm_id = f.id
           WHERE f.user_id = $1
         )`,
        [userId]
      );

      // 2. Crops
      await client.query(
        `DELETE FROM crops 
         WHERE farm_id IN (
           SELECT id FROM farms WHERE user_id = $1
         )`,
        [userId]
      );

      // 3. Farms
      await client.query('DELETE FROM farms WHERE user_id = $1', [userId]);

      // 4. Price alerts
      await client.query('DELETE FROM price_alerts WHERE user_id = $1', [userId]);

      // 5. Scheme subscriptions
      await client.query('DELETE FROM scheme_subscriptions WHERE user_id = $1', [userId]);

      // 6. Chatbot conversations
      await client.query('DELETE FROM chatbot_conversations WHERE user_id = $1', [userId]);

      // 7. User consents
      await client.query('DELETE FROM user_consents WHERE user_id = $1', [userId]);

      // 8. OTP codes
      await client.query('DELETE FROM otp_codes WHERE phone = (SELECT phone FROM users WHERE id = $1)', [userId]);

      // 9. Anonymize audit logs (keep for compliance but remove PII)
      await client.query(
        `UPDATE audit_logs 
         SET user_id = 'deleted_user', 
             ip_address = NULL, 
             user_agent = NULL,
             details = jsonb_set(details, '{anonymized}', 'true')
         WHERE user_id = $1`,
        [userId]
      );

      // 10. Finally, delete user account
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      await client.query('COMMIT');

      logger.info('User data deleted successfully', { userId, reason });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to delete user data', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Anonymize user data (soft delete - keeps data for analytics but removes PII)
   */
  async anonymizeUserData(userId: string): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Log the anonymization
      await this.logAudit({
        userId,
        action: AuditAction.DELETE,
        resourceType: 'user_account',
        timestamp: new Date(),
        details: { deletionType: 'anonymization' }
      });

      // Anonymize user profile
      await client.query(
        `UPDATE users 
         SET phone = 'anonymized_' || id,
             name = 'Anonymized User',
             last_active = NULL
         WHERE id = $1`,
        [userId]
      );

      // Anonymize audit logs
      await client.query(
        `UPDATE audit_logs 
         SET ip_address = NULL, 
             user_agent = NULL
         WHERE user_id = $1`,
        [userId]
      );

      await client.query('COMMIT');

      logger.info('User data anonymized', { userId });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to anonymize user data', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get audit logs for a user (for transparency)
   */
  async getAuditLogs(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      action?: AuditAction;
      limit?: number;
    }
  ): Promise<AuditLogEntry[]> {
    let query = 'SELECT * FROM audit_logs WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options?.startDate) {
      query += ` AND timestamp >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options?.endDate) {
      query += ` AND timestamp <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    if (options?.action) {
      query += ` AND action = $${paramIndex}`;
      params.push(options.action);
      paramIndex++;
    }

    query += ' ORDER BY timestamp DESC';

    if (options?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Validate data minimization - ensure only necessary data is collected
   */
  validateDataMinimization(data: any, allowedFields: string[]): any {
    const minimizedData: any = {};
    
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        minimizedData[field] = data[field];
      }
    }

    return minimizedData;
  }
}
