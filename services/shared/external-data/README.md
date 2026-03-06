# External Data Integration with Fallback Mechanisms

This module provides a robust framework for integrating with external APIs (IMD, Agmarknet, ISRO) with automatic fallback to cached data when APIs fail.

## Features

- **Automatic Fallback**: Falls back to cached data when external APIs fail
- **Data Validation**: Validates all external data before storage
- **Staleness Indicators**: Tracks and reports data age
- **Monitoring & Alerts**: Tracks failures and sends alerts
- **Exponential Backoff**: Retries failed requests with exponential backoff

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   External API Call                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Retry with Exponential Backoff              │
│              (3 attempts: 2s, 4s, 8s)                   │
└─────────────────────────────────────────────────────────┘
                          ↓
                    ┌─────────┐
                    │ Success? │
                    └─────────┘
                    ↙         ↘
                 Yes           No
                  ↓             ↓
         ┌──────────────┐  ┌──────────────┐
         │   Validate   │  │  Use Cached  │
         │     Data     │  │     Data     │
         └──────────────┘  └──────────────┘
                  ↓             ↓
         ┌──────────────┐  ┌──────────────┐
         │    Cache     │  │   Add        │
         │   & Return   │  │  Staleness   │
         └──────────────┘  │  Indicator   │
                           └──────────────┘
```

## Usage

### 1. Extend ExternalDataService

```typescript
import { ExternalDataService, DataValidationResult } from '../../../shared/external-data/externalDataService';

class MyAPIService extends ExternalDataService<MyDataType> {
  protected serviceName = 'MyAPI';
  protected cachePrefix = 'myapi:';
  protected cacheTTL = 3600; // 1 hour
  protected maxStaleTime = 86400; // 24 hours

  async fetchData(params: any) {
    return this.fetchWithFallback('cache-key', async () => {
      // Your API call here
      return await this.callExternalAPI(params);
    });
  }

  protected async validateData(data: MyDataType): Promise<DataValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate your data
    if (!data.requiredField) {
      errors.push('Missing required field');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}
```

### 2. Use in Your Service

```typescript
import myAPIService from './myAPIService';

// Fetch data with automatic fallback
const result = await myAPIService.fetchData({ param: 'value' });

if (result.source === 'cache') {
  console.log('Using cached data');
  console.log('Data age:', result.staleness?.ageMinutes, 'minutes');
  console.log('Staleness level:', result.staleness?.staleness);
}

// Access the data
const data = result.data;
```

### 3. Display Staleness in Mobile App

```typescript
import DataStalenessIndicator from '../components/DataStalenessIndicator';

<DataStalenessIndicator
  staleness={result.staleness}
  source={result.source}
  compact={false}
/>
```

## Staleness Levels

| Level | Age | Description |
|-------|-----|-------------|
| `fresh` | < 10 minutes | Recently fetched data |
| `recent` | 10-60 minutes | Relatively fresh data |
| `stale` | 1-6 hours | Older data, may be outdated |
| `very_stale` | > 6 hours | Very old data, likely outdated |

## Monitoring

### Register Service for Monitoring

```typescript
import { apiMonitor } from '../../../shared/external-data/monitoring';

apiMonitor.registerService({
  service: 'MyAPI',
  failureThreshold: 3,
  timeWindowMinutes: 30,
  alertChannels: ['log', 'sms', 'email'],
});
```

### Record Failures

Failures are automatically recorded by the `ExternalDataService` base class.

### Get Metrics

```typescript
const metrics = await apiMonitor.getMetrics('MyAPI');
console.log('Recent failures:', metrics.recentFailures);
console.log('Total fallbacks:', metrics.totalFallbacks);
console.log('Last failure:', metrics.lastFailureTime);
```

### Prometheus Metrics

The following Prometheus metrics are automatically exported:

- `external_api_failures_total{service, reason}` - Total API failures
- `external_api_fallbacks_total{service, reason}` - Total fallback uses
- `external_api_response_time_seconds{service, status}` - API response time
- `cached_data_staleness_minutes{service}` - Age of cached data

## Configuration

### Cache TTL

Set how long fresh data should be cached:

```typescript
protected cacheTTL = 3600; // 1 hour in seconds
```

### Max Stale Time

Set maximum age for cached data before it's considered too old:

```typescript
protected maxStaleTime = 86400; // 24 hours in seconds
```

### Retry Configuration

Modify retry behavior in your service:

```typescript
private readonly RETRY_ATTEMPTS = 3;
private readonly RETRY_DELAY = 2000; // 2 seconds base delay
```

## Data Validation

Implement the `validateData` method to ensure data quality:

```typescript
protected async validateData(data: MyDataType): Promise<DataValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!data.field1) {
    errors.push('Missing field1');
  }

  // Check data ranges
  if (data.value < 0 || data.value > 100) {
    warnings.push('Value out of expected range');
  }

  // Check data freshness
  const age = Date.now() - new Date(data.timestamp).getTime();
  if (age > 7 * 24 * 60 * 60 * 1000) {
    warnings.push('Data is more than 7 days old');
  }

  return { isValid: errors.length === 0, errors, warnings };
}
```

## Error Handling

### API Failures

When an API fails after all retries:
1. System attempts to use cached data
2. If cached data exists and is not too stale, it's returned with staleness info
3. If no cached data or too stale, error is thrown
4. Failure is logged and metrics are updated

### Validation Failures

When data validation fails:
1. System attempts to use cached data
2. Validation errors are logged
3. Metrics are updated with reason 'validation_failed'

## Alerts

Alerts are sent when failure threshold is exceeded:

```typescript
// Alert triggered when 3 failures occur within 30 minutes
{
  service: 'IMD',
  failureThreshold: 3,
  timeWindowMinutes: 30,
  alertChannels: ['log', 'sms', 'email']
}
```

Alert message format:
```
⚠️ ALERT: IMD API has failed 3 times in the last 30 minutes. 
System is using cached data.
```

## Mobile UI Integration

### Full Indicator

```typescript
<DataStalenessIndicator
  staleness={result.staleness}
  source={result.source}
  compact={false}
/>
```

Shows:
- Icon with color coding (green/orange/red)
- Staleness level message
- Last updated time
- Offline mode description

### Compact Indicator

```typescript
<DataStalenessIndicator
  staleness={result.staleness}
  source={result.source}
  compact={true}
/>
```

Shows:
- Small icon
- Relative time (e.g., "2 hours ago")

## Translations

Staleness messages are available in Hindi and Marathi:

**Hindi:**
- ताज़ा डेटा (Fresh data)
- हाल का डेटा (Recent data)
- पुराना डेटा (Stale data)
- बहुत पुराना डेटा (Very stale data)

**Marathi:**
- ताजा डेटा (Fresh data)
- अलीकडील डेटा (Recent data)
- जुना डेटा (Stale data)
- खूप जुना डेटा (Very stale data)

## Testing

### Test Fallback Mechanism

```typescript
// Mock API failure
jest.spyOn(axios, 'get').mockRejectedValue(new Error('API Error'));

// Should return cached data
const result = await service.fetchData();
expect(result.source).toBe('cache');
expect(result.staleness).toBeDefined();
```

### Test Data Validation

```typescript
// Mock invalid data
const invalidData = { /* missing required fields */ };

// Should fail validation and use cache
const result = await service.fetchData();
expect(result.source).toBe('cache');
```

## Best Practices

1. **Set appropriate cache TTL**: Balance freshness vs. API load
2. **Implement thorough validation**: Catch data quality issues early
3. **Monitor metrics**: Track failure rates and staleness
4. **Test fallback scenarios**: Ensure graceful degradation
5. **Display staleness clearly**: Keep users informed about data age
6. **Set reasonable max stale time**: Don't serve extremely old data
7. **Log validation warnings**: Track data quality trends

## Implemented Services

### IMD Weather Service
- **Cache TTL**: 6 hours
- **Max Stale**: 24 hours
- **Validation**: Temperature, rainfall, humidity, wind speed ranges

### Agmarknet Price Service
- **Cache TTL**: 24 hours
- **Max Stale**: 72 hours
- **Validation**: Price ranges, location coordinates, data freshness

## Future Enhancements

- [ ] SMS/Email alert integration
- [ ] Configurable retry strategies
- [ ] Circuit breaker pattern
- [ ] Data quality scoring
- [ ] Automatic cache warming
- [ ] Multi-level caching (memory + Redis)
- [ ] Compression for large datasets
- [ ] Delta sync for incremental updates
