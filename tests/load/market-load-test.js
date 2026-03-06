import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { 
  MARKET_SERVICE_URL, 
  LOAD_TEST_CONFIG, 
  randomItem, 
  TEST_LOCATIONS,
  TEST_CROPS 
} from './config.js';

// Custom metrics
const priceQueryRate = new Rate('price_query_success');
const forecastRate = new Rate('forecast_success');
const priceQueryLatency = new Trend('price_query_latency');

export const options = LOAD_TEST_CONFIG;

const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE3MDQwNjcyMDB9.test';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MOCK_TOKEN}`,
  };
  
  const location = randomItem(TEST_LOCATIONS);
  const crop = randomItem(TEST_CROPS);
  
  // Test 1: Get current market prices
  const priceStart = Date.now();
  const priceRes = http.get(
    `${MARKET_SERVICE_URL}/prices?crop=${crop}&latitude=${location.latitude}&longitude=${location.longitude}&radius=50`,
    {
      headers,
      tags: { name: 'GetPrices' },
    }
  );
  
  const priceSuccess = check(priceRes, {
    'Prices retrieved successfully': (r) => r.status === 200,
    'Returns up to 5 mandis': (r) => {
      const body = r.json();
      return body.prices && body.prices.length <= 5;
    },
    'Response time < 500ms': (r) => r.timings.duration < 500,
    'Has price and trend data': (r) => {
      const body = r.json();
      return body.prices && body.prices.every(p => 
        p.price_per_kg !== undefined && p.trend !== undefined
      );
    },
  });
  
  priceQueryRate.add(priceSuccess);
  priceQueryLatency.add(Date.now() - priceStart);
  
  sleep(1);
  
  // Test 2: Get price forecast (7-day)
  const forecast7Res = http.get(
    `${MARKET_SERVICE_URL}/forecast?crop=${crop}&location=${location.latitude},${location.longitude}&days=7`,
    {
      headers,
      tags: { name: 'GetForecast7Day' },
    }
  );
  
  const forecast7Success = check(forecast7Res, {
    '7-day forecast successful': (r) => r.status === 200,
    'Returns 7 days of data': (r) => {
      const body = r.json();
      return body.forecast && body.forecast.length === 7;
    },
    'Response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  forecastRate.add(forecast7Success);
  
  sleep(1);
  
  // Test 3: Get price forecast (30-day)
  const forecast30Res = http.get(
    `${MARKET_SERVICE_URL}/forecast?crop=${crop}&location=${location.latitude},${location.longitude}&days=30`,
    {
      headers,
      tags: { name: 'GetForecast30Day' },
    }
  );
  
  check(forecast30Res, {
    '30-day forecast successful': (r) => r.status === 200,
    'Returns 30 days of data': (r) => {
      const body = r.json();
      return body.forecast && body.forecast.length === 30;
    },
  });
  
  sleep(1);
  
  // Test 4: Create price alert
  const alertPayload = {
    cropName: crop,
    targetPrice: 25.50,
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
  };
  
  const alertRes = http.post(
    `${MARKET_SERVICE_URL}/alerts`,
    JSON.stringify(alertPayload),
    {
      headers,
      tags: { name: 'CreatePriceAlert' },
    }
  );
  
  check(alertRes, {
    'Alert created successfully': (r) => r.status === 201 || r.status === 200,
    'Returns alert ID': (r) => {
      const body = r.json();
      return body.alertId !== undefined || body.id !== undefined;
    },
  });
  
  sleep(1);
  
  // Test 5: Calculate profit estimate
  const profitPayload = {
    cropName: crop,
    quantity: 1000, // kg
    investmentCost: 50000, // rupees
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
  };
  
  const profitRes = http.post(
    `${MARKET_SERVICE_URL}/profit/calculate`,
    JSON.stringify(profitPayload),
    {
      headers,
      tags: { name: 'CalculateProfit' },
    }
  );
  
  check(profitRes, {
    'Profit calculated successfully': (r) => r.status === 200,
    'Has revenue and profit data': (r) => {
      const body = r.json();
      return body.expectedRevenue !== undefined && body.estimatedProfit !== undefined;
    },
  });
  
  sleep(2);
}

export function handleSummary(data) {
  return {
    'market-load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  let summary = '\n';
  summary += 'Market Service Load Test Summary\n';
  summary += '='.repeat(50) + '\n\n';
  
  summary += 'HTTP Requests:\n';
  summary += `  Total: ${data.metrics.http_reqs.values.count}\n`;
  summary += `  Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  summary += `  Failed: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n\n`;
  
  summary += 'Response Times:\n';
  summary += `  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `  p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  if (data.metrics.price_query_success) {
    summary += 'Price Queries:\n';
    summary += `  Success Rate: ${(data.metrics.price_query_success.values.rate * 100).toFixed(2)}%\n`;
    summary += `  Avg Latency: ${data.metrics.price_query_latency.values.avg.toFixed(2)}ms\n\n`;
  }
  
  if (data.metrics.forecast_success) {
    summary += 'Price Forecasts:\n';
    summary += `  Success Rate: ${(data.metrics.forecast_success.values.rate * 100).toFixed(2)}%\n\n`;
  }
  
  summary += 'Thresholds:\n';
  for (const [name, threshold] of Object.entries(data.thresholds)) {
    const passed = threshold.ok ? '✓' : '✗';
    summary += `  ${passed} ${name}\n`;
  }
  
  return summary;
}
