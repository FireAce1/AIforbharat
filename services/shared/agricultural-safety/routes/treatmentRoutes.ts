/**
 * Treatment Routes - API endpoints for agricultural safety standards
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { TreatmentService } from '../treatmentService';
import {
  TreatmentRecommendation,
  AgronomistReview,
  ReviewStatus,
  generateTreatmentDisclaimer
} from '../treatmentReview';

export function createTreatmentRoutes(db: Pool): Router {
  const router = Router();
  const treatmentService = new TreatmentService(db);

  /**
   * GET /api/v1/treatments/disease/:diseaseId
   * Get approved treatments for a disease (organic first)
   */
  router.get('/disease/:diseaseId', async (req: Request, res: Response) => {
    try {
      const { diseaseId } = req.params;
      const { includeChemical = 'true' } = req.query;

      let treatments: TreatmentRecommendation[];

      if (includeChemical === 'false') {
        // Only organic alternatives
        treatments = await treatmentService.getOrganicTreatments(diseaseId);
      } else {
        // All approved treatments (organic first)
        treatments = await treatmentService.getTreatmentsForDisease(diseaseId, true);
      }

      res.json({
        success: true,
        data: {
          diseaseId,
          treatmentCount: treatments.length,
          organicCount: treatments.filter(t => 
            ['ORGANIC', 'BIOLOGICAL', 'CULTURAL'].includes(t.treatmentType)
          ).length,
          chemicalCount: treatments.filter(t => t.treatmentType === 'CHEMICAL').length,
          treatments
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/treatments/organic/:diseaseId
   * Get only organic alternatives for a disease
   */
  router.get('/organic/:diseaseId', async (req: Request, res: Response) => {
    try {
      const { diseaseId } = req.params;
      const treatments = await treatmentService.getOrganicTreatments(diseaseId);

      res.json({
        success: true,
        data: {
          diseaseId,
          organicTreatments: treatments
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/v1/treatments/submit
   * Submit a new treatment recommendation for agronomist review
   * Requires: AGRONOMIST or ADMIN role
   */
  router.post('/submit', async (req: Request, res: Response) => {
    try {
      const treatment = req.body;

      // Validate required fields
      const requiredFields = [
        'diseaseId', 'diseaseName', 'diseaseNameLocal', 'cropName', 'severity',
        'treatmentType', 'treatmentName', 'treatmentNameLocal',
        'description', 'descriptionLocal', 'priority',
        'applicationMethod', 'applicationMethodLocal',
        'frequency', 'frequencyLocal', 'duration', 'durationLocal',
        'safetyPrecautions', 'safetyPrecautionsLocal'
      ];

      for (const field of requiredFields) {
        if (!treatment[field]) {
          return res.status(400).json({
            success: false,
            error: `Missing required field: ${field}`
          });
        }
      }

      const result = await treatmentService.submitTreatmentRecommendation(treatment);

      res.status(201).json({
        success: true,
        message: 'Treatment submitted for agronomist review',
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/treatments/pending
   * Get all pending treatments for review
   * Requires: AGRONOMIST or ADMIN role
   */
  router.get('/pending', async (req: Request, res: Response) => {
    try {
      const treatments = await treatmentService.getPendingTreatments();

      res.json({
        success: true,
        data: {
          pendingCount: treatments.length,
          treatments
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/v1/treatments/review
   * Submit agronomist review for a treatment
   * Requires: AGRONOMIST or ADMIN role
   */
  router.post('/review', async (req: Request, res: Response) => {
    try {
      const review: Omit<AgronomistReview, 'id' | 'createdAt' | 'updatedAt'> = req.body;

      // Validate required fields
      const requiredFields = [
        'treatmentId', 'agronomistId', 'agronomistName', 'agronomistCredentials',
        'status', 'comments', 'commentsLocal',
        'organicPriorityVerified', 'legalComplianceVerified',
        'dosageVerified', 'safetyVerified'
      ];

      for (const field of requiredFields) {
        if (review[field as keyof typeof review] === undefined) {
          return res.status(400).json({
            success: false,
            error: `Missing required field: ${field}`
          });
        }
      }

      // Validate all criteria are verified for approval
      if (review.status === ReviewStatus.APPROVED) {
        if (!review.organicPriorityVerified || !review.legalComplianceVerified ||
            !review.dosageVerified || !review.safetyVerified) {
          return res.status(400).json({
            success: false,
            error: 'All verification criteria must be met for approval'
          });
        }
      }

      const result = await treatmentService.submitAgronomistReview(review);

      res.status(201).json({
        success: true,
        message: `Treatment ${review.status.toLowerCase()}`,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/treatments/:treatmentId/history
   * Get review history for a treatment
   */
  router.get('/:treatmentId/history', async (req: Request, res: Response) => {
    try {
      const { treatmentId } = req.params;
      const history = await treatmentService.getReviewHistory(treatmentId);

      res.json({
        success: true,
        data: {
          treatmentId,
          reviewCount: history.length,
          reviews: history
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/treatments/disclaimer
   * Get treatment disclaimer text in specified language
   */
  router.get('/disclaimer', (req: Request, res: Response) => {
    const { language = 'en' } = req.query;
    const validLanguages = ['en', 'hi', 'mr'];

    if (!validLanguages.includes(language as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid language. Supported: en, hi, mr'
      });
    }

    const disclaimer = generateTreatmentDisclaimer(language as 'en' | 'hi' | 'mr');

    res.json({
      success: true,
      data: {
        language,
        disclaimer
      }
    });
  });

  /**
   * GET /api/v1/treatments/pesticides
   * Get all pesticide legal limits
   */
  router.get('/pesticides', async (req: Request, res: Response) => {
    try {
      const limits = await treatmentService.getAllPesticideLimits();

      res.json({
        success: true,
        data: {
          count: limits.length,
          pesticides: limits
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/treatments/pesticides/:registrationNumber
   * Get pesticide legal limit by registration number
   */
  router.get('/pesticides/:registrationNumber', async (req: Request, res: Response) => {
    try {
      const { registrationNumber } = req.params;
      const limit = await treatmentService.getPesticideLegalLimit(registrationNumber);

      if (!limit) {
        return res.status(404).json({
          success: false,
          error: 'Pesticide not found'
        });
      }

      res.json({
        success: true,
        data: limit
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
