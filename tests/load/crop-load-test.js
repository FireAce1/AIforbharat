import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { 
  CROP_SERVICE_URL, 
  LOAD_TEST_CONFIG, 
  randomItem, 
  TEST_LOCATIONS,
  TEST_SOIL_TYPES,
  TEST_IRRIGATION_TYPES 
} from './config.js';

// Custom metrics
const recommendationRate = new Rate('crop_recommendation_success');
const recommendationLatency = new Trend('crop_recommendation_latency');
const diseaseDetectionRate = new Rate('disease_detection_success');

export const options = LOAD_TEST_CONFIG;

// Mock JWT token for testing (in real scenario, get from auth service)
const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE3MDQwNjcyMDB9.test';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MOCK_TOKEN}`,
  };
  
  // Test 1: Get crop recommendations
  const location = randomItem(TEST_LOCATIONS);
  const recommendPayload = {
    farmId: `farm-${__VU}-${__ITER}`,
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    soilType: randomItem(TEST_SOIL_TYPES),
    irrigationType: randomItem(TEST_IRRIGATION_TYPES),
    landSize: Math.random() * 5 + 0.5, // 0.5 to 5.5 hectares
  };
  
  const recommendStart = Date.now();
  const recommendRes = http.post(
    `${CROP_SERVICE_URL}/recommend`,
    JSON.stringify(recommendPayload),
    {
      headers,
      tags: { name: 'CropRecommendation' },
    }
  );
  
  const recommendSuccess = check(recommendRes, {
    'Recommendation successful': (r) => r.status === 200,
    'Returns 3 recommendations': (r) => {
      const body = r.json();
      return body.recommendations && body.recommendations.length === 3;
    },
    'Response time < 500ms': (r) => r.timings.duration < 500,
    'Has confidence scores': (r) => {
      const body = r.json();
      return body.recommendations && body.recommendations.every(rec => rec.confidence !== undefined);
    },
  });
  
  recommendationRate.add(recommendSuccess);
  recommendationLatency.add(Date.now() - recommendStart);
  
  if (!recommendSuccess) {
    console.error(`Crop recommendation failed: ${recommendRes.status} - ${recommendRes.body}`);
  }
  
  sleep(2);
  
  // Test 2: Disease detection (simulated with base64 image)
  const mockImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  const diseasePayload = {
    cropId: `crop-${__VU}-${__ITER}`,
    image: mockImageBase64,
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
  };
  
  const diseaseRes = http.post(
    `${CROP_SERVICE_URL}/disease/detect`,
    JSON.stringify(diseasePayload),
    {
      headers,
      tags: { name: 'DiseaseDetection' },
    }
  );
  
  const diseaseSuccess = check(diseaseRes, {
    'Disease detection successful': (r) => r.status === 200 || r.status === 400, // 400 for invalid image is acceptable
    'Has disease info or error': (r) => {
      const body = r.json();
      return body.disease !== undefined || body.error !== undefined;
    },
  });
  
  diseaseDetectionRate.add(diseaseSuccess);
  
  sleep(1);
  
  // Test 3: Get yield prediction
  const yieldRes = http.get(
    `${CROP_SERVICE_URL}/yield/predict?cropId=crop-${__VU}-${__ITER}&cropName=rice`,
    {
      headers,
      tags: { name: 'YieldPrediction' },
    }
  );
  
  check(yieldRes, {
    'Yield prediction successful': (r) => r.status === 200 || r.status === 404,
    'Response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
  
  // Test 4: Get crop calendar
  const calendarRes = http.get(
    `${CROP_SERVICE_URL}/calendar?cropName=rice&location=${location.latitude},${location.longitude}`,
    {
      headers,
      tags: { name: 'CropCalendar' },
    }
  );
  
  check(calendarRes, {
    'Calendar retrieved successfully': (r) => r.status === 200,
    'Has sowing and harvest dates': (r) => {
      const body = r.json();
      return body.sowingWindow !== undefined && body.harvestWindow !== undefined;
    },
  });
  
  sleep(2);
}

export function handleSummary(data) {
  return {
    'crop-load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  let summary = '\n';
  summary += 'Crop Service Load Test Summary\n';
  summary += '='.repeat(50) + '\n\n';
  
  summary += 'HTTP Requests:\n';
  summary += `  Total: ${data.metrics.http_reqs.values.count}\n`;
  summary += `  Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  summary += `  Failed: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n\n`;
  
  summary += 'Response Times:\n';
  summary += `  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `  p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  if (data.metrics.crop_recommendation_success) {
    summary += 'Crop Recommendations:\n';
    summary += `  Success Rate: ${(data.metrics.crop_recommendation_success.values.rate * 100).toFixed(2)}%\n`;
    summary += `  Avg Latency: ${data.metrics.crop_recommendation_latency.values.avg.toFixed(2)}ms\n\n`;
  }
  
  if (data.metrics.disease_detection_success) {
    summary += 'Disease Detection:\n';
    summary += `  Success Rate: ${(data.metrics.disease_detection_success.values.rate * 100).toFixed(2)}%\n\n`;
  }
  
  summary += 'Thresholds:\n';
  for (const [name, threshold] of Object.entries(data.thresholds)) {
    const passed = threshold.ok ? '✓' : '✗';
    summary += `  ${passed} ${name}\n`;
  }
  
  return summary;
}
