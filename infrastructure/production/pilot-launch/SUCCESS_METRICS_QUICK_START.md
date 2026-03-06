# Success Metrics System - Quick Start Guide

## Overview

This guide helps you quickly set up and start using the KrishiAI success metrics tracking system.

## Prerequisites

- PostgreSQL database running
- Redis server running
- Node.js backend server
- React Native mobile app

## Setup Steps

### 1. Database Setup

Run the migration to create success metrics tables:

```bash
# Connect to your database
psql -U postgres -d krishiai_db

# Run the migration
\i infrastructure/production/pilot-launch/migrations/create-success-metrics-tables.sql

# Verify tables were created
\dt app_installations
\dt user_activity
\dt feature_usage
\dt nps_surveys
\dt farmer_outcome_surveys
```

### 2. Backend Integration

Add success metrics routes to your server:

```typescript
// In your main server file (e.g., pilot-dashboard.ts or app.ts)
import { createSuccessMetricsRoutes } from './infrastructure/production/pilot-launch/success-metrics-routes';
import { Pool } from 'pg';
import { createClient } from 'redis';

// Initialize database and Redis
const db = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});
await redis.connect();

// Add success metrics routes
const successMetricsRouter = createSuccessMetricsRoutes(db, redis);
app.use('/api/success-metrics', successMetricsRouter);
```

### 3. Mobile App Integration

#### Install Dependencies

```bash
cd mobile/krishiai-app
npm install react-native-device-info @react-native-async-storage/async-storage
```

#### Initialize Success Metrics Service

```typescript
// In App.tsx or your main app component
import { successMetricsService } from './src/services/successMetrics';
import { useEffect } from 'react';
import { AppState } from 'react-native';

function App() {
  useEffect(() => {
    const initMetrics = async () => {
      const userId = await getUserId(); // Your user ID retrieval logic
      
      // Track installation (first launch only)
      await successMetricsService.trackInstallation(userId);
      
      // Recover any incomplete session
      await successMetricsService.recoverSession(userId);
      
      // Start new session
      await successMetricsService.startSession();
    };
    
    initMetrics();
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      const userId = await getUserId();
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        await successMetricsService.endSession(userId);
      } else if (nextAppState === 'active') {
        await successMetricsService.startSession();
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    // Your app components
  );
}
```

### 4. Track Feature Usage

Add tracking to your feature screens:

```typescript
// In DiseaseDetectionScreen.tsx
import { successMetricsService } from '../services/successMetrics';

const DiseaseDetectionScreen = () => {
  useEffect(() => {
    successMetricsService.trackScreenVisit('DiseaseDetectionScreen');
  }, []);

  const handleDetection = async () => {
    const userId = await getUserId();
    
    // Track feature usage
    await successMetricsService.trackFeatureUsage(userId, 'disease_detection');
    
    // Your detection logic
    // ...
  };

  return (
    // Your UI
  );
};
```

### 5. Implement NPS Survey

Create an NPS survey component:

```typescript
// In NPSSurveyModal.tsx
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { successMetricsService } from '../services/successMetrics';

interface NPSSurveyModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

const NPSSurveyModal: React.FC<NPSSurveyModalProps> = ({ visible, onClose, userId }) => {
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');

  const handleSubmit = async () => {
    if (score !== null) {
      await successMetricsService.submitNPSSurvey(userId, score, feedback);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.container}>
        <Text style={styles.question}>
          How likely are you to recommend KrishiAI to other farmers?
        </Text>
        
        <View style={styles.scoreContainer}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <TouchableOpacity
              key={num}
              style={[styles.scoreButton, score === num && styles.scoreButtonSelected]}
              onPress={() => setScore(num)}
            >
              <Text style={styles.scoreText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <TextInput
          style={styles.feedbackInput}
          placeholder="Tell us why (optional)"
          value={feedback}
          onChangeText={setFeedback}
          multiline
        />
        
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};
```

Show the survey after 30 days:

```typescript
// In HomeScreen.tsx
useEffect(() => {
  const checkNPSSurvey = async () => {
    const days = await successMetricsService.getDaysSinceInstallation();
    const shouldShow = await successMetricsService.shouldShowNPSSurvey('monthly');
    
    if (days >= 30 && shouldShow) {
      setShowNPSSurvey(true);
    }
  };
  
  checkNPSSurvey();
}, []);
```

### 6. Implement Farmer Outcome Survey

Create a farmer outcome survey component:

```typescript
// In FarmerOutcomeSurveyModal.tsx
import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { successMetricsService } from '../services/successMetrics';

const FarmerOutcomeSurveyModal = ({ visible, onClose, userId, surveyPeriod }) => {
  const [income, setIncome] = useState('');
  const [incomeIncrease, setIncomeIncrease] = useState('');
  const [waterUsage, setWaterUsage] = useState('');
  const [waterReduction, setWaterReduction] = useState('');
  const [cropLoss, setCropLoss] = useState('');
  const [cropLossReduction, setCropLossReduction] = useState('');
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [challenges, setChallenges] = useState('');
  const [suggestions, setSuggestions] = useState('');

  const handleSubmit = async () => {
    await successMetricsService.submitFarmerOutcomeSurvey(userId, {
      surveyPeriod,
      monthlyIncomeInr: parseFloat(income),
      incomeIncreasePercentage: parseFloat(incomeIncrease),
      waterUsageMm: parseFloat(waterUsage),
      waterReductionPercentage: parseFloat(waterReduction),
      cropLossPercentage: parseFloat(cropLoss),
      cropLossReductionPercentage: parseFloat(cropLossReduction),
      satisfactionScore: satisfaction,
      challengesFaced: challenges,
      suggestions,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      {/* Survey form UI */}
    </Modal>
  );
};
```

Show the survey at appropriate intervals:

```typescript
// Show after 3 months
useEffect(() => {
  const checkOutcomeSurvey = async () => {
    const days = await successMetricsService.getDaysSinceInstallation();
    const shouldShow = await successMetricsService.shouldShowFarmerOutcomeSurvey('month_3');
    
    if (days >= 90 && shouldShow) {
      setShowOutcomeSurvey(true);
      setSurveyPeriod('month_3');
    }
  };
  
  checkOutcomeSurvey();
}, []);
```

## Accessing the Dashboard

### 1. Start Your Server

```bash
npm start
```

### 2. Open Dashboard in Browser

```
http://localhost:3000/api/success-metrics/dashboard
```

### 3. View Metrics via API

```bash
# Get summary metrics
curl http://localhost:3000/api/success-metrics/summary

# Get metrics with targets
curl http://localhost:3000/api/success-metrics/targets

# Get cohort analysis
curl http://localhost:3000/api/success-metrics/cohorts

# Get feature adoption
curl http://localhost:3000/api/success-metrics/features

# Generate report
curl http://localhost:3000/api/success-metrics/report > pilot-report.md
```

## Testing the System

### 1. Test Installation Tracking

```bash
# From mobile app or via API
curl -X POST http://localhost:3000/api/success-metrics/installation \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "deviceId": "device456",
    "deviceModel": "Samsung Galaxy A10",
    "androidVersion": "10",
    "appVersion": "1.0.0",
    "installationSource": "coordinator"
  }'
```

### 2. Test Activity Tracking

```bash
curl -X POST http://localhost:3000/api/success-metrics/activity \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "activityDate": "2026-01-15",
    "sessionCount": 1,
    "totalSessionDurationSeconds": 420,
    "featuresUsed": ["disease_detection", "market_prices"]
  }'
```

### 3. Test NPS Survey

```bash
curl -X POST http://localhost:3000/api/success-metrics/nps \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "score": 9,
    "feedbackText": "Great app! Very helpful for my farming.",
    "surveyType": "monthly"
  }'
```

### 4. Test Farmer Outcome Survey

```bash
curl -X POST http://localhost:3000/api/success-metrics/farmer-outcome \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "surveyPeriod": "month_3",
    "monthlyIncomeInr": 25000,
    "incomeIncreasePercentage": 18,
    "waterUsageMm": 400,
    "waterReductionPercentage": 22,
    "cropLossPercentage": 8,
    "cropLossReductionPercentage": 28,
    "satisfactionScore": 5,
    "challengesFaced": "Initial learning curve",
    "suggestions": "Add more video tutorials"
  }'
```

## Monitoring

### Check Database

```sql
-- Check installations
SELECT COUNT(*) FROM app_installations WHERE is_active = TRUE;

-- Check MAU
SELECT COUNT(DISTINCT user_id) FROM user_activity 
WHERE activity_date >= CURRENT_DATE - INTERVAL '30 days';

-- Check metrics summary
SELECT * FROM success_metrics_summary;

-- Check retention cohorts
SELECT * FROM retention_cohort_analysis;

-- Check feature adoption
SELECT * FROM feature_adoption_metrics;
```

### Check Redis Cache

```bash
redis-cli

# Check cached metrics
GET success_metrics:summary

# Clear cache if needed
DEL success_metrics:summary
```

## Troubleshooting

### Issue: Metrics not updating

**Solution**: Clear Redis cache
```bash
redis-cli DEL success_metrics:summary
```

### Issue: Dashboard not loading

**Solution**: Check server logs and ensure routes are registered
```bash
# Check if endpoint is accessible
curl http://localhost:3000/api/success-metrics/summary
```

### Issue: Mobile app not tracking

**Solution**: Check API client configuration and network connectivity
```typescript
// Verify API base URL is correct
console.log(apiClient.defaults.baseURL);
```

### Issue: Database errors

**Solution**: Verify migration was run successfully
```sql
-- Check if tables exist
\dt app_installations
\dt user_activity

-- Check if views exist
\dv success_metrics_summary
```

## Best Practices

1. **Track Early**: Start tracking from day 1 of pilot
2. **Survey Timing**: Show surveys at appropriate intervals (30 days, 90 days, etc.)
3. **Non-Blocking**: All tracking should be non-blocking and not affect user experience
4. **Error Handling**: Gracefully handle tracking failures without breaking app
5. **Privacy**: Ensure user consent before collecting data
6. **Cache Management**: Monitor Redis cache hit rates
7. **Database Performance**: Monitor query performance and add indexes if needed
8. **Regular Reports**: Generate weekly reports for stakeholders

## Next Steps

1. Deploy to production environment
2. Train coordinators on dashboard usage
3. Set up automated weekly reports
4. Configure alerts for at-risk metrics
5. Integrate with Grafana for advanced visualization
6. Set up A/B testing for feature variants

## Support

For issues or questions:
- Check logs: `tail -f logs/success-metrics.log`
- Review implementation: `TASK_19.4_IMPLEMENTATION.md`
- Contact: dev-team@krishiai.com

---

**Last Updated**: January 2026  
**Version**: 1.0.0
