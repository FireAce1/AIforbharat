import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { AUTH_SERVICE_URL, LOAD_TEST_CONFIG, randomPhone } from './config.js';

// Custom metrics
const otpGenerationRate = new Rate('otp_generation_success');
const otpVerificationRate = new Rate('otp_verification_success');
const otpLatency = new Trend('otp_generation_latency');
const verifyLatency = new Trend('otp_verification_latency');

export const options = LOAD_TEST_CONFIG;

export default function () {
  const phone = randomPhone();
  
  // Test 1: Send OTP
  const sendOTPStart = Date.now();
  const sendOTPRes = http.post(
    `${AUTH_SERVICE_URL}/send-otp`,
    JSON.stringify({ phone }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'SendOTP' },
    }
  );
  
  const sendOTPSuccess = check(sendOTPRes, {
    'OTP sent successfully': (r) => r.status === 200,
    'OTP response has message': (r) => r.json('message') !== undefined,
  });
  
  otpGenerationRate.add(sendOTPSuccess);
  otpLatency.add(Date.now() - sendOTPStart);
  
  if (!sendOTPSuccess) {
    console.error(`Failed to send OTP: ${sendOTPRes.status} - ${sendOTPRes.body}`);
    sleep(1);
    return;
  }
  
  sleep(1); // Simulate user entering OTP
  
  // Test 2: Verify OTP (using mock OTP for load testing)
  const mockOTP = '123456'; // In real scenario, this would be from SMS
  const verifyOTPStart = Date.now();
  const verifyOTPRes = http.post(
    `${AUTH_SERVICE_URL}/verify-otp`,
    JSON.stringify({ phone, otp: mockOTP }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'VerifyOTP' },
    }
  );
  
  const verifyOTPSuccess = check(verifyOTPRes, {
    'OTP verified or expected error': (r) => r.status === 200 || r.status === 400,
    'Response has token or error': (r) => {
      const body = r.json();
      return body.token !== undefined || body.error !== undefined;
    },
  });
  
  otpVerificationRate.add(verifyOTPSuccess);
  verifyLatency.add(Date.now() - verifyOTPStart);
  
  // Test 3: Refresh token (if verification succeeded)
  if (verifyOTPRes.status === 200) {
    const token = verifyOTPRes.json('token');
    
    sleep(2); // Simulate some user activity
    
    const refreshRes = http.post(
      `${AUTH_SERVICE_URL}/refresh`,
      null,
      {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        tags: { name: 'RefreshToken' },
      }
    );
    
    check(refreshRes, {
      'Token refreshed successfully': (r) => r.status === 200,
      'New token received': (r) => r.json('token') !== undefined,
    });
    
    // Test 4: Get profile
    const profileRes = http.get(
      `${AUTH_SERVICE_URL}/profile`,
      {
        headers: { 
          'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'GetProfile' },
      }
    );
    
    check(profileRes, {
      'Profile retrieved successfully': (r) => r.status === 200,
      'Profile has user data': (r) => r.json('phone') !== undefined,
    });
  }
  
  sleep(1);
}

export function handleSummary(data) {
  return {
    'auth-load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = '\n';
  summary += `${indent}Auth Service Load Test Summary\n`;
  summary += `${indent}${'='.repeat(50)}\n\n`;
  
  // Request metrics
  summary += `${indent}HTTP Requests:\n`;
  summary += `${indent}  Total: ${data.metrics.http_reqs.values.count}\n`;
  summary += `${indent}  Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  summary += `${indent}  Failed: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n\n`;
  
  // Duration metrics
  summary += `${indent}Response Times:\n`;
  summary += `${indent}  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `${indent}  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}  p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  // Custom metrics
  if (data.metrics.otp_generation_success) {
    summary += `${indent}OTP Generation:\n`;
    summary += `${indent}  Success Rate: ${(data.metrics.otp_generation_success.values.rate * 100).toFixed(2)}%\n`;
    summary += `${indent}  Avg Latency: ${data.metrics.otp_generation_latency.values.avg.toFixed(2)}ms\n\n`;
  }
  
  if (data.metrics.otp_verification_success) {
    summary += `${indent}OTP Verification:\n`;
    summary += `${indent}  Success Rate: ${(data.metrics.otp_verification_success.values.rate * 100).toFixed(2)}%\n`;
    summary += `${indent}  Avg Latency: ${data.metrics.otp_verification_latency.values.avg.toFixed(2)}ms\n\n`;
  }
  
  // Thresholds
  summary += `${indent}Thresholds:\n`;
  for (const [name, threshold] of Object.entries(data.thresholds)) {
    const passed = threshold.ok ? '✓' : '✗';
    summary += `${indent}  ${passed} ${name}\n`;
  }
  
  return summary;
}
