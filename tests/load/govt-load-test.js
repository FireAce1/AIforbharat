import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { 
  GOVT_SERVICE_URL, 
  LOAD_TEST_CONFIG, 
  randomItem, 
  TEST_LOCATIONS 
} from './config.js';

// Custom metrics
const schemeSearchRate = new Rate('scheme_search_success');
const chatbotQueryRate = new Rate('chatbot_query_success');
const schemeSearchLatency = new Trend('scheme_search_latency');
const chatbotLatency = new Trend('chatbot_query_latency');

export const options = LOAD_TEST_CONFIG;

const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE3MDQwNjcyMDB9.test';

const SAMPLE_QUERIES = [
  'मौसम कैसा रहेगा?',
  'टमाटर का भाव क्या है?',
  'फसल की बीमारी कैसे पहचानें?',
  'सरकारी योजना की जानकारी',
  'सिंचाई कब करें?',
  'खाद कितना डालें?',
];

const SCHEME_CATEGORIES = [
  'subsidy',
  'insurance',
  'loan',
  'training',
  'equipment',
];

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MOCK_TOKEN}`,
  };
  
  const location = randomItem(TEST_LOCATIONS);
  
  // Test 1: Search schemes
  const searchStart = Date.now();
  const searchRes = http.get(
    `${GOVT_SERVICE_URL}/search?category=${randomItem(SCHEME_CATEGORIES)}&state=Maharashtra&language=hi`,
    {
      headers,
      tags: { name: 'SearchSchemes' },
    }
  );
  
  const searchSuccess = check(searchRes, {
    'Scheme search successful': (r) => r.status === 200,
    'Returns schemes array': (r) => {
      const body = r.json();
      return Array.isArray(body.schemes);
    },
    'Response time < 500ms': (r) => r.timings.duration < 500,
    'Has scheme details': (r) => {
      const body = r.json();
      return body.schemes && body.schemes.every(s => 
        s.scheme_name !== undefined && s.benefits_amount !== undefined
      );
    },
  });
  
  schemeSearchRate.add(searchSuccess);
  schemeSearchLatency.add(Date.now() - searchStart);
  
  sleep(1);
  
  // Test 2: Get eligible schemes for user
  const eligibleRes = http.get(
    `${GOVT_SERVICE_URL}/eligible?landSize=2.5&cropType=rice&state=Maharashtra`,
    {
      headers,
      tags: { name: 'GetEligibleSchemes' },
    }
  );
  
  check(eligibleRes, {
    'Eligible schemes retrieved': (r) => r.status === 200,
    'Returns filtered schemes': (r) => {
      const body = r.json();
      return Array.isArray(body.schemes);
    },
  });
  
  sleep(1);
  
  // Test 3: Get scheme details
  const schemeId = `scheme-${Math.floor(Math.random() * 100)}`;
  const detailRes = http.get(
    `${GOVT_SERVICE_URL}/${schemeId}?language=hi`,
    {
      headers,
      tags: { name: 'GetSchemeDetails' },
    }
  );
  
  check(detailRes, {
    'Scheme details retrieved': (r) => r.status === 200 || r.status === 404,
    'Has complete information': (r) => {
      if (r.status === 200) {
        const body = r.json();
        return body.scheme_name !== undefined && body.eligibility_criteria !== undefined;
      }
      return true;
    },
  });
  
  sleep(1);
  
  // Test 4: Subscribe to scheme alerts
  const subscribePayload = {
    schemeId: schemeId,
  };
  
  const subscribeRes = http.post(
    `${GOVT_SERVICE_URL}/alerts/subscribe`,
    JSON.stringify(subscribePayload),
    {
      headers,
      tags: { name: 'SubscribeToAlerts' },
    }
  );
  
  check(subscribeRes, {
    'Subscription successful': (r) => r.status === 201 || r.status === 200 || r.status === 404,
  });
  
  sleep(1);
  
  // Test 5: Chatbot query
  const chatbotStart = Date.now();
  const chatbotPayload = {
    query: randomItem(SAMPLE_QUERIES),
    language: 'hi',
    userId: `user-${__VU}`,
  };
  
  const chatbotRes = http.post(
    `${BASE_URL}/api/v1/chatbot/query`,
    JSON.stringify(chatbotPayload),
    {
      headers,
      tags: { name: 'ChatbotQuery' },
    }
  );
  
  const chatbotSuccess = check(chatbotRes, {
    'Chatbot query successful': (r) => r.status === 200,
    'Has response text': (r) => {
      const body = r.json();
      return body.response !== undefined;
    },
    'Response time < 1000ms': (r) => r.timings.duration < 1000,
    'Has intent and confidence': (r) => {
      const body = r.json();
      return body.intent !== undefined && body.confidence !== undefined;
    },
  });
  
  chatbotQueryRate.add(chatbotSuccess);
  chatbotLatency.add(Date.now() - chatbotStart);
  
  sleep(2);
}

export function handleSummary(data) {
  return {
    'govt-load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  let summary = '\n';
  summary += 'Government Service Load Test Summary\n';
  summary += '='.repeat(50) + '\n\n';
  
  summary += 'HTTP Requests:\n';
  summary += `  Total: ${data.metrics.http_reqs.values.count}\n`;
  summary += `  Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  summary += `  Failed: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n\n`;
  
  summary += 'Response Times:\n';
  summary += `  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `  p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  if (data.metrics.scheme_search_success) {
    summary += 'Scheme Search:\n';
    summary += `  Success Rate: ${(data.metrics.scheme_search_success.values.rate * 100).toFixed(2)}%\n`;
    summary += `  Avg Latency: ${data.metrics.scheme_search_latency.values.avg.toFixed(2)}ms\n\n`;
  }
  
  if (data.metrics.chatbot_query_success) {
    summary += 'Chatbot Queries:\n';
    summary += `  Success Rate: ${(data.metrics.chatbot_query_success.values.rate * 100).toFixed(2)}%\n`;
    summary += `  Avg Latency: ${data.metrics.chatbot_query_latency.values.avg.toFixed(2)}ms\n\n`;
  }
  
  summary += 'Thresholds:\n';
  for (const [name, threshold] of Object.entries(data.thresholds)) {
    const passed = threshold.ok ? '✓' : '✗';
    summary += `  ${passed} ${name}\n`;
  }
  
  return summary;
}
