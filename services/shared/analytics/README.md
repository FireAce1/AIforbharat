# Analytics Service

Backend analytics service for tracking user behavior, feature usage, and generating reports.

## Features

- **Event Tracking**: Track custom events from mobile app and backend services
- **User Metrics**: Track user sessions, retention, and feature adoption
- **Feature Usage**: Monitor which features are most popular
- **Retention Analysis**: Calculate 7-day and 30-day retention rates
- **Weekly Reports**: Automated weekly analytics reports via email
- **Real-time Monitoring**: Redis-based real-time event processing

## Architecture

```
Mobile App → Firebase Analytics (client-side)
           ↓
Backend API → Redis (event storage)
           ↓
Analytics Service → Report Generation
           ↓
Email Service → Weekly Reports
```

## Setup

### 1. Environment Variables

Add to your `.env` file:

```bash
# Redis
REDIS_URL=redis://localhost:6379

# Email (for weekly reports)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=analytics@krishiai.com

# Report Recipients
ANALYTICS_REPORT_RECIPIENTS=team@krishiai.com,product@krishiai.com
```

### 2. Initialize Analytics Service

```typescript
import analyticsService from './shared/analytics/analyticsService';
import weeklyReportService from './shared/analytics/weeklyReport';

// Initialize analytics
await analyticsService.initialize();

// Schedule weekly reports
const recipients = process.env.ANALYTICS_REPORT_RECIPIENTS?.split(',') || [];
weeklyReportService.scheduleWeeklyReport(recipients);
```

### 3. Add Analytics Routes

```typescript
import analyticsRoutes from './shared/analytics/routes';

app.use('/api/v1/analytics', analyticsRoutes);
```

### 4. Add Analytics Middleware (Optional)

Track all API requests automatically:

```typescript
import analyticsService from './shared/analytics/analyticsService';

app.use(analyticsService.trackApiRequest());
```

## API Endpoints

### Track Event
```http
POST /api/v1/analytics/track
Content-Type: application/json

{
  "event_name": "disease_detected",
  "properties": {
    "disease_name": "Tomato Late Blight",
    "confidence": 0.95
  },
  "platform": "android",
  "app_version": "1.0.0"
}
```

### Get User Metrics
```http
GET /api/v1/analytics/user/:userId
```

### Get Feature Usage
```http
GET /api/v1/analytics/features
```

### Get Top Features
```http
GET /api/v1/analytics/top-features?limit=10
```

### Get Retention Rate
```http
GET /api/v1/analytics/retention?days=7
```

### Generate Report
```http
GET /api/v1/analytics/report
```

## Mobile App Integration

### 1. Install Firebase Analytics

```bash
npm install @react-native-firebase/app @react-native-firebase/analytics
```

### 2. Configure Firebase

Add `google-services.json` to `android/app/` directory.

### 3. Initialize Analytics

```typescript
import analyticsService from './services/analytics';

// In App.tsx
useEffect(() => {
  analyticsService.initialize();
}, []);
```

### 4. Track Events

```typescript
import analyticsService, { AnalyticsEvents } from './services/analytics';

// Track disease detection
await analyticsService.logDiseaseDetection({
  disease_name: 'Tomato Late Blight',
  confidence: 0.95,
  severity: 'Moderate',
  detection_time_ms: 1500,
});

// Track screen view
await analyticsService.logScreenView('HomeScreen');

// Track custom event
await analyticsService.logEvent(AnalyticsEvents.BUTTON_CLICKED, {
  button_name: 'get_recommendations',
  screen_name: 'CropRecommendationScreen',
});
```

### 5. Use Analytics Hooks

```typescript
import { useScreenTracking, useFeatureTracking } from './hooks/useAnalytics';

function MyScreen() {
  // Automatically track screen views
  useScreenTracking();
  
  // Track feature usage with timing
  useFeatureTracking('disease_detection');
  
  return <View>...</View>;
}
```

## Event Naming Conventions

### Event Names
- Use snake_case: `disease_detected`, `crop_recommended`
- Be specific: `price_alert_created` not `alert_created`
- Use past tense for completed actions: `disease_detected` not `detect_disease`

### Event Properties
- Use snake_case: `disease_name`, `confidence_score`
- Include relevant context: `screen_name`, `user_id`, `timestamp`
- Keep values simple: strings, numbers, booleans

## Success Metrics Tracked

### Adoption Metrics (Requirement 21.1)
- Total app installations
- Monthly active users (MAU)
- Daily active users (DAU)
- User retention (7-day, 30-day)

### Usage Metrics (Requirement 21.1)
- Disease detections performed
- Crop recommendations requested
- Market price checks
- Scheme views
- Chatbot queries

### Engagement Metrics (Requirement 22.1)
- Average session duration
- Session frequency
- Feature adoption rate
- Screen views per session

### Technical Metrics (Requirement 22.1)
- API response times
- Crash rate
- Offline mode usage
- Sync success rate

### Business Impact Metrics (Requirement 23.1)
- NPS score
- App rating
- Feature completion rate
- User satisfaction

## Weekly Report

The weekly report includes:

1. **Key Metrics**
   - Total users
   - Active users (7-day)
   - Retention rates (7-day, 30-day)
   - Total events

2. **Feature Adoption**
   - Disease detection usage
   - Crop recommendation usage
   - Market price checks
   - Weather forecast views
   - Government scheme views

3. **Top Features**
   - Most used features by event count

4. **Success Metrics**
   - NPS score
   - App rating
   - Crash rate

Reports are sent every Monday at 9:00 AM to configured recipients.

## Data Retention

- Events: 24 hours in Redis (for real-time processing)
- User metrics: 30 days in Redis
- Feature usage counters: 30 days in Redis
- Long-term storage: Export to PostgreSQL/BigQuery for historical analysis

## Privacy & Compliance

- All analytics data is anonymized
- User IDs are hashed before storage
- No PII (Personally Identifiable Information) is tracked
- Users can opt-out of analytics in app settings
- Compliant with DPDP Act 2023

## Testing

```bash
# Run analytics tests
npm test src/services/__tests__/analytics.test.ts

# Test backend analytics
npm test services/shared/analytics/__tests__/
```

## Monitoring

Monitor analytics service health:

```bash
# Check Redis connection
redis-cli ping

# View analytics keys
redis-cli keys "analytics:*"

# Check event count
redis-cli keys "analytics:events:*" | wc -l

# View user metrics
redis-cli get "analytics:user_metrics:USER_ID"
```

## Troubleshooting

### Events not being tracked
1. Check Firebase configuration in `google-services.json`
2. Verify analytics is initialized: `analyticsService.initialize()`
3. Check network connectivity
4. Review logs for errors

### Weekly reports not sending
1. Verify SMTP credentials in `.env`
2. Check cron schedule is running
3. Review email service logs
4. Test email sending manually

### High Redis memory usage
1. Check TTL on analytics keys
2. Implement data archival to PostgreSQL
3. Reduce event retention period
4. Enable Redis eviction policy

## Future Enhancements

- [ ] Export to BigQuery for long-term analysis
- [ ] Real-time dashboard with WebSockets
- [ ] A/B testing framework
- [ ] Funnel analysis
- [ ] Cohort analysis
- [ ] Predictive analytics
- [ ] Custom report builder
