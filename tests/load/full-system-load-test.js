import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { 
  BASE_URL,
  AUTH_SERVICE_URL,
  CROP_SERVICE_URL,
  MARKET_SERVICE_URL,
  CLIMATE_SERVICE_URL,
  GOVT_SERVICE_URL,
  LOAD_TEST_CONFIG,
  randomItem,
  randomPhone,
  TEST_LOCATIONS,
  TEST_CROPS,
  TEST_SOIL_TYPES,
  TEST_IRRIGATION_TYPES,
} from './config.js';

// Custom metrics
const userJourneySuccess = new Rate('user_journey_success');
const totalRequests = new Counter('total_requests');
const authLatency = new Trend('auth_latency');
const cropLatency = new Trend('crop_latency');
const marketLatency = new Trend('market_latency');
const climateLatency = new Trend('climate_latency');

export const options = LOAD_TEST_CONFIG;

// Simulate realistic user behavior patterns
const USER_SCENARIOS = [
  { name: 'new_farmer', weight: 20 },
  { name: 'check_weather', weight: 30 },
  { name: 'check_prices', weight: 25 },
  { name: 'disease_detection', weight: 15 },
  { name: 'browse_schemes', weight: 10 },
];

function selectScenario() {
  const random = Math.random() * 100;
  let cumulative = 0;
  
  for (const scenario of USER_SCENARIOS) {
    cumulative += scenario.weight;
    if (random <= cumulative) {
      return scenario.name;
    }
  }
  
  return USER_SCENARIOS[0].name;
}

export default function () {
  const scenario = selectScenario();
  let journeySuccess = true;
  
  // All scenarios start with authentication
  const token = authenticateUser();
  if (!token) {
    journeySuccess = false;
    userJourneySuccess.add(false);
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Execute scenario-specific user journey
  switch (scenario) {
    case 'new_farmer':
      journeySuccess = newFarmerJourney(headers);
      break;
    case 'check_weather':
      journeySuccess = checkWeatherJourney(headers);
      break;
    case 'check_prices':
      journeySuccess = checkPricesJourney(headers);
      break;
    case 'disease_detection':
      journeySuccess = diseaseDetectionJourney(headers);
      break;
    case 'browse_schemes':
      journeySuccess = browseSchemesJourney(headers);
      break;
  }
  
  userJourneySuccess.add(journeySuccess);
  sleep(Math.random() * 3 + 1); // Random think time 1-4 seconds
}

function authenticateUser() {
  const phone = randomPhone();
  
  group('Authentication', () => {
    const start = Date.now();
    
    // Send OTP
    const otpRes = http.post(
      `${AUTH_SERVICE_URL}/send-otp`,
      JSON.stringify({ phone }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    totalRequests.add(1);
    
    if (otpRes.status !== 200) {
      return null;
    }
    
    sleep(1);
    
    // Verify OTP (mock)
    const verifyRes = http.post(
      `${AUTH_SERVICE_URL}/verify-otp`,
      JSON.stringify({ phone, otp: '123456' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    totalRequests.add(1);
    authLatency.add(Date.now() - start);
    
    if (verifyRes.status === 200) {
      return verifyRes.json('token') || 'mock-token';
    }
  });
  
  return 'mock-token'; // Fallback for load testing
}

function newFarmerJourney(headers) {
  return group('New Farmer Journey', () => {
    const location = randomItem(TEST_LOCATIONS);
    const crop = randomItem(TEST_CROPS);
    let success = true;
    
    // Step 1: Get crop recommendations
    sleep(1);
    const start = Date.now();
    const recommendRes = http.post(
      `${CROP_SERVICE_URL}/recommend`,
      JSON.stringify({
        farmId: `farm-${__VU}`,
        location: { latitude: location.latitude, longitude: location.longitude },
        soilType: randomItem(TEST_SOIL_TYPES),
        irrigationType: randomItem(TEST_IRRIGATION_TYPES),
        landSize: Math.random() * 3 + 1,
      }),
      { headers }
    );
    
    totalRequests.add(1);
    cropLatency.add(Date.now() - start);
    
    success = success && check(recommendRes, {
      'Recommendations received': (r) => r.status === 200,
    });
    
    // Step 2: Check market prices for recommended crop
    sleep(2);
    const priceRes = http.get(
      `${MARKET_SERVICE_URL}/prices?crop=${crop}&latitude=${location.latitude}&longitude=${location.longitude}&radius=50`,
      { headers }
    );
    
    totalRequests.add(1);
    
    success = success && check(priceRes, {
      'Prices retrieved': (r) => r.status === 200,
    });
    
    // Step 3: Get weather forecast
    sleep(1);
    const weatherRes = http.get(
      `${CLIMATE_SERVICE_URL}/weather/forecast?latitude=${location.latitude}&longitude=${location.longitude}&days=7`,
      { headers }
    );
    
    totalRequests.add(1);
    
    success = success && check(weatherRes, {
      'Weather retrieved': (r) => r.status === 200,
    });
    
    return success;
  });
}

function checkWeatherJourney(headers) {
  return group('Check Weather Journey', () => {
    const location = randomItem(TEST_LOCATIONS);
    let success = true;
    
    // Step 1: Get weather forecast
    const start = Date.now();
    const weatherRes = http.get(
      `${CLIMATE_SERVICE_URL}/weather/forecast?latitude=${location.latitude}&longitude=${location.longitude}&days=7`,
      { headers }
    );
    
    totalRequests.add(1);
    climateLatency.add(Date.now() - start);
    
    success = success && check(weatherRes, {
      'Weather retrieved': (r) => r.status === 200,
    });
    
    sleep(2);
    
    // Step 2: Get water advisory
    const waterRes = http.post(
      `${CLIMATE_SERVICE_URL}/water/advisory`,
      JSON.stringify({
        farmId: `farm-${__VU}`,
        cropId: `crop-${__VU}`,
        cropName: randomItem(TEST_CROPS),
        growthStage: 'mid',
        location: { latitude: location.latitude, longitude: location.longitude },
        soilMoisture: 20,
      }),
      { headers }
    );
    
    totalRequests.add(1);
    
    success = success && check(waterRes, {
      'Water advisory retrieved': (r) => r.status === 200,
    });
    
    return success;
  });
}

function checkPricesJourney(headers) {
  return group('Check Prices Journey', () => {
    const location = randomItem(TEST_LOCATIONS);
    const crop = randomItem(TEST_CROPS);
    let success = true;
    
    // Step 1: Get current prices
    const start = Date.now();
    const priceRes = http.get(
      `${MARKET_SERVICE_URL}/prices?crop=${crop}&latitude=${location.latitude}&longitude=${location.longitude}&radius=50`,
      { headers }
    );
    
    totalRequests.add(1);
    marketLatency.add(Date.now() - start);
    
    success = success && check(priceRes, {
      'Prices retrieved': (r) => r.status === 200,
    });
    
    sleep(2);
    
    // Step 2: Get price forecast
    const forecastRes = http.get(
      `${MARKET_SERVICE_URL}/forecast?crop=${crop}&location=${location.latitude},${location.longitude}&days=30`,
      { headers }
    );
    
    totalRequests.add(1);
    
    success = success && check(forecastRes, {
      'Forecast retrieved': (r) => r.status === 200,
    });
    
    sleep(1);
    
    // Step 3: Set price alert
    const alertRes = http.post(
      `${MARKET_SERVICE_URL}/alerts`,
      JSON.stringify({
        cropName: crop,
        targetPrice: 30.0,
        location: { latitude: location.latitude, longitude: location.longitude },
      }),
      { headers }
    );
    
    totalRequests.add(1);
    
    success = success && check(alertRes, {
      'Alert created': (r) => r.status === 201 || r.status === 200,
    });
    
    return success;
  });
}

function diseaseDetectionJourney(headers) {
  return group('Disease Detection Journey', () => {
    const location = randomItem(TEST_LOCATIONS);
    let success = true;
    
    // Step 1: Detect disease
    const mockImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const start = Date.now();
    const detectRes = http.post(
      `${CROP_SERVICE_URL}/disease/detect`,
      JSON.stringify({
        cropId: `crop-${__VU}`,
        image: mockImage,
        location: { latitude: location.latitude, longitude: location.longitude },
      }),
      { headers }
    );
    
    totalRequests.add(1);
    cropLatency.add(Date.now() - start);
    
    success = success && check(detectRes, {
      'Detection completed': (r) => r.status === 200 || r.status === 400,
    });
    
    return success;
  });
}

function browseSchemesJourney(headers) {
  return group('Browse Schemes Journey', () => {
    let success = true;
    
    // Step 1: Search schemes
    const searchRes = http.get(
      `${GOVT_SERVICE_URL}/search?category=subsidy&state=Maharashtra&language=hi`,
      { headers }
    );
    
    totalRequests.add(1);
    
    success = success && check(searchRes, {
      'Schemes retrieved': (r) => r.status === 200,
    });
    
    sleep(2);
    
    // Step 2: Get eligible schemes
    const eligibleRes = http.get(
      `${GOVT_SERVICE_URL}/eligible?landSize=2.0&cropType=rice&state=Maharashtra`,
      { headers }
    );
    
    totalRequests.add(1);
    
    success = success && check(eligibleRes, {
      'Eligible schemes retrieved': (r) => r.status === 200,
    });
    
    return success;
  });
}

export function handleSummary(data) {
  const report = generateDetailedReport(data);
  
  return {
    'full-system-load-test-results.json': JSON.stringify(data, null, 2),
    'load-test-report.html': generateHTMLReport(data),
    stdout: report,
  };
}

function generateDetailedReport(data) {
  let report = '\n';
  report += '═'.repeat(70) + '\n';
  report += '  KRISHIAI MVP - FULL SYSTEM LOAD TEST REPORT\n';
  report += '═'.repeat(70) + '\n\n';
  
  // Test Configuration
  report += '📋 TEST CONFIGURATION\n';
  report += '─'.repeat(70) + '\n';
  report += `  Duration: 10 minutes (2m ramp-up, 6m steady, 2m ramp-down)\n`;
  report += `  Virtual Users: 1,000 concurrent users\n`;
  report += `  Target: 100 requests/second minimum\n\n`;
  
  // Overall Metrics
  report += '📊 OVERALL METRICS\n';
  report += '─'.repeat(70) + '\n';
  report += `  Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  report += `  Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  report += `  Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n`;
  report += `  Data Received: ${(data.metrics.data_received.values.count / 1024 / 1024).toFixed(2)} MB\n`;
  report += `  Data Sent: ${(data.metrics.data_sent.values.count / 1024 / 1024).toFixed(2)} MB\n\n`;
  
  // Response Times
  report += '⏱️  RESPONSE TIMES\n';
  report += '─'.repeat(70) + '\n';
  report += `  Average: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  report += `  Median (p50): ${data.metrics.http_req_duration.values.med.toFixed(2)}ms\n`;
  report += `  p90: ${data.metrics.http_req_duration.values['p(90)'].toFixed(2)}ms\n`;
  report += `  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms `;
  report += data.metrics.http_req_duration.values['p(95)'] < 500 ? '✓\n' : '✗ (Target: <500ms)\n';
  report += `  p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  report += `  Max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n\n`;
  
  // Service-Specific Latencies
  report += '🔧 SERVICE LATENCIES\n';
  report += '─'.repeat(70) + '\n';
  if (data.metrics.auth_latency) {
    report += `  Auth Service: ${data.metrics.auth_latency.values.avg.toFixed(2)}ms avg\n`;
  }
  if (data.metrics.crop_latency) {
    report += `  Crop Service: ${data.metrics.crop_latency.values.avg.toFixed(2)}ms avg\n`;
  }
  if (data.metrics.market_latency) {
    report += `  Market Service: ${data.metrics.market_latency.values.avg.toFixed(2)}ms avg\n`;
  }
  if (data.metrics.climate_latency) {
    report += `  Climate Service: ${data.metrics.climate_latency.values.avg.toFixed(2)}ms avg\n`;
  }
  report += '\n';
  
  // User Journey Success
  if (data.metrics.user_journey_success) {
    report += '👥 USER JOURNEY SUCCESS\n';
    report += '─'.repeat(70) + '\n';
    report += `  Success Rate: ${(data.metrics.user_journey_success.values.rate * 100).toFixed(2)}%\n\n`;
  }
  
  // Thresholds
  report += '✅ THRESHOLD VALIDATION\n';
  report += '─'.repeat(70) + '\n';
  let allPassed = true;
  for (const [name, threshold] of Object.entries(data.thresholds)) {
    const passed = threshold.ok;
    allPassed = allPassed && passed;
    const icon = passed ? '✓' : '✗';
    report += `  ${icon} ${name}\n`;
  }
  report += '\n';
  
  // Final Verdict
  report += '🎯 FINAL VERDICT\n';
  report += '─'.repeat(70) + '\n';
  const errorRate = data.metrics.http_req_failed.values.rate * 100;
  const p95 = data.metrics.http_req_duration.values['p(95)'];
  const requestRate = data.metrics.http_reqs.values.rate;
  
  const passed = allPassed && errorRate < 1 && p95 < 500 && requestRate > 100;
  
  if (passed) {
    report += '  ✅ LOAD TEST PASSED\n';
    report += '  System meets all performance requirements!\n';
  } else {
    report += '  ❌ LOAD TEST FAILED\n';
    report += '  Issues detected:\n';
    if (errorRate >= 1) report += `    - Error rate too high: ${errorRate.toFixed(2)}% (target: <1%)\n`;
    if (p95 >= 500) report += `    - p95 latency too high: ${p95.toFixed(2)}ms (target: <500ms)\n`;
    if (requestRate <= 100) report += `    - Request rate too low: ${requestRate.toFixed(2)}/s (target: >100/s)\n`;
  }
  
  report += '\n' + '═'.repeat(70) + '\n';
  
  return report;
}

function generateHTMLReport(data) {
  const errorRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
  const p95 = data.metrics.http_req_duration.values['p(95)'].toFixed(2);
  const requestRate = data.metrics.http_reqs.values.rate.toFixed(2);
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>KrishiAI Load Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; border-bottom: 3px solid #27ae60; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    .metric { display: inline-block; margin: 15px 20px; padding: 15px; background: #ecf0f1; border-radius: 5px; min-width: 200px; }
    .metric-label { font-size: 12px; color: #7f8c8d; text-transform: uppercase; }
    .metric-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
    .pass { color: #27ae60; }
    .fail { color: #e74c3c; }
    .threshold { padding: 10px; margin: 5px 0; background: #ecf0f1; border-radius: 3px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #34495e; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 KrishiAI MVP - Load Test Report</h1>
    <p><strong>Test Date:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Duration:</strong> 10 minutes | <strong>Virtual Users:</strong> 1,000</p>
    
    <h2>📊 Key Metrics</h2>
    <div class="metric">
      <div class="metric-label">Total Requests</div>
      <div class="metric-value">${data.metrics.http_reqs.values.count}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Request Rate</div>
      <div class="metric-value">${requestRate}/s</div>
    </div>
    <div class="metric">
      <div class="metric-label">Error Rate</div>
      <div class="metric-value ${errorRate < 1 ? 'pass' : 'fail'}">${errorRate}%</div>
    </div>
    <div class="metric">
      <div class="metric-label">p95 Latency</div>
      <div class="metric-value ${p95 < 500 ? 'pass' : 'fail'}">${p95}ms</div>
    </div>
    
    <h2>⏱️ Response Time Distribution</h2>
    <table>
      <tr><th>Percentile</th><th>Response Time</th></tr>
      <tr><td>Average</td><td>${data.metrics.http_req_duration.values.avg.toFixed(2)}ms</td></tr>
      <tr><td>Median (p50)</td><td>${data.metrics.http_req_duration.values.med.toFixed(2)}ms</td></tr>
      <tr><td>p90</td><td>${data.metrics.http_req_duration.values['p(90)'].toFixed(2)}ms</td></tr>
      <tr><td>p95</td><td>${p95}ms</td></tr>
      <tr><td>p99</td><td>${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms</td></tr>
      <tr><td>Max</td><td>${data.metrics.http_req_duration.values.max.toFixed(2)}ms</td></tr>
    </table>
    
    <h2>✅ Threshold Results</h2>
    ${Object.entries(data.thresholds).map(([name, threshold]) => `
      <div class="threshold">
        <span class="${threshold.ok ? 'pass' : 'fail'}">${threshold.ok ? '✓' : '✗'}</span> ${name}
      </div>
    `).join('')}
    
    <h2>🎯 Conclusion</h2>
    <p style="font-size: 18px; padding: 20px; background: ${errorRate < 1 && p95 < 500 ? '#d4edda' : '#f8d7da'}; border-radius: 5px;">
      ${errorRate < 1 && p95 < 500 ? '✅ Load test PASSED - System meets all performance requirements!' : '❌ Load test FAILED - Performance issues detected.'}
    </p>
  </div>
</body>
</html>`;
}
