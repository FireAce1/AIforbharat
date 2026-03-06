// Shared configuration for all load tests

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
export const AUTH_SERVICE_URL = __ENV.AUTH_SERVICE_URL || `${BASE_URL}/api/v1/auth`;
export const CROP_SERVICE_URL = __ENV.CROP_SERVICE_URL || `${BASE_URL}/api/v1/crop`;
export const MARKET_SERVICE_URL = __ENV.MARKET_SERVICE_URL || `${BASE_URL}/api/v1/market`;
export const CLIMATE_SERVICE_URL = __ENV.CLIMATE_SERVICE_URL || `${BASE_URL}/api/v1/climate`;
export const GOVT_SERVICE_URL = __ENV.GOVT_SERVICE_URL || `${BASE_URL}/api/v1/schemes`;

// Load test configuration
export const LOAD_TEST_CONFIG = {
  stages: [
    { duration: '2m', target: 1000 },  // Ramp-up to 1000 users over 2 minutes
    { duration: '6m', target: 1000 },  // Stay at 1000 users for 6 minutes
    { duration: '2m', target: 0 },     // Ramp-down to 0 users over 2 minutes
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
    http_reqs: ['rate>100'],           // Minimum 100 requests per second
  },
};

// Sample test data
export const TEST_PHONES = [
  '+919876543210',
  '+919876543211',
  '+919876543212',
  '+919876543213',
  '+919876543214',
];

export const TEST_LOCATIONS = [
  { latitude: 19.0760, longitude: 72.8777 },  // Mumbai
  { latitude: 18.5204, longitude: 73.8567 },  // Pune
  { latitude: 21.1458, longitude: 79.0882 },  // Nagpur
  { latitude: 19.8762, longitude: 75.3433 },  // Aurangabad
  { latitude: 16.7050, longitude: 74.2433 },  // Kolhapur
];

export const TEST_CROPS = [
  'rice',
  'wheat',
  'cotton',
  'tomato',
  'onion',
  'sugarcane',
  'soybean',
  'maize',
];

export const TEST_SOIL_TYPES = [
  'Alluvial',
  'Black',
  'Red',
  'Laterite',
];

export const TEST_IRRIGATION_TYPES = [
  'Rainfed',
  'Borewell',
  'Canal',
  'Drip',
  'Sprinkler',
];

// Helper function to get random item from array
export function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to generate random phone number
export function randomPhone() {
  const prefix = '+9198765';
  const suffix = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${suffix}`;
}

// Helper function to generate random OTP
export function randomOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to sleep
export function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
