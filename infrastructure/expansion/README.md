# Geographic Expansion Infrastructure

## Overview

This directory contains all infrastructure and resources needed to expand KrishiAI to new geographic regions, including Punjab, Karnataka, Telangana, and Andhra Pradesh.

## Directory Structure

```
infrastructure/expansion/
├── languages/                    # Language support files
│   ├── punjabi/                 # Punjabi (pa) translations
│   ├── kannada/                 # Kannada (kn) translations
│   └── telugu/                  # Telugu (te) translations
├── schemes/                      # State-specific government schemes
│   ├── punjab/                  # Punjab schemes scraper
│   ├── karnataka/               # Karnataka schemes scraper
│   └── telangana-ap/            # Telangana & AP schemes scraper
├── crops-diseases/              # Regional crop and disease data
│   ├── regional-crops.json      # Crop varieties by region
│   └── regional-diseases.json   # Disease patterns by region
├── market-sources/              # Regional market data APIs
│   ├── punjab-mandi-api.ts      # Punjab Mandi Board API
│   ├── karnataka-apmc-api.ts    # Karnataka APMC API
│   └── telangana-market-api.ts  # Telangana market API
└── training/                    # Region-specific training materials
    ├── punjab/                  # Punjab training docs
    ├── karnataka/               # Karnataka training docs
    └── telangana-ap/            # Telangana & AP training docs
```

## Supported Languages

### Current (MVP)
- Hindi (hi)
- Marathi (mr)

### New Additions
- **Punjabi (pa)** - Punjab
- **Kannada (kn)** - Karnataka
- **Telugu (te)** - Telangana & Andhra Pradesh

## Regional Coverage

### Punjab
- **Primary Crops**: Wheat, Paddy, Cotton, Maize
- **Alternative Crops**: Moong, Sunflower (diversification incentives)
- **Key Diseases**: Yellow Rust, Bacterial Leaf Blight, Cotton Leaf Curl Virus
- **Market Sources**: Punjab Mandi Board API
- **Government Schemes**: Crop Diversification, Micro Irrigation, Wheat Procurement Bonus

### Karnataka
- **Primary Crops**: Ragi, Coffee, Arecanut, Paddy, Sugarcane
- **Horticulture**: Mango, Banana
- **Key Diseases**: Coffee Leaf Rust, Finger Millet Blast, Yellow Leaf Disease
- **Market Sources**: Karnataka APMC API
- **Government Schemes**: Raitha Shakti, Coffee Growers Subsidy, Ragi Promotion

### Telangana & Andhra Pradesh
- **Primary Crops**: Cotton, Paddy, Maize, Turmeric, Red Gram
- **Cash Crops**: Chilli, Tobacco
- **Key Diseases**: Cotton Wilt, Rhizome Rot, Chilli Leaf Curl
- **Market Sources**: Telangana Market API
- **Government Schemes**: Rythu Bandhu, Cotton Procurement Bonus, YSR Free Crop Insurance

## Implementation Steps

### 1. Language Support Deployment

```bash
# Update mobile app with new languages
cd mobile/krishiai-app
npm install react-native-localize

# Copy language files
cp infrastructure/expansion/languages/punjabi/pa.json src/i18n/locales/
cp infrastructure/expansion/languages/kannada/kn.json src/i18n/locales/
cp infrastructure/expansion/languages/telugu/te.json src/i18n/locales/

# Update i18n configuration
# Edit src/i18n/index.ts to include new languages

# Rebuild app
npm run android
```

### 2. Regional Schemes Integration

```bash
# Install dependencies
cd services/govt-service
npm install cheerio axios

# Deploy scheme scrapers
cp infrastructure/expansion/schemes/punjab/punjab-schemes-scraper.ts src/scrapers/
cp infrastructure/expansion/schemes/karnataka/karnataka-schemes-scraper.ts src/scrapers/
cp infrastructure/expansion/schemes/telangana-ap/telangana-schemes-scraper.ts src/scrapers/

# Run database migrations
npm run migrate

# Test scrapers
npm run test:scrapers
```

### 3. Crop & Disease Database Update

```bash
# Update crop recommender model
cd ml-models/crop-recommender
python update_regional_crops.py --regions punjab,karnataka,telangana

# Update disease detector model
cd ml-models/disease-detector
python update_regional_diseases.py --regions punjab,karnataka,telangana

# Retrain models with regional data
python train.py --include-regional-data
```

### 4. Market Data Integration

```bash
# Configure API credentials
cp infrastructure/expansion/.env.example .env
# Edit .env with regional API keys

# Deploy market data services
cd services/market-service
npm install

# Add regional API clients
cp infrastructure/expansion/market-sources/*.ts src/integrations/

# Test market data fetching
npm run test:market-sources
```

### 5. Training Materials Deployment

```bash
# Upload to CDN
cd infrastructure/expansion/training
./deploy-training-materials.sh

# Verify CDN upload
curl https://cdn.krishiai.in/training/punjab/onboarding-guide-pa.md
```

## Configuration

### Environment Variables

```bash
# Punjab Mandi Board API
PUNJAB_MANDI_API_KEY=your_api_key_here
PUNJAB_MANDI_API_URL=https://api.punjabmandi.gov.in/v1

# Karnataka APMC API
KARNATAKA_APMC_API_KEY=your_api_key_here
KARNATAKA_APMC_API_URL=https://api.apmc.karnataka.gov.in/v1

# Telangana Market API
TELANGANA_MARKET_API_KEY=your_api_key_here
TELANGANA_MARKET_API_URL=https://api.telanganamarket.gov.in/v1

# SMS Gateway (for regional languages)
SMS_GATEWAY_PUNJABI_ENABLED=true
SMS_GATEWAY_KANNADA_ENABLED=true
SMS_GATEWAY_TELUGU_ENABLED=true
```

### Database Migrations

```sql
-- Add language support columns
ALTER TABLE users ADD COLUMN language VARCHAR(5) DEFAULT 'hi';
ALTER TABLE government_schemes ADD COLUMN scheme_name_pa VARCHAR(200);
ALTER TABLE government_schemes ADD COLUMN scheme_name_kn VARCHAR(200);
ALTER TABLE government_schemes ADD COLUMN scheme_name_te VARCHAR(200);
ALTER TABLE government_schemes ADD COLUMN description_pa TEXT;
ALTER TABLE government_schemes ADD COLUMN description_kn TEXT;
ALTER TABLE government_schemes ADD COLUMN description_te TEXT;

-- Add regional crop varieties
CREATE TABLE regional_crop_varieties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region VARCHAR(50) NOT NULL,
  crop_name VARCHAR(100) NOT NULL,
  local_name VARCHAR(100),
  variety VARCHAR(100),
  sowing_season VARCHAR(50),
  harvest_season VARCHAR(50),
  avg_yield_per_hectare DECIMAL(10,2),
  INDEX idx_region_crop (region, crop_name)
);

-- Add regional disease patterns
CREATE TABLE regional_disease_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region VARCHAR(50) NOT NULL,
  disease_name VARCHAR(100) NOT NULL,
  local_name VARCHAR(100),
  affected_crops JSONB,
  severity VARCHAR(20),
  favorable_conditions TEXT,
  INDEX idx_region_disease (region, disease_name)
);
```

## Testing

### Language Support Testing

```bash
# Test language switching
cd mobile/krishiai-app
npm run test -- --testPathPattern=i18n

# Test voice I/O for new languages
npm run test -- --testPathPattern=voiceService
```

### Regional Schemes Testing

```bash
# Test scheme scrapers
cd services/govt-service
npm run test:scrapers -- --region=punjab
npm run test:scrapers -- --region=karnataka
npm run test:scrapers -- --region=telangana

# Verify scheme translations
npm run test:translations
```

### Market Data Testing

```bash
# Test market API integrations
cd services/market-service
npm run test:punjab-mandi
npm run test:karnataka-apmc
npm run test:telangana-market

# Verify price normalization
npm run test:price-normalization
```

## Monitoring

### Metrics to Track

1. **Language Adoption**
   - Users by language preference
   - Voice I/O usage by language
   - Translation completeness

2. **Regional Scheme Discovery**
   - Scheme views by region
   - Application click-through rates
   - Eligibility match rates

3. **Market Data Reliability**
   - API uptime by source
   - Data freshness
   - Price accuracy validation

4. **Training Material Engagement**
   - Document downloads by region
   - Video tutorial views
   - Coordinator feedback scores

### Grafana Dashboards

```bash
# Import regional expansion dashboards
cd infrastructure/monitoring/dashboards
kubectl apply -f regional-expansion-dashboard.json
```

## Rollout Plan

### Phase 1: Punjab (Weeks 1-2)
- Deploy Punjabi language support
- Integrate Punjab Mandi Board API
- Launch Punjab-specific schemes
- Train 50 village coordinators
- Pilot with 500 farmers

### Phase 2: Karnataka (Weeks 3-4)
- Deploy Kannada language support
- Integrate Karnataka APMC API
- Launch Karnataka-specific schemes
- Train 50 village coordinators
- Pilot with 500 farmers

### Phase 3: Telangana & AP (Weeks 5-6)
- Deploy Telugu language support
- Integrate Telangana market API
- Launch Telangana & AP schemes
- Train 75 village coordinators
- Pilot with 750 farmers

### Phase 4: Evaluation & Scale (Weeks 7-8)
- Analyze adoption metrics
- Gather farmer feedback
- Iterate on regional content
- Prepare for full-scale launch

## Support

### Regional Coordinators

- **Punjab**: coordinator-punjab@krishiai.in
- **Karnataka**: coordinator-karnataka@krishiai.in
- **Telangana**: coordinator-telangana@krishiai.in
- **Andhra Pradesh**: coordinator-ap@krishiai.in

### Technical Support

- **API Issues**: api-support@krishiai.in
- **Translation Issues**: i18n-support@krishiai.in
- **Training Materials**: training-support@krishiai.in

## Next Steps

After successful deployment in these regions, prepare for:
1. **Gujarat** - Gujarati language support
2. **Rajasthan** - Hindi (already supported) + regional crops
3. **Bihar** - Hindi (already supported) + regional schemes
4. **West Bengal** - Bengali language support
5. **Tamil Nadu** - Tamil language support

---

**Last Updated**: January 2026
**Version**: 1.0.0
**Status**: Ready for Deployment
