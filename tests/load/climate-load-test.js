import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { 
  CLIMATE_SERVICE_URL, 
  LOAD_TEST_CONFIG, 
  randomItem, 
  TEST_LOCATIONS,
  TEST_CROPS 
} from './config.js';

// Custom metrics
const weatherQueryRate = new Rate('weather_query_success');
const waterAdvisoryRate = new Rate('water_advisory_success');
const weatherLatency = new Trend('weather_query_latency');

export const options = LOAD_TEST_CONFIG;

const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE3MDQwNjcyMDB9.test';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MOCK_TOKEN}`,
  };
  
  const location = randomItem(TEST_LOCATIONS);
  const crop = randomItem(TEST_CROPS);
  
  // Test 1: Get weather forecast
  const weatherStart = Date.now();
  const weatherRes = http.get(
    `${CLIMATE_SERVICE_URL}/weather/forecast?latitude=${location.latitude}&longitude=${location.longitude}&days=7`,
    {
      headers,
      tags: { name: 'GetWeatherForecast' },
    }
  );
  
  const weatherSuccess = check(weatherRes, {
    'Weather forecast retrieved': (r) => r.status === 200,
    'Returns 7 days of forecast': (r) => {
      const body = r.json();
      return body.forecast && body.forecast.length === 7;
    },
    'Response time < 500ms': (r) => r.timings.duration < 500,
    'Has temperature and rainfall': (r) => {
      const body = r.json();
      return body.forecast && body.forecast.every(f => 
        f.temperature !== undefined && f.rainfall !== undefined
      );
    },
  });
  
  weatherQueryRate.add(weatherSuccess);
  weatherLatency.add(Date.now() - weatherStart);
  
  sleep(1);
  
  // Test 2: Get water advisory
  const waterPayload = {
    farmId: `farm-${__VU}-${__ITER}`,
    cropId: `crop-${__VU}-${__ITER}`,
    cropName: crop,
    growthStage: randomItem(['initial', 'mid', 'late']),
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    soilMoisture: Math.random() * 30 + 10, // 10-40mm
  };
  
  const waterRes = http.post(
    `${CLIMATE_SERVICE_URL}/water/advisory`,
    JSON.stringify(waterPayload),
    {
      headers,
      tags: { name: 'GetWaterAdvisory' },
    }
  );
  
  const waterSuccess = check(waterRes, {
    'Water advisory retrieved': (r) => r.status === 200,
    'Has irrigation recommendation': (r) => {
      const body = r.json();
      return body.irrigate !== undefined;
    },
    'Response time < 500ms': (r) => r.timings.duration < 500,
    'Has water amount and timing': (r) => {
      const body = r.json();
      if (body.irrigate) {
        return body.amount_mm !== undefined && body.timing !== undefined;
      }
      return true;
    },
  });
  
  waterAdvisoryRate.add(waterSuccess);
  
  sleep(1);
  
  // Test 3: Get water savings tracking
  const savingsRes = http.get(
    `${CLIMATE_SERVICE_URL}/water/savings?farmId=farm-${__VU}-${__ITER}&startDate=2024-01-01&endDate=2024-12-31`,
    {
      headers,
      tags: { name: 'GetWaterSavings' },
    }
  );
  
  check(savingsRes, {
    'Water savings retrieved': (r) => r.status === 200 || r.status === 404,
    'Has savings data': (r) => {
      if (r.status === 200) {
        const body = r.json();
        return body.total_water_saved_mm !== undefined;
      }
      return true;
    },
  });
  
  sleep(1);
  
  // Test 4: Get climate risk assessment
  const riskRes = http.get(
    `${CLIMATE_SERVICE_URL}/risk/assess?latitude=${location.latitude}&longitude=${location.longitude}&cropName=${crop}`,
    {
      headers,
      tags: { name: 'GetClimateRisk' },
    }
  );
  
  check(riskRes, {
    'Risk assessment retrieved': (r) => r.status === 200,
    'Has risk level': (r) => {
      const body = r.json();
      return body.riskLevel !== undefined;
    },
  });
  
  sleep(1);
  
  // Test 5: Get critical weather alerts
  const alertsRes = http.get(
    `${CLIMATE_SERVICE_URL}/alerts?latitude=${location.latitude}&longitude=${location.longitude}`,
    {
      headers,
      tags: { name: 'GetWeatherAlerts' },
    }
  );
  
  check(alertsRes, {
    'Alerts retrieved successfully': (r) => r.status === 200,
    'Returns alerts array': (r) => {
      const body = r.json();
      return Array.isArray(body.alerts);
    },
  });
  
  sleep(2);
}

export function handleSummary(data) {
  return {
    'climate-load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  let summary = '\n';
  summary += 'Climate Service Load Test Summary\n';
  summary += '='.repeat(50) + '\n\n';
  
  summary += 'HTTP Requests:\n';
  summary += `  Total: ${data.metrics.http_reqs.values.count}\n`;
  summary += `  Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  summary += `  Failed: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n\n`;
  
  summary += 'Response Times:\n';
  summary += `  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `  p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  if (data.metrics.weather_query_success) {
    summary += 'Weather Queries:\n';
    summary += `  Success Rate: ${(data.metrics.weather_query_success.values.rate * 100).toFixed(2)}%\n`;
    summary += `  Avg Latency: ${data.metrics.weather_query_latency.values.avg.toFixed(2)}ms\n\n`;
  }
  
  if (data.metrics.water_advisory_success) {
    summary += 'Water Advisory:\n';
    summary += `  Success Rate: ${(data.metrics.water_advisory_success.values.rate * 100).toFixed(2)}%\n\n`;
  }
  
  summary += 'Thresholds:\n';
  for (const [name, threshold] of Object.entries(data.thresholds)) {
    const passed = threshold.ok ? '✓' : '✗';
    summary += `  ${passed} ${name}\n`;
  }
  
  return summary;
}
