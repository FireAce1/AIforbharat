/**
 * Treatment Service - Business logic for agricultural safety standards
 */

import { Pool } from 'pg';
import {
  TreatmentRecommendation,
  AgronomistReview,
  PesticideLegalLimit,
  ReviewStatus,
  TreatmentType,
  validateTreatmentPriority,
  validatePesticideLegalCompliance,
  sortTreatmentsByPriority,
  getApprovedTreatments,
  getOrganicAlternatives
} from './treatmentReview';

export class TreatmentService {
  constructor(private db: Pool) {}

  /**
   * Submit a new treatment recommendation for review
   */
  async submitTreatmentRecommendation(
    treatment: Omit<TreatmentRecommendation, 'id' | 'createdAt' | 'updatedAt' | 'reviewStatus'>
  ): Promise<TreatmentRecommendation> {
    // Validate treatment priority
    const validation = validateTreatmentPriority(treatment as TreatmentRecommendation);
    if (!validation.valid) {
      throw new Error(`Invalid treatment priority: ${validation.error}`);
    }

    // If chemical treatment, validate against legal limits
    if (treatment.treatmentType === TreatmentType.CHEMICAL && treatment.registrationNumber) {
      const legalLimit = await this.getPesticideLegalLimit(treatment.registrationNumber);
      if (legalLimit) {
        const compliance = validatePesticideLegalCompliance(
          treatment as TreatmentRecommendation,
          legalLimit,
          treatment.cropName
        );
        if (!compliance.compliant) {
          throw new Error(`Legal compliance violations: ${compliance.violations.join(', ')}`);
        }
      }
    }

    const result = await this.db.query(
      `INSERT INTO treatment_recommendations (
        disease_id, disease_name, disease_name_local, crop_name, severity,
        treatment_type, treatment_name, treatment_name_local, description, description_local,
        priority, priority_category,
        dosage, dosage_local, application_method, application_method_local,
        frequency, frequency_local, duration, duration_local,
        safety_precautions, safety_precautions_local, waiting_period, waiting_period_local,
        is_legally_approved, legal_usage_limit, legal_usage_limit_local, registration_number,
        review_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
      ) RETURNING *`,
      [
        treatment.diseaseId, treatment.diseaseName, treatment.diseaseNameLocal,
        treatment.cropName, treatment.severity, treatment.treatmentType,
        treatment.treatmentName, treatment.treatmentNameLocal,
        treatment.description, treatment.descriptionLocal,
        treatment.priority, treatment.priorityCategory,
        treatment.dosage, treatment.dosageLocal,
        treatment.applicationMethod, treatment.applicationMethodLocal,
        treatment.frequency, treatment.frequencyLocal,
        treatment.duration, treatment.durationLocal,
        JSON.stringify(treatment.safetyPrecautions),
        JSON.stringify(treatment.safetyPrecautionsLocal),
        treatment.waitingPeriod, treatment.waitingPeriodLocal,
        treatment.isLegallyApproved, treatment.legalUsageLimit,
        treatment.legalUsageLimitLocal, treatment.registrationNumber,
        ReviewStatus.PENDING
      ]
    );

    return this.mapRowToTreatment(result.rows[0]);
  }

  /**
   * Get treatments for a specific disease (approved only)
   */
  async getTreatmentsForDisease(
    diseaseId: string,
    includeOnlyApproved: boolean = true
  ): Promise<TreatmentRecommendation[]> {
    const query = includeOnlyApproved
      ? `SELECT * FROM treatment_recommendations 
         WHERE disease_id = $1 AND review_status = 'APPROVED'
         ORDER BY priority ASC`
      : `SELECT * FROM treatment_recommendations 
         WHERE disease_id = $1
         ORDER BY priority ASC`;

    const result = await this.db.query(query, [diseaseId]);
    const treatments = result.rows.map(row => this.mapRowToTreatment(row));
    return sortTreatmentsByPriority(treatments);
  }

  /**
   * Get organic alternatives for a disease
   */
  async getOrganicTreatments(diseaseId: string): Promise<TreatmentRecommendation[]> {
    const result = await this.db.query(
      `SELECT * FROM treatment_recommendations 
       WHERE disease_id = $1 
       AND treatment_type IN ('ORGANIC', 'BIOLOGICAL', 'CULTURAL')
       AND review_status = 'APPROVED'
       ORDER BY priority ASC`,
      [diseaseId]
    );

    return result.rows.map(row => this.mapRowToTreatment(row));
  }

  /**
   * Submit agronomist review
   */
  async submitAgronomistReview(
    review: Omit<AgronomistReview, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AgronomistReview> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Insert review
      const reviewResult = await client.query(
        `INSERT INTO agronomist_reviews (
          treatment_id, agronomist_id, agronomist_name, agronomist_credentials,
          status, review_date, comments, comments_local,
          organic_priority_verified, legal_compliance_verified,
          dosage_verified, safety_verified,
          revision_required, revision_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          review.treatmentId, review.agronomistId, review.agronomistName,
          review.agronomistCredentials, review.status, review.reviewDate,
          review.comments, review.commentsLocal,
          review.organicPriorityVerified, review.legalComplianceVerified,
          review.dosageVerified, review.safetyVerified,
          review.revisionRequired, review.revisionNotes
        ]
      );

      // Update treatment status
      await client.query(
        `UPDATE treatment_recommendations 
         SET review_status = $1, reviewed_by = $2, reviewed_at = $3, review_notes = $4
         WHERE id = $5`,
        [review.status, review.agronomistId, review.reviewDate, review.comments, review.treatmentId]
      );

      await client.query('COMMIT');
      return this.mapRowToReview(reviewResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pending treatments for review
   */
  async getPendingTreatments(): Promise<TreatmentRecommendation[]> {
    const result = await this.db.query(
      `SELECT * FROM treatment_recommendations 
       WHERE review_status = 'PENDING'
       ORDER BY created_at ASC`
    );

    return result.rows.map(row => this.mapRowToTreatment(row));
  }

  /**
   * Get pesticide legal limit by registration number
   */
  async getPesticideLegalLimit(registrationNumber: string): Promise<PesticideLegalLimit | null> {
    const result = await this.db.query(
      `SELECT * FROM pesticide_legal_limits WHERE registration_number = $1`,
      [registrationNumber]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPesticideLimit(result.rows[0]);
  }

  /**
   * Get all pesticide legal limits
   */
  async getAllPesticideLimits(): Promise<PesticideLegalLimit[]> {
    const result = await this.db.query(
      `SELECT * FROM pesticide_legal_limits ORDER BY pesticide_name ASC`
    );

    return result.rows.map(row => this.mapRowToPesticideLimit(row));
  }

  /**
   * Get review history for a treatment
   */
  async getReviewHistory(treatmentId: string): Promise<AgronomistReview[]> {
    const result = await this.db.query(
      `SELECT * FROM agronomist_reviews 
       WHERE treatment_id = $1
       ORDER BY review_date DESC`,
      [treatmentId]
    );

    return result.rows.map(row => this.mapRowToReview(row));
  }

  // Helper methods to map database rows to TypeScript interfaces
  private mapRowToTreatment(row: any): TreatmentRecommendation {
    return {
      id: row.id,
      diseaseId: row.disease_id,
      diseaseName: row.disease_name,
      diseaseNameLocal: row.disease_name_local,
      cropName: row.crop_name,
      severity: row.severity,
      treatmentType: row.treatment_type,
      treatmentName: row.treatment_name,
      treatmentNameLocal: row.treatment_name_local,
      description: row.description,
      descriptionLocal: row.description_local,
      priority: row.priority,
      priorityCategory: row.priority_category,
      dosage: row.dosage,
      dosageLocal: row.dosage_local,
      applicationMethod: row.application_method,
      applicationMethodLocal: row.application_method_local,
      frequency: row.frequency,
      frequencyLocal: row.frequency_local,
      duration: row.duration,
      durationLocal: row.duration_local,
      safetyPrecautions: row.safety_precautions,
      safetyPrecautionsLocal: row.safety_precautions_local,
      waitingPeriod: row.waiting_period,
      waitingPeriodLocal: row.waiting_period_local,
      isLegallyApproved: row.is_legally_approved,
      legalUsageLimit: row.legal_usage_limit,
      legalUsageLimitLocal: row.legal_usage_limit_local,
      registrationNumber: row.registration_number,
      reviewStatus: row.review_status,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      reviewNotes: row.review_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToReview(row: any): AgronomistReview {
    return {
      id: row.id,
      treatmentId: row.treatment_id,
      agronomistId: row.agronomist_id,
      agronomistName: row.agronomist_name,
      agronomistCredentials: row.agronomist_credentials,
      status: row.status,
      reviewDate: row.review_date,
      comments: row.comments,
      commentsLocal: row.comments_local,
      organicPriorityVerified: row.organic_priority_verified,
      legalComplianceVerified: row.legal_compliance_verified,
      dosageVerified: row.dosage_verified,
      safetyVerified: row.safety_verified,
      revisionRequired: row.revision_required,
      revisionNotes: row.revision_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToPesticideLimit(row: any): PesticideLegalLimit {
    return {
      id: row.id,
      pesticideName: row.pesticide_name,
      pesticideNameLocal: row.pesticide_name_local,
      registrationNumber: row.registration_number,
      maxApplicationsPerSeason: row.max_applications_per_season,
      maxDosagePerHectare: row.max_dosage_per_hectare,
      minDaysBetweenApplications: row.min_days_between_applications,
      preHarvestInterval: row.pre_harvest_interval,
      approvedCrops: row.approved_crops,
      restrictedStates: row.restricted_states,
      bannedForOrganicFarming: row.banned_for_organic_farming,
      requiresLicense: row.requires_license,
      toxicityClass: row.toxicity_class,
      environmentalImpact: row.environmental_impact,
      regulatoryAuthority: row.regulatory_authority,
      lastUpdated: row.last_updated
    };
  }
}
