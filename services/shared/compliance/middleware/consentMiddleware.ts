/**
 * Consent Middleware
 * 
 * Ensures user has granted necessary consent before processing requests
 */

import { Request, Response, NextFunction } from 'express';
import { DPDPComplianceService, ConsentType } from '../dpdpCompliance';
import { createLogger } from '../../utils/logger';

const logger = createLogger('consent-middleware');

export interface ConsentRequirement {
  type: ConsentType;
  required: boolean;
}

/**
 * Middleware to check if user has granted required consent
 */
export const requireConsent = (consentType: ConsentType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required'
        });
      }

      const complianceService = new DPDPComplianceService((req as any).db);
      const hasConsent = await complianceService.hasConsent(userId, consentType);

      if (!hasConsent) {
        logger.warn('Consent not granted', { userId, consentType });
        
        return res.status(403).json({
          error: 'Consent Required',
          message: `You must grant ${consentType} consent to use this feature`,
          consentType,
          code: 'CONSENT_REQUIRED'
        });
      }

      next();
    } catch (error) {
      logger.error('Consent check failed', { error });
      next(error);
    }
  };
};

/**
 * Middleware to check multiple consent requirements
 */
export const requireMultipleConsents = (consentTypes: ConsentType[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required'
        });
      }

      const complianceService = new DPDPComplianceService((req as any).db);
      const missingConsents: ConsentType[] = [];

      for (const consentType of consentTypes) {
        const hasConsent = await complianceService.hasConsent(userId, consentType);
        if (!hasConsent) {
          missingConsents.push(consentType);
        }
      }

      if (missingConsents.length > 0) {
        logger.warn('Multiple consents not granted', { userId, missingConsents });
        
        return res.status(403).json({
          error: 'Consents Required',
          message: 'You must grant the required consents to use this feature',
          missingConsents,
          code: 'CONSENTS_REQUIRED'
        });
      }

      next();
    } catch (error) {
      logger.error('Multiple consent check failed', { error });
      next(error);
    }
  };
};

/**
 * Middleware to log data access for audit trail
 */
export const auditDataAccess = (resourceType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return next();
      }

      const complianceService = new DPDPComplianceService((req as any).db);
      
      // Determine action from HTTP method
      let action;
      switch (req.method) {
        case 'GET':
          action = 'read';
          break;
        case 'POST':
          action = 'create';
          break;
        case 'PUT':
        case 'PATCH':
          action = 'update';
          break;
        case 'DELETE':
          action = 'delete';
          break;
        default:
          action = 'read';
      }

      // Log the access
      await complianceService.logAudit({
        userId,
        action: action as any,
        resourceType,
        resourceId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        timestamp: new Date(),
        details: {
          method: req.method,
          path: req.path,
          query: req.query
        }
      });

      next();
    } catch (error) {
      logger.error('Audit logging failed', { error });
      // Don't block request if audit logging fails
      next();
    }
  };
};
