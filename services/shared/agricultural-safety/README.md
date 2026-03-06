# Agricultural Safety Standards

This module implements agricultural safety standards for the KrishiAI platform, ensuring that all treatment recommendations are reviewed by certified agronomists and comply with legal requirements.

## Features

### 1. Treatment Recommendation System
- **Organic Priority**: Organic/biological treatments must have priority ≤10
- **Chemical Secondary**: Chemical treatments must have priority ≥11
- **Multilingual Support**: All treatments available in Hindi and Marathi
- **Safety Information**: Comprehensive safety precautions and waiting periods

### 2. Agronomist Review Workflow
- **Pending Review**: All new treatments start in PENDING status
- **Approval Criteria**: 
  - Organic priority verified
  - Legal compliance verified
  - Dosage verified
  - Safety verified
- **Review Statuses**: PENDING, APPROVED, REJECTED, REVISION_REQUIRED

### 3. Pesticide Legal Compliance
- **Registration Validation**: All pesticides must have valid registration numbers
- **Crop Approval**: Pesticides validated against approved crop list
- **State Restrictions**: Checks for state-specific restrictions
- **Organic Farming**: Validates ban status for organic farming
- **Toxicity Classification**: LOW, MODERATE, HIGH, EXTREMELY_HIGH

### 4. Treatment Disclaimer
- **Advisory Notice**: Clear disclaimer that recommendations are advisory
- **Expert Consultation**: Encourages consultation with local experts
- **Safety Guidelines**: Emphasizes safety precautions and protective equipment
- **Multilingual**: Available in English, Hindi, and Marathi

## Database Schema

### treatment_recommendations
Stores disease treatment recommendations with organic/chemical separation.

**Key Fields**:
- `priority`: 1-10 for organic, 11+ for chemical
- `treatment_type`: ORGANIC, CHEMICAL, BIOLOGICAL, CULTURAL
- `review_status`: PENDING, APPROVED, REJECTED, REVISION_REQUIRED
- `safety_precautions`: JSONB array of safety instructions
- `registration_number`: For chemical pesticides

### agronomist_reviews
Tracks agronomist reviews and approval workflow.

**Key Fields**:
- `organic_priority_verified`: Boolean check
- `legal_compliance_verified`: Boolean check
- `dosage_verified`: Boolean check
- `safety_verified`: Boolean check
- `revision_required`: Boolean flag

### pesticide_legal_limits
Maintains legal usage limits for chemical pesticides.

**Key Fields**:
- `max_applications_per_season`: Integer limit
- `max_dosage_per_hectare`: String with units
- `pre_harvest_interval`: Days before harvest
- `approved_crops`: JSONB array
- `restricted_states`: JSONB array
- `toxicity_class`: Safety classification

## API Endpoints

### GET /api/v1/treatments/disease/:diseaseId
Get approved treatments for a disease (organic first).

**Query Parameters**:
- `includeChemical`: true/false (default: true)

**Response**:
```json
{
  "success": true,
  "data": {
    "diseaseId": "tomato-early-blight",
    "treatmentCount": 5,
    "organicCount": 3,
    "chemicalCount": 2,
    "treatments": [...]
  }
}
```

### GET /api/v1/treatments/organic/:diseaseId
Get only organic alternatives for a disease.

### POST /api/v1/treatments/submit
Submit a new treatment recommendation for review.

**Required Role**: AGRONOMIST or ADMIN

**Request Body**:
```json
{
  "diseaseId": "tomato-early-blight",
  "diseaseName": "Early Blight",
  "diseaseNameLocal": "प्रारंभिक झुलसा",
  "cropName": "Tomato",
  "severity": "MODERATE",
  "treatmentType": "ORGANIC",
  "treatmentName": "Neem Oil Spray",
  "treatmentNameLocal": "नीम तेल स्प्रे",
  "priority": 5,
  "applicationMethod": "Foliar spray",
  "frequency": "Every 7 days",
  "duration": "3 weeks",
  "safetyPrecautions": ["Wear gloves", "Avoid contact with eyes"],
  ...
}
```

### GET /api/v1/treatments/pending
Get all pending treatments for review.

**Required Role**: AGRONOMIST or ADMIN

### POST /api/v1/treatments/review
Submit agronomist review for a treatment.

**Required Role**: AGRONOMIST or ADMIN

**Request Body**:
```json
{
  "treatmentId": "uuid",
  "agronomistId": "uuid",
  "agronomistName": "Dr. Rajesh Kumar",
  "agronomistCredentials": "PhD Agronomy, 15 years experience",
  "status": "APPROVED",
  "comments": "Treatment is safe and effective",
  "commentsLocal": "उपचार सुरक्षित और प्रभावी है",
  "organicPriorityVerified": true,
  "legalComplianceVerified": true,
  "dosageVerified": true,
  "safetyVerified": true
}
```

### GET /api/v1/treatments/:treatmentId/history
Get review history for a treatment.

### GET /api/v1/treatments/disclaimer
Get treatment disclaimer text.

**Query Parameters**:
- `language`: en, hi, mr (default: en)

### GET /api/v1/treatments/pesticides
Get all pesticide legal limits.

### GET /api/v1/treatments/pesticides/:registrationNumber
Get pesticide legal limit by registration number.

## Usage Examples

### Backend Integration

```typescript
import { Pool } from 'pg';
import { TreatmentService } from './agricultural-safety/treatmentService';
import { createTreatmentRoutes } from './agricultural-safety/routes/treatmentRoutes';

// Initialize service
const db = new Pool({ /* config */ });
const treatmentService = new TreatmentService(db);

// Get treatments for disease
const treatments = await treatmentService.getTreatmentsForDisease('tomato-early-blight');

// Get only organic alternatives
const organicTreatments = await treatmentService.getOrganicTreatments('tomato-early-blight');

// Submit for review
const newTreatment = await treatmentService.submitTreatmentRecommendation({
  diseaseId: 'tomato-early-blight',
  treatmentType: TreatmentType.ORGANIC,
  priority: 5,
  // ... other fields
});

// Add routes to Express app
app.use('/api/v1/treatments', createTreatmentRoutes(db));
```

### Mobile App Integration

```typescript
import TreatmentDisclaimer from '../components/TreatmentDisclaimer';

// Show disclaimer modal
<TreatmentDisclaimer
  visible={showDisclaimer}
  onAccept={() => setShowDisclaimer(false)}
  onCancel={() => setShowDisclaimer(false)}
/>

// Show compact inline disclaimer
<TreatmentDisclaimer
  visible={true}
  onAccept={() => {}}
  compact={true}
/>
```

## Validation Rules

### Treatment Priority Validation
```typescript
import { validateTreatmentPriority } from './treatmentReview';

const validation = validateTreatmentPriority(treatment);
if (!validation.valid) {
  throw new Error(validation.error);
}
```

**Rules**:
- Organic/Biological/Cultural: priority 1-10 (PRIMARY)
- Chemical: priority 11-20 (SECONDARY)
- Last resort: priority 21+ (TERTIARY)

### Pesticide Legal Compliance
```typescript
import { validatePesticideLegalCompliance } from './treatmentReview';

const legalLimit = await treatmentService.getPesticideLegalLimit(registrationNumber);
const compliance = validatePesticideLegalCompliance(treatment, legalLimit, cropName, state);

if (!compliance.compliant) {
  console.error('Violations:', compliance.violations);
}
```

**Checks**:
- Pesticide approved for crop
- Not restricted in state
- Not banned for organic farming
- Registration number matches

## Requirements Mapping

This implementation satisfies:

- **Requirement 20.3**: All disease treatment recommendations are reviewed by certified agronomists
- **Requirement 20.4**: Organic treatment alternatives are prioritized over chemical pesticides
- **Requirement 20.5**: Pesticide recommendations comply with legal usage limits and safety guidelines
- **Requirement 20.6**: Disclaimer provided that recommendations are advisory

## Testing

Run tests:
```bash
npm test agricultural-safety
```

Test coverage includes:
- Treatment priority validation
- Pesticide legal compliance
- Treatment sorting (organic first)
- Approved treatment filtering
- Organic alternatives filtering
- Disclaimer generation (all languages)

## Database Migration

Run migration:
```bash
psql -U postgres -d krishiai_db -f services/shared/agricultural-safety/migrations/001_create_treatment_tables.sql
```

This creates:
- `treatment_recommendations` table
- `agronomist_reviews` table
- `pesticide_legal_limits` table
- `approved_treatments_view` view
- Sample pesticide data (3 common Indian pesticides)

## Security Considerations

1. **Role-Based Access**: Only AGRONOMIST and ADMIN roles can submit/review treatments
2. **Validation**: All inputs validated before database insertion
3. **Audit Trail**: Complete review history maintained
4. **Legal Compliance**: Automatic validation against legal limits database

## Future Enhancements

1. **Automated Notifications**: Alert agronomists when new treatments are pending
2. **Batch Review**: Allow agronomists to review multiple treatments at once
3. **Treatment Effectiveness Tracking**: Track farmer feedback on treatment effectiveness
4. **Regional Customization**: Support for state-specific treatment recommendations
5. **Integration with Disease Detector**: Automatic treatment suggestions based on detected disease
