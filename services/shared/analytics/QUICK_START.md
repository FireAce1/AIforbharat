# Analytics Tracking - Quick Start Guide

## 🚀 5-Minute Setup

### Mobile App (Firebase Analytics)

1. **Install dependencies**:
```bash
cd mobile/krishiai-app
npm install @react-native-firebase/app @react-native-firebase/analytics
```

2. **Add Firebase config**:
   - Create Firebase project: https://console.firebase.google.com
   - Download `google-services.json`
   - Place in `android/app/google-services.json`

3. **Update build.gradle**:
```gradle
// android/build.gradle
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.4.0'
  }
}

// android/app/build.gradle
apply plugin: 'com.google.gms.google-services'
```

4. **Initialize in App.tsx**:
```typescript
import analyticsService from './services/analytics';

useEffect(() => {
  analyticsService.initialize();
}, []);
```

5. **Track events**:
```typescript
// Automatic screen tracking
import { useScreenTracking } from './hooks/useAnalytics';

function MyScreen() {
  useScreenTracking();
  return <View>...</View>;
}

// Manual event tracking
await analyticsService.logDiseaseDetection({
  disease_name: 'Tomato Late Blight',
  confidence: 0.95,
  severity: 'Moderate',
  detection_time_ms: 1500,
});
```

### Backend Analytics

1. **Install dependencies**:
```bash
cd services/shared
npm install redis nodemailer node-cron
```

2. **Configure environment** (`.env`):
```bash
REDIS_URL=redis://localhost:6379
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=analytics@krishiai.com
ANALYTICS_REPORT_RECIPIENTS=team@krishiai.com
```

3. **Initialize in server**:
```typescript
import analyticsService from './shared/analytics/analyticsService';
import weeklyReportService from './shared/analytics/weeklyReport';
import analyticsRoutes from './shared/analytics/routes';

// Initialize
await analyticsService.initialize();

// Add routes
app.use('/api/v1/analytics', analyticsRoutes);

// Schedule weekly reports
const recipients = process.env.ANALYTICS_REPORT_RECIPIENTS?.split(',') || [];
weeklyReportService.scheduleWeeklyReport(recipients);
```

4. **Test it**:
```bash
# Track an event
curl -X POST http://localhost:3000/api/v1/analytics/track \
  -H "Content-Type: application/json" \
  -d '{"event_name": "test_event", "properties": {"test": true}}'

# Get report
curl http://localhost:3000/api/v1/analytics/report
```

### Grafana Dashboard

1. **Import dashboard**:
```bash
cp infrastructure/monitoring/dashboards/analytics-dashboard.json \
   infrastructure/monitoring/grafana/provisioning/dashboards/
```

2. **Restart Grafana**:
```bash
docker-compose -f infrastructure/monitoring/docker-compose.monitoring.yml restart grafana
```

3. **Access**: http://localhost:3000 → Dashboards → KrishiAI Analytics

## 📊 Key Events to Track

```typescript
// Disease Detection
analyticsService.logDiseaseDetection({
  disease_name: 'Tomato Late Blight',
  confidence: 0.95,
  severity: 'Moderate',
  detection_time_ms: 1500,
});

// Crop Recommendation
analyticsService.logCropRecommendation({
  recommended_crops: ['Tomato', 'Onion', 'Cotton'],
  top_crop: 'Tomato',
  confidence: 0.89,
  farm_size: 2.5,
  soil_type: 'Black',
});

// Price Check
analyticsService.logPriceCheck({
  crop_name: 'Tomato',
  current_price: 25,
  trend: 'up',
  mandis_count: 5,
});

// Scheme View
analyticsService.logSchemeView({
  scheme_id: 'pm-kisan-2024',
  scheme_name: 'PM-KISAN',
  scheme_type: 'subsidy',
  is_eligible: true,
});

// Sync Events
analyticsService.logSync({
  status: 'completed',
  items_synced: 10,
  duration_ms: 5000,
});
```

## 🔍 Monitoring

```bash
# Check Redis analytics
redis-cli keys "analytics:*"

# View event count
redis-cli keys "analytics:events:*" | wc -l

# Check feature usage
redis-cli get "analytics:feature_usage:disease_detected"
```

## 📧 Weekly Reports

Reports are automatically sent every Monday at 9:00 AM to configured recipients.

To test manually:
```typescript
import weeklyReportService from './shared/analytics/weeklyReport';

await weeklyReportService.sendWeeklyReport(['test@example.com']);
```

## 🎯 Success Metrics Dashboard

Access key metrics:
- Total Users
- 7-Day Retention Rate
- Feature Adoption
- Session Duration
- Sync Success Rate

## 📚 Full Documentation

See `services/shared/analytics/README.md` for complete documentation.
