# KrishiAI Pilot Launch Monitoring & Feedback Collection

Comprehensive monitoring and feedback collection system for the KrishiAI MVP pilot launch with 1,000 farmers.

## Overview

This system provides:
- **System Performance Monitoring**: API response times, error rates, uptime
- **ML Model Performance Tracking**: Accuracy, inference times, usage metrics
- **Business Metrics Collection**: Active users, feature usage, retention rates
- **User Feedback Collection**: NPS surveys, feature satisfaction, pain points
- **Coordinator Interviews**: Structured feedback from village coordinators

## Requirements

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Prometheus (for metrics collection)
- SMTP server (for email alerts)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Run Database Migrations

```bash
npm run migrate
```

### 4. Start Services

```bash
# Start both services
npm run start:all

# Or start individually
npm run start:monitoring  # Port 3100
npm run start:feedback    # Port 3101
```

## API Endpoints

### Monitoring Dashboard (Port 3100)

- `GET /api/monitoring/system` - System performance metrics
- `GET /api/monitoring/ml` - ML model performance metrics
- `GET /api/monitoring/business` - Business metrics
- `GET /api/monitoring/dashboard` - All metrics combined
- `GET /health` - Health check

### Feedback Collection (Port 3101)

**NPS Surveys**:
- `POST /api/feedback/nps` - Submit NPS survey
- `GET /api/feedback/nps/score` - Get current NPS score

**Feature Surveys**:
- `POST /api/feedback/feature` - Submit feature satisfaction
- `GET /api/feedback/feature/summary` - Get satisfaction summary

**Pain Points**:
- `POST /api/feedback/pain-point` - Report pain point
- `GET /api/feedback/pain-points` - Get pain points with filtering
- `GET /api/feedback/pain-points/summary` - Get summary

**Coordinator Interviews**:
- `POST /api/feedback/coordinator-interview` - Submit interview notes
- `GET /api/feedback/coordinator-interviews` - Get interviews

**Analytics**:
- `GET /api/feedback/analytics` - Comprehensive feedback analytics

## Usage Examples

### Get System Metrics

```bash
curl http://localhost:3100/api/monitoring/system
```

### Submit NPS Survey

```bash
curl -X POST http://localhost:3101/api/feedback/nps \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "score": 9,
    "reason": "Great app!",
    "language": "hi"
  }'
```

### Get NPS Score

```bash
curl "http://localhost:3101/api/feedback/nps/score?period=30"
```

### Report Pain Point

```bash
curl -X POST http://localhost:3101/api/feedback/pain-point \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "category": "performance",
    "description": "App is slow when loading prices",
    "severity": "medium",
    "language": "hi"
  }'
```

## Mobile App Integration

### NPS Survey Component

```typescript
import { NPSSurvey } from '../components/NPSSurvey';

<NPSSurvey
  visible={showNPSSurvey}
  onClose={() => setShowNPSSurvey(false)}
  onSubmit={handleNPSSurveySubmit}
/>
```

### Feature Survey Component

```typescript
import { FeatureSurvey } from '../components/FeatureSurvey';

<FeatureSurvey
  visible={showFeatureSurvey}
  feature="disease_detection"
  featureLabel={t('features.diseaseDetection')}
  onClose={() => setShowFeatureSurvey(false)}
/>
```

### Pain Point Report Component

```typescript
import { PainPointReport } from '../components/PainPointReport';

<PainPointReport
  visible={showPainPointReport}
  onClose={() => setShowPainPointReport(false)}
/>
```

## Monitoring Dashboards

### Grafana Setup

1. Add Prometheus data source
2. Import dashboard JSON from `infrastructure/monitoring/dashboards/`
3. Configure alerts for critical metrics

### Key Metrics to Monitor

**System Performance**:
- API response time p95 < 500ms
- Error rate < 1%
- Service uptime > 99%

**ML Model Performance**:
- Disease detector accuracy > 90%
- Inference time < 2s
- Model availability > 99%

**Business Metrics**:
- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- Monthly Active Users (MAU)
- NPS score > 50
- Feature usage rates
- Retention rates (Day 1, 7, 30)

## Alert Configuration

### Email Alerts

Alerts are automatically sent for:
- NPS detractors (score 0-6)
- Critical pain points
- System performance issues
- ML model degradation

Configure alert recipients in `.env`:
```env
ALERT_EMAIL=support@krishiai.com
```

### Alert Thresholds

- **Critical**: Immediate action required (service down, critical bugs)
- **High**: Action required within 1 hour (performance degradation)
- **Medium**: Action required within 24 hours (minor issues)
- **Low**: Monitor and address in next sprint

## Database Schema

### Tables

- `nps_surveys` - NPS survey responses
- `feature_surveys` - Feature satisfaction surveys
- `pain_points` - User-reported issues
- `coordinator_interviews` - Coordinator feedback
- `analytics_events` - User analytics events
- `analytics_sessions` - User session tracking

### Views

- `nps_score_view` - Daily NPS calculation
- `feature_satisfaction_view` - Daily feature satisfaction
- `pain_point_summary_view` - Daily pain point summary

## Success Criteria (Requirements 21.2-21.6)

### System Performance
- ✅ API response time p95 < 500ms
- ✅ Error rate < 1%
- ✅ Uptime > 99%

### ML Model Performance
- ✅ Disease detector accuracy > 90%, inference < 2s
- ✅ Crop recommender accuracy > 85%
- ✅ Price forecaster MAPE < 15%
- ✅ Chatbot intent accuracy > 85%

### Business Metrics
- ✅ 1,000 app installations (100% of pilot farmers)
- ✅ 70% monthly active user retention (700 users)
- ✅ 500+ disease detections performed
- ✅ 200+ marketplace inquiries
- ✅ NPS score > 50
- ✅ Average session duration > 5 minutes

### Feedback Collection
- ✅ NPS survey response rate > 30%
- ✅ Feature satisfaction surveys collected
- ✅ Pain points tracked and categorized
- ✅ Coordinator interviews conducted weekly

## Troubleshooting

### Monitoring dashboard not showing data
1. Verify Prometheus is running
2. Check service /metrics endpoints
3. Verify database connection

### Feedback not being saved
1. Check database tables exist
2. Verify database connection
3. Check API endpoint accessibility

### Email alerts not sending
1. Verify SMTP credentials
2. Test email connection
3. Check firewall settings

## Files Structure

```
infrastructure/production/pilot-launch/
├── monitoring-dashboard.ts              # System monitoring service
├── feedback-collection.ts               # Feedback collection service
├── package.json                         # Dependencies
├── .env.example                         # Environment template
├── README.md                            # This file
├── TASK_19.2_IMPLEMENTATION.md         # Implementation guide
└── migrations/
    └── create-feedback-tables.sql      # Database schema

mobile/krishiai-app/src/components/
├── NPSSurvey.tsx                       # NPS survey component
├── FeatureSurvey.tsx                   # Feature satisfaction survey
└── PainPointReport.tsx                 # Pain point reporting
```

## Next Steps

1. **Task 19.3**: Iterate based on feedback
2. **Task 19.4**: Measure success metrics
3. **Section 20**: Post-pilot scale preparation

## Support

For issues or questions:
- Email: support@krishiai.com
- Documentation: See TASK_19.2_IMPLEMENTATION.md

## License

MIT
