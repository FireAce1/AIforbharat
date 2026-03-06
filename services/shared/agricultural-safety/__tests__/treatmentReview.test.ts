/**
 * Treatment Review System Tests
 * Tests for agricultural safety standards implementation
 */

import {
  TreatmentRecommendation,
  TreatmentType,
  TreatmentPriority,
  ReviewStatus,
  DiseaseSeverity,
  PesticideLegalLimit,
  validateTreatmentPriority,
  validatePesticideLegalCompliance,
  sortTreatmentsByPriority,
  getApprovedTreatments,
  getOrganicAlternatives,
  generateTreatmentDisclaimer
} from '../treatmentReview';

describe('Treatment Review System', () => {
  describe('validateTreatmentPriority', () => {
    it('should accept organic treatment with priority ≤10', () => {
      const treatment: Partial<TreatmentRecommendation> = {
        treatmentType: TreatmentType.ORGANIC,
        priority: 5
      };

      const result = validateTreatmentPriority(treatment as TreatmentRecommendation);
      expect(result.valid).toBe(true);
      expect(treatment.priorityCategory).toBe(TreatmentPriority.PRIMARY);
    });

    it('should reject organic treatment with priority >10', () => {
      const treatment: Partial<TreatmentRecommendation> = {
        treatmentType: TreatmentType.ORGANIC,
        priority: 15
      };

      const result = validateTreatmentPriority(treatment as TreatmentRecommendation);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('priority ≤10');
    });

    it('should accept chemical treatment with priority ≥11', () => {
      const treatment: Partial<TreatmentRecommendation> = {
        treatmentType: TreatmentType.CHEMICAL,
        priority: 15
      };

      const result = validateTreatmentPriority(treatment as TreatmentRecommendation);
      expect(result.valid).toBe(true);
      expect(treatment.priorityCategory).toBe(TreatmentPriority.SECONDARY);
    });

    it('should reject chemical treatment with priority ≤10', () => {
      const treatment: Partial<TreatmentRecommendation> = {
        treatmentType: TreatmentType.CHEMICAL,
        priority: 5
      };

      const result = validateTreatmentPriority(treatment as TreatmentRecommendation);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('priority ≥11');
    });

    it('should set correct priority categories', () => {
      const primary: Partial<TreatmentRecommendation> = {
        treatmentType: TreatmentType.ORGANIC,
        priority: 5
      };
      validateTreatmentPriority(primary as TreatmentRecommendation);
      expect(primary.priorityCategory).toBe(TreatmentPriority.PRIMARY);

      const secondary: Partial<TreatmentRecommendation> = {
        treatmentType: TreatmentType.CHEMICAL,
        priority: 15
      };
      validateTreatmentPriority(secondary as TreatmentRecommendation);
      expect(secondary.priorityCategory).toBe(TreatmentPriority.SECONDARY);

      const tertiary: Partial<TreatmentRecommendation> = {
        treatmentType: TreatmentType.CHEMICAL,
        priority: 25
      };
      validateTreatmentPriority(tertiary as TreatmentRecommendation);
      expect(tertiary.priorityCategory).toBe(TreatmentPriority.TERTIARY);
    });
  });

  describe('validatePesticideLegalCompliance', () => {
    const legalLimit: PesticideLegalLimit = {
      id: '1',
      pesticideName: 'Test Pesticide',
      pesticideNameLocal: 'टेस्ट कीटनाशक',
      registrationNumber: 'CIB-001-2020',
      maxApplicationsPerSeason: 2,
      maxDosagePerHectare: '1.5 liters',
      minDaysBetweenApplications: 15,
      preHarvestInterval: 21,
      approvedCrops: ['Rice', 'Cotton', 'Wheat'],
      restrictedStates: ['Kerala'],
      bannedForOrganicFarming: true,
      requiresLicense: false,
      toxicityClass: 'MODERATE',
      environmentalImpact: 'MODERATE',
      regulatoryAuthority: 'CIB',
      lastUpdated: new Date()
    };

    it('should pass compliance for approved crop', () => {
      const treatment: Partial<TreatmentRecommendation> = {
        treatmentType: TreatmentType.CHEMICAL,
        registrationNumber: 'CIB-001-2020'
      };

      const result = validatePesticideLegalCompliance(
        treatment as TreatmentRecommendation,
        legalLimit,
        'Rice'
      );

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail compliance for unapproved crop', () => {
      const treatment: Partial<TreatmentRecommendation> = {
        treatmentType: TreatmentType.CHEMICAL,
        registrationNumber: 'CIB-001-2020'
      };

      const result = validatePesticideLegalCompliance(
        treatment as TreatmentRecommendation,
        legalLimit,
        'Tomato'
      );

      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('Pesticide not approved for Tomato');
    });

    it('should fail compliance for restricted state', () => {
      const treatment: Partial<TreatmentRecommendation> = {
        treatmentType: TreatmentType.CHEMICAL,
        registrationNumber: 'CIB-001-2020'
      };

      const result = validatePesticideLegalCompliance(
        treatment as TreatmentRecommendation,
        legalLimit,
        'Rice',
        'Kerala'
      );

      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('Pesticide restricted in Kerala');
    });

    it('should fail compliance for organic farming ban', () => {
      const treatment: Partial<TreatmentRecommendation> = {
        treatmentType: TreatmentType.ORGANIC,
        registrationNumber: 'CIB-001-2020'
      };

      const result = validatePesticideLegalCompliance(
        treatment as TreatmentRecommendation,
        legalLimit,
        'Rice'
      );

      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('Pesticide banned for organic farming');
    });
  });

  describe('sortTreatmentsByPriority', () => {
    it('should sort treatments by priority (organic first)', () => {
      const treatments: Partial<TreatmentRecommendation>[] = [
        { priority: 15, treatmentType: TreatmentType.CHEMICAL, id: '1' },
        { priority: 5, treatmentType: TreatmentType.ORGANIC, id: '2' },
        { priority: 10, treatmentType: TreatmentType.BIOLOGICAL, id: '3' }
      ];

      const sorted = sortTreatmentsByPriority(treatments as TreatmentRecommendation[]);

      expect(sorted[0].id).toBe('2'); // Priority 5, Organic
      expect(sorted[1].id).toBe('3'); // Priority 10, Biological
      expect(sorted[2].id).toBe('1'); // Priority 15, Chemical
    });

    it('should prioritize organic over chemical for same priority', () => {
      const treatments: Partial<TreatmentRecommendation>[] = [
        { priority: 10, treatmentType: TreatmentType.CHEMICAL, id: '1' },
        { priority: 10, treatmentType: TreatmentType.ORGANIC, id: '2' }
      ];

      const sorted = sortTreatmentsByPriority(treatments as TreatmentRecommendation[]);

      expect(sorted[0].id).toBe('2'); // Organic comes first
      expect(sorted[1].id).toBe('1');
    });
  });

  describe('getApprovedTreatments', () => {
    it('should filter only approved treatments', () => {
      const treatments: Partial<TreatmentRecommendation>[] = [
        { id: '1', reviewStatus: ReviewStatus.APPROVED },
        { id: '2', reviewStatus: ReviewStatus.PENDING },
        { id: '3', reviewStatus: ReviewStatus.APPROVED },
        { id: '4', reviewStatus: ReviewStatus.REJECTED }
      ];

      const approved = getApprovedTreatments(treatments as TreatmentRecommendation[]);

      expect(approved).toHaveLength(2);
      expect(approved[0].id).toBe('1');
      expect(approved[1].id).toBe('3');
    });
  });

  describe('getOrganicAlternatives', () => {
    it('should filter only organic/biological approved treatments', () => {
      const treatments: Partial<TreatmentRecommendation>[] = [
        { 
          id: '1', 
          treatmentType: TreatmentType.ORGANIC, 
          reviewStatus: ReviewStatus.APPROVED 
        },
        { 
          id: '2', 
          treatmentType: TreatmentType.CHEMICAL, 
          reviewStatus: ReviewStatus.APPROVED 
        },
        { 
          id: '3', 
          treatmentType: TreatmentType.BIOLOGICAL, 
          reviewStatus: ReviewStatus.APPROVED 
        },
        { 
          id: '4', 
          treatmentType: TreatmentType.ORGANIC, 
          reviewStatus: ReviewStatus.PENDING 
        }
      ];

      const organic = getOrganicAlternatives(treatments as TreatmentRecommendation[]);

      expect(organic).toHaveLength(2);
      expect(organic[0].treatmentType).toBe(TreatmentType.ORGANIC);
      expect(organic[1].treatmentType).toBe(TreatmentType.BIOLOGICAL);
    });
  });

  describe('generateTreatmentDisclaimer', () => {
    it('should generate disclaimer in English', () => {
      const disclaimer = generateTreatmentDisclaimer('en');
      
      expect(disclaimer).toContain('IMPORTANT DISCLAIMER');
      expect(disclaimer).toContain('advisory only');
      expect(disclaimer).toContain('consult with local agricultural experts');
      expect(disclaimer).toContain('Organic treatments are prioritized');
    });

    it('should generate disclaimer in Hindi', () => {
      const disclaimer = generateTreatmentDisclaimer('hi');
      
      expect(disclaimer).toContain('महत्वपूर्ण अस्वीकरण');
      expect(disclaimer).toContain('सलाहकार');
      expect(disclaimer).toContain('कृषि विशेषज्ञों');
      expect(disclaimer).toContain('जैविक उपचार');
    });

    it('should generate disclaimer in Marathi', () => {
      const disclaimer = generateTreatmentDisclaimer('mr');
      
      expect(disclaimer).toContain('महत्त्वाचे अस्वीकरण');
      expect(disclaimer).toContain('सल्लागार');
      expect(disclaimer).toContain('कृषी तज्ञांचा');
      expect(disclaimer).toContain('सेंद्रिय उपचार');
    });
  });
});
