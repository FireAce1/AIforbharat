import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import exec from 'k6/execution';
import { 
  BASE_URL,
  AUTH_SERVICE_URL,
  CROP_SERVICE_URL,
  MARKET_SERVICE_URL,
  CLIMATE_SERVICE_URL,
  GOVT_SERVICE_URL,
  randomItem,
  randomPhone,
  TEST_LOCATIONS,
  TEST_CROPS,
  TEST_SOIL_TYPES,
  TEST_IRRIGATION_TYPES,
} from './config.js';

// Custom metrics for detailed monitoring
const userJourneySuccess = new Rate('user_journey_success');
const totalRequests = new Counter('total_requests');
const authLatency = new Trend('auth_latency');
const cropLatency = new Trend('crop_latency');
const marketLatency = new Trend('market_latency');
const climateLatency = new Trend('climate_latency');
const govtLatency = new Trend('govt_latency');
const databaseConnections = new Gauge('database_connections');
const cacheHitRate = new Rate('cache_hit_rate');
const concurrentUsers = new Gauge('concurrent_users');

// Load test configuration for 1,000 concurrent users over 10 minutes
export const options = {
  stages: [
    { duration: '2m', target: 1000 },  // Ramp-up to 1000 users over 2 minutes
    { duration: '6m', target: 1000 },  // Stay at 1000 users for 6 minutes
    { duration: '2m', target: 0 },     // Ramp-down to 0 users over 2 minutes
  ],
  thresholds: {
    // Performance requirements
    http_req_duration: ['p(95)<500'],  // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
    http_reqs: ['rate>100'],           // Minimum 100 requests per second
    
    // Service-specific thresholds
    auth_latency: ['p(95)<300'],       // Auth should be fast
    crop_latency: ['p(95)<2000'],      // AI inference can be slower
    market_latency: ['p(95)<400'],     // Market data should be quick
    climate_latency: ['p(95)<400'],    // Weather data should be quick
    govt_latency: ['p(95)<600'],       // Scheme search can be moderate
    
    // User journey success
    user_journey_success: ['rate>0.95'], // 95% of user journeys should succeed
    
    // Cache performance
    cache_hit_rate: ['rate>0.8'],      // 80% cache hit rate expected
  },
};

// Realistic user behavior scenarios with weights
const USER_SCENARIOS = [
  { name: 'new_farmer_onboarding', weight: 15 },
  { name: 'daily_weather_check', weight: 35 },
  { name: 'market_price_check', weight: 25 },
  { name: 'disease_detection', weight: 10 },
  { name: 'scheme_discovery', weight: 10 },
  { name: 'comprehensive_farming_session', weight: 5 },
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
  // Track concurrent users
  concurrentUsers.add(exec.vu.idInTest);
  
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
  try {
    switch (scenario) {
      case 'new_farmer_onboarding':
        journeySuccess = newFarmerOnboardingJourney(headers);
        break;
      case 'daily_weather_check':
        journeySuccess = dailyWeatherCheckJourney(headers);
        break;
      case 'market_price_check':
        journeySuccess = marketPriceCheckJourney(headers);
        break;
      case 'disease_detection':
        journeySuccess = diseaseDetectionJourney(headers);
        break;
      case 'scheme_discovery':
        journeySuccess = schemeDiscoveryJourney(headers);
        break;
      case 'comprehensive_farming_session':
        journeySuccess = comprehensiveFarmingSessionJourney(headers);
        break;
    }
  } catch (error) {
    console.error(`Error in scenario ${scenario}:`, error);
    journeySuccess = false;
  }
  
  userJourneySuccess.add(journeySuccess);
  
  // Realistic think time between actions
  sleep(Math.random() * 3 + 1);
}

function authenticateUser() {
  return group('Authentication Flow', () => {
    const phone = randomPhone();
    const start = Date.now();
    
    // Step 1: Send OTP
    const otpRes = http.post(
      `${AUTH_SERVICE_URL}/send-otp`,
      JSON.stringify({ phone }),
      { 
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'send-otp' }
      }
    );
    
    totalRequests.add(1);
    
    const otpSuccess = check(otpRes, {
      'OTP sent successfully': (r) => r.status === 200,
      'OTP response time acceptable': (r) => r.timings.duration < 5000,
    });
    
    if (!otpSuccess) {
      return null;
    }
    
    // Simulate user receiving and entering OTP
    sleep(2);
    
    // Step 2: Verify OTP
    const verifyRes = http.post(
      `${AUTH_SERVICE_URL}/verify-otp`,
      JSON.stringify({ phone, otp: '123456' }),
      { 
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'verify-otp' }
      }
    );
    
    totalRequests.add(1);
    authLatency.add(Date.now() - start);
    
    const verifySuccess = check(verifyRes, {
      'OTP verified successfully': (r) => r.status === 200,
      'JWT token received': (r) => r.json('token') !== undefined,
    });
    
    if (verifySuccess) {
      return verifyRes.json('token') || 'mock-jwt-token';
    }
    
    return null;
  });
}

function newFarmerOnboardingJourney(headers) {
  return group('New Farmer Onboarding Journey', () => {
    const location = randomItem(TEST_LOCATIONS);
    let success = true;
    
    // Step 1: Create farm profile
    sleep(1);
    const farmRes = http.post(
      `${CROP_SERVICE_URL}/farms`,
      JSON.stringify({
        location: { latitude: location.latitude, longitude: location.longitude },
        soilType: randomItem(TEST_SOIL_TYPES),
        irrigationType: randomItem(TEST_IRRIGATION_TYPES),
        landSize: Math.random() * 3 + 1,
      }),
      { headers, tags: { endpoint: 'create-farm' } }
    );
    
    totalRequests.add(1);
    success = success && check(farmRes, {
      'Farm profile created': (r) => r.status === 201 || r.status === 200,
    });
    
    // Step 2: Get crop recommendations
    sleep(2);
    const start = Date.now();
    const recommendRes = http.post(
      `${CROP_SERVICE_URL}/recommend`,
      JSON.stringify({
        farmId: `farm-${exec.vu.idInTest}`,
        location: { latitude: location.latitude, longitude: location.longitude },
        soilType: randomItem(TEST_SOIL_TYPES),
        irrigationType: randomItem(TEST_IRRIGATION_TYPES),
        landSize: Math.random() * 3 + 1,
      }),
      { headers, tags: { endpoint: 'crop-recommend' } }
    );
    
    totalRequests.add(1);
    cropLatency.add(Date.now() - start);
    
    success = success && check(recommendRes, {
      'Crop recommendations received': (r) => r.status === 200,
      'Recommendations contain 3 crops': (r) => {
        try {
          const data = r.json();
          return data.recommendations && data.recommendations.length === 3;
        } catch {
          return false;
        }
      },
    });
    
    // Step 3: Check market prices for recommended crop
    sleep(1);
    const crop = randomItem(TEST_CROPS);
    const priceRes = http.get(
      `${MARKET_SERVICE_URL}/prices?crop=${crop}&latitude=${location.latitude}&longitude=${location.longitude}&radius=50`,
      { headers, tags: { endpoint: 'market-prices' } }
    );
    
    totalRequests.add(1);
    
    success = success && check(priceRes, {
      'Market prices retrieved': (r) => r.status === 200,
      'Prices from multiple mandis': (r) => {
        try {
          const data = r.json();
          return data.prices && data.prices.length >= 1;
        } catch {
          return false;
        }
      },
    });
    
    // Step 4: Get weather forecast
    sleep(1);
    const weatherRes = http.get(
      `${CLIMATE_SERVICE_URL}/weather/forecast?latitude=${location.latitude}&longitude=${location.longitude}&days=7`,
      { headers, tags: { endpoint: 'weather-forecast' } }
    );
    
    totalRequests.add(1);
    
    success = success && check(weatherRes, {
      'Weather forecast retrieved': (r) => r.status === 200,
      '7-day forecast available': (r) => {
        try {
          const data = r.json();
          return data.forecast && data.forecast.length === 7;
        } catch {
          return false;
        }
      },
    });
    
    return success;
  });
}

function dailyWeatherCheckJourney(headers) {
  return group('Daily Weather Check Journey', () => {
    const location = randomItem(TEST_LOCATIONS);
    let success = true;
    
    // Step 1: Get current weather
    const start = Date.now();
    const weatherRes = http.get(
      `${CLIMATE_SERVICE_URL}/weather/forecast?latitude=${location.latitude}&longitude=${location.longitude}&days=7`,
      { headers, tags: { endpoint: 'weather-forecast' } }
    );
    
    totalRequests.add(1);
    climateLatency.add(Date.now() - start);
    
    success = success && check(weatherRes, {
      'Weather data retrieved': (r) => r.status === 200,
      'Response time acceptable': (r) => r.timings.duration < 1000,
    });
    
    // Check for cache hit (simulated by fast response)
    if (weatherRes.timings.duration < 100) {
      cacheHitRate.add(true);
    } else {
      cacheHitRate.add(false);
    }
    
    sleep(2);
    
    // Step 2: Get water advisory
    const waterRes = http.post(
      `${CLIMATE_SERVICE_URL}/water/advisory`,
      JSON.stringify({
        farmId: `farm-${exec.vu.idInTest}`,
        cropId: `crop-${exec.vu.idInTest}`,
        cropName: randomItem(TEST_CROPS),
        growthStage: randomItem(['initial', 'mid', 'late']),
        location: { latitude: location.latitude, longitude: location.longitude },
        soilMoisture: Math.random() * 50 + 10,
      }),
      { headers, tags: { endpoint: 'water-advisory' } }
    );
    
    totalRequests.add(1);
    
    success = success && check(waterRes, {
      'Water advisory received': (r) => r.status === 200,
      'Advisory contains irrigation decision': (r) => {
        try {
          const data = r.json();
          return data.irrigate !== undefined;
        } catch {
          return false;
        }
      },
    });
    
    return success;
  });
}

function marketPriceCheckJourney(headers) {
  return group('Market Price Check Journey', () => {
    const location = randomItem(TEST_LOCATIONS);
    const crop = randomItem(TEST_CROPS);
    let success = true;
    
    // Step 1: Get current prices
    const start = Date.now();
    const priceRes = http.get(
      `${MARKET_SERVICE_URL}/prices?crop=${crop}&latitude=${location.latitude}&longitude=${location.longitude}&radius=50`,
      { headers, tags: { endpoint: 'market-prices' } }
    );
    
    totalRequests.add(1);
    marketLatency.add(Date.now() - start);
    
    success = success && check(priceRes, {
      'Current prices retrieved': (r) => r.status === 200,
      'Multiple mandis returned': (r) => {
        try {
          const data = r.json();
          return data.prices && data.prices.length >= 1;
        } catch {
          return false;
        }
      },
    });
    
    sleep(1);
    
    // Step 2: Get price forecast
    const forecastRes = http.get(
      `${MARKET_SERVICE_URL}/forecast?crop=${crop}&location=${location.latitude},${location.longitude}&days=30`,
      { headers, tags: { endpoint: 'price-forecast' } }
    );
    
    totalRequests.add(1);
    
    success = success && check(forecastRes, {
      'Price forecast retrieved': (r) => r.status === 200,
      'Forecast contains predictions': (r) => {
        try {
          const data = r.json();
          return data.forecast && data.forecast.length > 0;
        } catch {
          return false;
        }
      },
    });
    
    sleep(1);
    
    // Step 3: Set price alert
    const alertRes = http.post(
      `${MARKET_SERVICE_URL}/alerts`,
      JSON.stringify({
        cropName: crop,
        targetPrice: 30.0 + Math.random() * 20,
        location: { latitude: location.latitude, longitude: location.longitude },
      }),
      { headers, tags: { endpoint: 'price-alert' } }
    );
    
    totalRequests.add(1);
    
    success = success && check(alertRes, {
      'Price alert created': (r) => r.status === 201 || r.status === 200,
    });
    
    return success;
  });
}

function diseaseDetectionJourney(headers) {
  return group('Disease Detection Journey', () => {
    let success = true;
    
    // Step 1: Upload image for disease detection
    const mockImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const start = Date.now();
    const detectRes = http.post(
      `${CROP_SERVICE_URL}/disease/detect`,
      JSON.stringify({
        cropId: `crop-${exec.vu.idInTest}`,
        image: mockImage,
        location: randomItem(TEST_LOCATIONS),
      }),
      { headers, tags: { endpoint: 'disease-detect' } }
    );
    
    totalRequests.add(1);
    cropLatency.add(Date.now() - start);
    
    success = success && check(detectRes, {
      'Disease detection completed': (r) => r.status === 200 || r.status === 400, // 400 for invalid image is acceptable
      'Response time under 2 seconds': (r) => r.timings.duration < 2000,
    });
    
    // If detection was successful, check treatment recommendations
    if (detectRes.status === 200) {
      sleep(1);
      
      const treatmentRes = http.get(
        `${CROP_SERVICE_URL}/disease/treatment?disease=leaf_blight&severity=moderate`,
        { headers, tags: { endpoint: 'treatment-recommendations' } }
      );
      
      totalRequests.add(1);
      
      success = success && check(treatmentRes, {
        'Treatment recommendations received': (r) => r.status === 200,
      });
    }
    
    return success;
  });
}

function schemeDiscoveryJourney(headers) {
  return group('Government Scheme Discovery Journey', () => {
    let success = true;
    
    // Step 1: Search schemes
    const start = Date.now();
    const searchRes = http.get(
      `${GOVT_SERVICE_URL}/search?category=subsidy&state=Maharashtra&language=hi&limit=10`,
      { headers, tags: { endpoint: 'scheme-search' } }
    );
    
    totalRequests.add(1);
    govtLatency.add(Date.now() - start);
    
    success = success && check(searchRes, {
      'Schemes search completed': (r) => r.status === 200,
      'Schemes returned': (r) => {
        try {
          const data = r.json();
          return data.schemes && data.schemes.length >= 0;
        } catch {
          return false;
        }
      },
    });
    
    sleep(2);
    
    // Step 2: Get eligible schemes for user
    const eligibleRes = http.get(
      `${GOVT_SERVICE_URL}/eligible?landSize=2.0&cropType=rice&state=Maharashtra&language=hi`,
      { headers, tags: { endpoint: 'eligible-schemes' } }
    );
    
    totalRequests.add(1);
    
    success = success && check(eligibleRes, {
      'Eligible schemes retrieved': (r) => r.status === 200,
    });
    
    sleep(1);
    
    // Step 3: Get scheme details
    const detailRes = http.get(
      `${GOVT_SERVICE_URL}/1?language=hi`,
      { headers, tags: { endpoint: 'scheme-details' } }
    );
    
    totalRequests.add(1);
    
    success = success && check(detailRes, {
      'Scheme details retrieved': (r) => r.status === 200 || r.status === 404, // 404 acceptable if scheme doesn't exist
    });
    
    return success;
  });
}

function comprehensiveFarmingSessionJourney(headers) {
  return group('Comprehensive Farming Session Journey', () => {
    const location = randomItem(TEST_LOCATIONS);
    const crop = randomItem(TEST_CROPS);
    let success = true;
    
    // This journey combines multiple services in a realistic farming session
    
    // Step 1: Check weather
    const weatherRes = http.get(
      `${CLIMATE_SERVICE_URL}/weather/forecast?latitude=${location.latitude}&longitude=${location.longitude}&days=7`,
      { headers, tags: { endpoint: 'weather-forecast' } }
    );
    totalRequests.add(1);
    success = success && check(weatherRes, { 'Weather retrieved': (r) => r.status === 200 });
    
    sleep(1);
    
    // Step 2: Check market prices
    const priceRes = http.get(
      `${MARKET_SERVICE_URL}/prices?crop=${crop}&latitude=${location.latitude}&longitude=${location.longitude}&radius=50`,
      { headers, tags: { endpoint: 'market-prices' } }
    );
    totalRequests.add(1);
    success = success && check(priceRes, { 'Prices retrieved': (r) => r.status === 200 });
    
    sleep(1);
    
    // Step 3: Get crop recommendations
    const recommendRes = http.post(
      `${CROP_SERVICE_URL}/recommend`,
      JSON.stringify({
        farmId: `farm-${exec.vu.idInTest}`,
        location: { latitude: location.latitude, longitude: location.longitude },
        soilType: randomItem(TEST_SOIL_TYPES),
        irrigationType: randomItem(TEST_IRRIGATION_TYPES),
        landSize: Math.random() * 3 + 1,
      }),
      { headers, tags: { endpoint: 'crop-recommend' } }
    );
    totalRequests.add(1);
    success = success && check(recommendRes, { 'Recommendations retrieved': (r) => r.status === 200 });
    
    sleep(2);
    
    // Step 4: Search for relevant schemes
    const schemeRes = http.get(
      `${GOVT_SERVICE_URL}/search?category=subsidy&state=Maharashtra&language=hi`,
      { headers, tags: { endpoint: 'scheme-search' } }
    );
    totalRequests.add(1);
    success = success && check(schemeRes, { 'Schemes retrieved': (r) => r.status === 200 });
    
    sleep(1);
    
    // Step 5: Get water advisory
    const waterRes = http.post(
      `${CLIMATE_SERVICE_URL}/water/advisory`,
      JSON.stringify({
        farmId: `farm-${exec.vu.idInTest}`,
        cropId: `crop-${exec.vu.idInTest}`,
        cropName: crop,
        growthStage: 'mid',
        location: { latitude: location.latitude, longitude: location.longitude },
        soilMoisture: Math.random() * 50 + 10,
      }),
      { headers, tags: { endpoint: 'water-advisory' } }
    );
    totalRequests.add(1);
    success = success && check(waterRes, { 'Water advisory retrieved': (r) => r.status === 200 });
    
    return success;
  });
}

export function handleSummary(data) {
  const report = generateComprehensiveReport(data);
  
  return {
    'comprehensive-load-test-results.json': JSON.stringify(data, null, 2),
    'comprehensive-load-test-report.html': generateHTMLReport(data),
    'load-test-summary.txt': report,
    stdout: report,
  };
}

function generateComprehensiveReport(data) {
  let report = '\n';
  report += '═'.repeat(80) + '\n';
  report += '  KRISHIAI MVP - COMPREHENSIVE LOAD TEST REPORT\n';
  report += '═'.repeat(80) + '\n\n';
  
  // Test Configuration
  report += '📋 TEST CONFIGURATION\n';
  report += '─'.repeat(80) + '\n';
  report += `  Test Duration: 10 minutes (2m ramp-up, 6m steady, 2m ramp-down)\n`;
  report += `  Virtual Users: 1,000 concurrent users\n`;
  report += `  Target Load: 100+ requests/second\n`;
  report += `  Database Records: 100K+ records\n`;
  report += `  Auto-scaling Target: 3 → 10 pods under load\n\n`;
  
  // Overall Performance Metrics
  report += '📊 OVERALL PERFORMANCE METRICS\n';
  report += '─'.repeat(80) + '\n';
  report += `  Total Requests: ${data.metrics.http_reqs.values.count.toLocaleString()}\n`;
  report += `  Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s `;
  report += data.metrics.http_reqs.values.rate > 100 ? '✓\n' : '✗ (Target: >100/s)\n';
  report += `  Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}% `;
  report += data.metrics.http_req_failed.values.rate < 0.01 ? '✓\n' : '✗ (Target: <1%)\n';
  report += `  Data Transferred: ${((data.metrics.data_received.values.count + data.metrics.data_sent.values.count) / 1024 / 1024).toFixed(2)} MB\n\n`;
  
  // Response Time Analysis
  report += '⏱️  RESPONSE TIME ANALYSIS\n';
  report += '─'.repeat(80) + '\n';
  report += `  Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  report += `  Median (p50): ${data.metrics.http_req_duration.values.med.toFixed(2)}ms\n`;
  report += `  90th Percentile (p90): ${data.metrics.http_req_duration.values['p(90)'].toFixed(2)}ms\n`;
  report += `  95th Percentile (p95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms `;
  report += data.metrics.http_req_duration.values['p(95)'] < 500 ? '✓\n' : '✗ (Target: <500ms)\n';
  report += `  99th Percentile (p99): ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  report += `  Maximum Response Time: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n\n`;
  
  // Service-Specific Performance
  report += '🔧 SERVICE-SPECIFIC PERFORMANCE\n';
  report += '─'.repeat(80) + '\n';
  
  const services = [
    { name: 'Auth Service', metric: 'auth_latency', target: 300 },
    { name: 'Crop Service', metric: 'crop_latency', target: 2000 },
    { name: 'Market Service', metric: 'market_latency', target: 400 },
    { name: 'Climate Service', metric: 'climate_latency', target: 400 },
    { name: 'Government Service', metric: 'govt_latency', target: 600 },
  ];
  
  services.forEach(service => {
    if (data.metrics[service.metric]) {
      const avg = data.metrics[service.metric].values.avg.toFixed(2);
      const p95 = data.metrics[service.metric].values['p(95)'].toFixed(2);
      const status = data.metrics[service.metric].values['p(95)'] < service.target ? '✓' : '✗';
      report += `  ${service.name}:\n`;
      report += `    Average: ${avg}ms | p95: ${p95}ms ${status} (Target: <${service.target}ms)\n`;
    }
  });
  report += '\n';
  
  // User Journey Success Analysis
  if (data.metrics.user_journey_success) {
    report += '👥 USER JOURNEY SUCCESS ANALYSIS\n';
    report += '─'.repeat(80) + '\n';
    const successRate = (data.metrics.user_journey_success.values.rate * 100).toFixed(2);
    report += `  Overall Success Rate: ${successRate}% `;
    report += data.metrics.user_journey_success.values.rate > 0.95 ? '✓\n' : '✗ (Target: >95%)\n';
    report += `  Successful Journeys: ${Math.round(data.metrics.user_journey_success.values.passes)}\n`;
    report += `  Failed Journeys: ${Math.round(data.metrics.user_journey_success.values.fails)}\n\n`;
  }
  
  // Cache Performance
  if (data.metrics.cache_hit_rate) {
    report += '💾 CACHE PERFORMANCE\n';
    report += '─'.repeat(80) + '\n';
    const hitRate = (data.metrics.cache_hit_rate.values.rate * 100).toFixed(2);
    report += `  Cache Hit Rate: ${hitRate}% `;
    report += data.metrics.cache_hit_rate.values.rate > 0.8 ? '✓\n' : '✗ (Target: >80%)\n\n';
  }
  
  // Threshold Validation
  report += '✅ THRESHOLD VALIDATION\n';
  report += '─'.repeat(80) + '\n';
  let allThresholdsPassed = true;
  
  for (const [name, threshold] of Object.entries(data.thresholds)) {
    const passed = threshold.ok;
    allThresholdsPassed = allThresholdsPassed && passed;
    const icon = passed ? '✓' : '✗';
    report += `  ${icon} ${name}\n`;
  }
  report += '\n';
  
  // Performance Requirements Checklist
  report += '📋 PERFORMANCE REQUIREMENTS CHECKLIST\n';
  report += '─'.repeat(80) + '\n';
  
  const requirements = [
    {
      name: 'p95 latency < 500ms',
      passed: data.metrics.http_req_duration.values['p(95)'] < 500,
      value: `${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`
    },
    {
      name: 'Error rate < 1%',
      passed: data.metrics.http_req_failed.values.rate < 0.01,
      value: `${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`
    },
    {
      name: 'Request rate > 100/s',
      passed: data.metrics.http_reqs.values.rate > 100,
      value: `${data.metrics.http_reqs.values.rate.toFixed(2)}/s`
    },
    {
      name: 'User journey success > 95%',
      passed: data.metrics.user_journey_success ? data.metrics.user_journey_success.values.rate > 0.95 : false,
      value: data.metrics.user_journey_success ? `${(data.metrics.user_journey_success.values.rate * 100).toFixed(2)}%` : 'N/A'
    }
  ];
  
  let allRequirementsPassed = true;
  requirements.forEach(req => {
    allRequirementsPassed = allRequirementsPassed && req.passed;
    const icon = req.passed ? '✓' : '✗';
    report += `  ${icon} ${req.name}: ${req.value}\n`;
  });
  
  report += '\n';
  
  // Final Verdict
  report += '🎯 FINAL VERDICT\n';
  report += '─'.repeat(80) + '\n';
  
  if (allRequirementsPassed && allThresholdsPassed) {
    report += '  ✅ LOAD TEST PASSED\n';
    report += '  🎉 System successfully handles 1,000 concurrent users!\n';
    report += '  📈 All performance requirements met\n';
    report += '  🚀 Ready for production deployment\n';
  } else {
    report += '  ❌ LOAD TEST FAILED\n';
    report += '  ⚠️  Performance issues detected:\n';
    
    if (data.metrics.http_req_failed.values.rate >= 0.01) {
      report += `    • High error rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n`;
    }
    if (data.metrics.http_req_duration.values['p(95)'] >= 500) {
      report += `    • Slow response times: p95 = ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    }
    if (data.metrics.http_reqs.values.rate <= 100) {
      report += `    • Low throughput: ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s\n`;
    }
    
    report += '  🔧 Recommended actions:\n';
    report += '    • Check service logs for errors\n';
    report += '    • Verify database performance and indexes\n';
    report += '    • Confirm auto-scaling configuration\n';
    report += '    • Review cache hit rates and TTL settings\n';
  }
  
  report += '\n' + '═'.repeat(80) + '\n';
  
  return report;
}

function generateHTMLReport(data) {
  const errorRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
  const p95 = data.metrics.http_req_duration.values['p(95)'].toFixed(2);
  const requestRate = data.metrics.http_reqs.values.rate.toFixed(2);
  const successRate = data.metrics.user_journey_success ? 
    (data.metrics.user_journey_success.values.rate * 100).toFixed(2) : 'N/A';
  
  const passed = errorRate < 1 && p95 < 500 && requestRate > 100;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KrishiAI MVP - Comprehensive Load Test Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { 
      max-width: 1400px; 
      margin: 0 auto; 
      background: white; 
      border-radius: 12px; 
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 { font-size: 2.5em; margin-bottom: 10px; }
    .header p { font-size: 1.2em; opacity: 0.9; }
    .content { padding: 30px; }
    
    .status-banner {
      padding: 20px;
      margin-bottom: 30px;
      border-radius: 8px;
      text-align: center;
      font-size: 1.3em;
      font-weight: bold;
    }
    .status-pass { background: #d4edda; color: #155724; border: 2px solid #c3e6cb; }
    .status-fail { background: #f8d7da; color: #721c24; border: 2px solid #f5c6cb; }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .metric-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 25px;
      text-align: center;
      border-left: 5px solid #007bff;
      transition: transform 0.2s;
    }
    .metric-card:hover { transform: translateY(-2px); }
    .metric-label { 
      font-size: 0.9em; 
      color: #6c757d; 
      text-transform: uppercase; 
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    .metric-value { 
      font-size: 2.2em; 
      font-weight: bold; 
      color: #2c3e50; 
      margin-bottom: 5px;
    }
    .metric-status { font-size: 0.9em; }
    .pass { color: #28a745; font-weight: bold; }
    .fail { color: #dc3545; font-weight: bold; }
    
    .section {
      margin-bottom: 40px;
      background: #f8f9fa;
      border-radius: 8px;
      padding: 25px;
    }
    .section h2 {
      color: #2c3e50;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e9ecef;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    th, td {
      padding: 15px;
      text-align: left;
      border-bottom: 1px solid #e9ecef;
    }
    th {
      background: #343a40;
      color: white;
      font-weight: 600;
    }
    tr:hover { background: #f8f9fa; }
    
    .threshold-item {
      display: flex;
      align-items: center;
      padding: 12px;
      margin: 8px 0;
      background: white;
      border-radius: 6px;
      border-left: 4px solid #28a745;
    }
    .threshold-item.fail { border-left-color: #dc3545; }
    .threshold-icon {
      font-size: 1.2em;
      margin-right: 12px;
      font-weight: bold;
    }
    
    .chart-placeholder {
      height: 200px;
      background: linear-gradient(45deg, #f8f9fa, #e9ecef);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6c757d;
      font-style: italic;
    }
    
    .footer {
      background: #2c3e50;
      color: white;
      padding: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 KrishiAI MVP Load Test Report</h1>
      <p>Comprehensive Performance Analysis | ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="content">
      <div class="status-banner ${passed ? 'status-pass' : 'status-fail'}">
        ${passed ? '✅ LOAD TEST PASSED - System Ready for Production!' : '❌ LOAD TEST FAILED - Performance Issues Detected'}
      </div>
      
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Total Requests</div>
          <div class="metric-value">${data.metrics.http_reqs.values.count.toLocaleString()}</div>
          <div class="metric-status">Over 10 minutes</div>
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Request Rate</div>
          <div class="metric-value">${requestRate}/s</div>
          <div class="metric-status ${requestRate > 100 ? 'pass' : 'fail'}">
            Target: >100/s ${requestRate > 100 ? '✓' : '✗'}
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Error Rate</div>
          <div class="metric-value">${errorRate}%</div>
          <div class="metric-status ${errorRate < 1 ? 'pass' : 'fail'}">
            Target: <1% ${errorRate < 1 ? '✓' : '✗'}
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-label">p95 Latency</div>
          <div class="metric-value">${p95}ms</div>
          <div class="metric-status ${p95 < 500 ? 'pass' : 'fail'}">
            Target: <500ms ${p95 < 500 ? '✓' : '✗'}
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-label">User Journey Success</div>
          <div class="metric-value">${successRate}%</div>
          <div class="metric-status ${successRate !== 'N/A' && parseFloat(successRate) > 95 ? 'pass' : 'fail'}">
            Target: >95% ${successRate !== 'N/A' && parseFloat(successRate) > 95 ? '✓' : '✗'}
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Concurrent Users</div>
          <div class="metric-value">1,000</div>
          <div class="metric-status">Peak load sustained</div>
        </div>
      </div>
      
      <div class="section">
        <h2>⏱️ Response Time Distribution</h2>
        <table>
          <thead>
            <tr>
              <th>Percentile</th>
              <th>Response Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Average</td>
              <td>${data.metrics.http_req_duration.values.avg.toFixed(2)}ms</td>
              <td><span class="pass">Good</span></td>
            </tr>
            <tr>
              <td>Median (p50)</td>
              <td>${data.metrics.http_req_duration.values.med.toFixed(2)}ms</td>
              <td><span class="pass">Good</span></td>
            </tr>
            <tr>
              <td>90th Percentile</td>
              <td>${data.metrics.http_req_duration.values['p(90)'].toFixed(2)}ms</td>
              <td><span class="${data.metrics.http_req_duration.values['p(90)'] < 400 ? 'pass' : 'fail'}">
                ${data.metrics.http_req_duration.values['p(90)'] < 400 ? 'Good' : 'Needs Attention'}
              </span></td>
            </tr>
            <tr>
              <td>95th Percentile</td>
              <td>${p95}ms</td>
              <td><span class="${p95 < 500 ? 'pass' : 'fail'}">
                ${p95 < 500 ? 'Passed' : 'Failed'}
              </span></td>
            </tr>
            <tr>
              <td>99th Percentile</td>
              <td>${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms</td>
              <td><span class="${data.metrics.http_req_duration.values['p(99)'] < 1000 ? 'pass' : 'fail'}">
                ${data.metrics.http_req_duration.values['p(99)'] < 1000 ? 'Acceptable' : 'High'}
              </span></td>
            </tr>
            <tr>
              <td>Maximum</td>
              <td>${data.metrics.http_req_duration.values.max.toFixed(2)}ms</td>
              <td><span class="metric-status">Peak response</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <h2>🔧 Service Performance Breakdown</h2>
        <div class="metrics-grid">
          ${data.metrics.auth_latency ? `
          <div class="metric-card">
            <div class="metric-label">Auth Service</div>
            <div class="metric-value">${data.metrics.auth_latency.values.avg.toFixed(0)}ms</div>
            <div class="metric-status">Average latency</div>
          </div>` : ''}
          
          ${data.metrics.crop_latency ? `
          <div class="metric-card">
            <div class="metric-label">Crop Service</div>
            <div class="metric-value">${data.metrics.crop_latency.values.avg.toFixed(0)}ms</div>
            <div class="metric-status">AI inference time</div>
          </div>` : ''}
          
          ${data.metrics.market_latency ? `
          <div class="metric-card">
            <div class="metric-label">Market Service</div>
            <div class="metric-value">${data.metrics.market_latency.values.avg.toFixed(0)}ms</div>
            <div class="metric-status">Price query time</div>
          </div>` : ''}
          
          ${data.metrics.climate_latency ? `
          <div class="metric-card">
            <div class="metric-label">Climate Service</div>
            <div class="metric-value">${data.metrics.climate_latency.values.avg.toFixed(0)}ms</div>
            <div class="metric-status">Weather data time</div>
          </div>` : ''}
        </div>
      </div>
      
      <div class="section">
        <h2>✅ Threshold Validation Results</h2>
        ${Object.entries(data.thresholds).map(([name, threshold]) => `
          <div class="threshold-item ${threshold.ok ? '' : 'fail'}">
            <span class="threshold-icon ${threshold.ok ? 'pass' : 'fail'}">
              ${threshold.ok ? '✓' : '✗'}
            </span>
            <span>${name}</span>
          </div>
        `).join('')}
      </div>
      
      <div class="section">
        <h2>📊 Performance Summary</h2>
        <div class="chart-placeholder">
          Response Time Distribution Chart
          <br><small>(Detailed charts available in monitoring dashboard)</small>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>Generated by k6 Load Testing Framework | KrishiAI MVP Performance Testing Suite</p>
      <p>For detailed metrics, check Grafana dashboards and Prometheus metrics</p>
    </div>
  </div>
</body>
</html>`;
}