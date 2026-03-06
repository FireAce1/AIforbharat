/**
 * DPDP Compliance API Routes
 * 
 * Provides endpoints for consent management, data export, and data deletion
 */

import { Router, Request, Response } from 'express';
import { DPDPComplianceService, ConsentType, ConsentStatus } from '../dpdpCompliance';
import { createLogger } from '../../utils/logger';
import { body, param, query, validationResult } from 'express-validator';

const logger = createLogger('compliance-routes');
const router = Router();

/**
 * POST /api/v1/compliance/consent
 * Grant or withdraw consent
 */
router.post(
  '/consent',
  [
    body('consentType')
      .isIn(Object.values(ConsentType))
      .withMessage('Invalid consent type'),
    body('status')
      .isIn(Object.values(ConsentStatus))
      .withMessage('Invalid consent status')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { consentType, status } = req.body;
      const complianceService = new DPDPComplianceService((req as any).db);

      const consent = await complianceService.recordConsent(
        userId,
        consentType,
        status,
        {
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }
      );

      res.json({
        success: true,
        consent: {
          id: consent.id,
          consentType: consent.consentType,
          status: consent.status,
          grantedAt: consent.grantedAt,
          withdrawnAt: consent.withdrawnAt
        }
      });
    } catch (error) {
      logger.error('Failed to record consent', { error });
      res.status(500).json({ error: 'Failed to record consent' });
    }
  }
);

/**
 * GET /api/v1/compliance/consent
 * Get all user consents
 */
router.get('/consent', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const complianceService = new DPDPComplianceService((req as any).db);
    const consents = await complianceService.getAllConsents(userId);

    res.json({
      success: true,
      consents: consents.map(c => ({
        id: c.id,
        consentType: c.consentType,
        status: c.status,
        grantedAt: c.grantedAt,
        withdrawnAt: c.withdrawnAt
      }))
    });
  } catch (error) {
    logger.error('Failed to get consents', { error });
    res.status(500).json({ error: 'Failed to get consents' });
  }
});

/**
 * GET /api/v1/compliance/consent/:type
 * Get specific consent status
 */
router.get(
  '/consent/:type',
  [
    param('type')
      .isIn(Object.values(ConsentType))
      .withMessage('Invalid consent type')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const consentType = req.params.type as ConsentType;
      const complianceService = new DPDPComplianceService((req as any).db);
      const consent = await complianceService.getConsent(userId, consentType);

      if (!consent) {
        return res.json({
          success: true,
          hasConsent: false,
          consent: null
        });
      }

      res.json({
        success: true,
        hasConsent: consent.status === ConsentStatus.GRANTED,
        consent: {
          id: consent.id,
          consentType: consent.consentType,
          status: consent.status,
          grantedAt: consent.grantedAt,
          withdrawnAt: consent.withdrawnAt
        }
      });
    } catch (error) {
      logger.error('Failed to get consent', { error });
      res.status(500).json({ error: 'Failed to get consent' });
    }
  }
);

/**
 * POST /api/v1/compliance/export
 * Request data export (right to data portability)
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const complianceService = new DPDPComplianceService((req as any).db);
    const exportData = await complianceService.exportUserData(userId);

    res.json({
      success: true,
      message: 'Data export completed',
      export: exportData
    });
  } catch (error) {
    logger.error('Failed to export user data', { error });
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

/**
 * POST /api/v1/compliance/delete
 * Request account and data deletion (right to be forgotten)
 */
router.post(
  '/delete',
  [
    body('reason').optional().isString().withMessage('Reason must be a string'),
    body('confirmPhone').isString().withMessage('Phone confirmation required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user?.id;
      const userPhone = (req as any).user?.phone;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { reason, confirmPhone } = req.body;

      // Verify phone number for security
      if (confirmPhone !== userPhone) {
        return res.status(400).json({
          error: 'Phone number confirmation does not match'
        });
      }

      const complianceService = new DPDPComplianceService((req as any).db);
      
      await complianceService.deleteUserData(userId, reason, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({
        success: true,
        message: 'Your account and all associated data have been permanently deleted'
      });
    } catch (error) {
      logger.error('Failed to delete user data', { error });
      res.status(500).json({ error: 'Failed to delete user data' });
    }
  }
);

/**
 * GET /api/v1/compliance/audit-logs
 * Get user's audit logs (transparency)
 */
router.get(
  '/audit-logs',
  [
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const complianceService = new DPDPComplianceService((req as any).db);
      const logs = await complianceService.getAuditLogs(userId, {
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100
      });

      res.json({
        success: true,
        logs: logs.map(log => ({
          id: log.id,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          timestamp: log.timestamp,
          details: log.details
        }))
      });
    } catch (error) {
      logger.error('Failed to get audit logs', { error });
      res.status(500).json({ error: 'Failed to get audit logs' });
    }
  }
);

export default router;
