/**
 * Shared Prometheus Metrics Module
 * 
 * Provides standardized metrics collection for all KrishiAI services:
 * - HTTP request metrics (duration, total requests)
 * - ML model metrics (inference latency, accuracy)
 * - Business metrics (active users, feature usage)
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry to register the metrics
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

/**
 * HTTP Request Metrics
 */

// HTTP request duration histogram
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5], // 1ms to 5s
  registers: [register],
});

// HTTP request counter
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'],
  registers: [register],
});

/**
 * ML Model Metrics
 */

// Model inference latency histogram
export const modelInferenceLatency = new Histogram({
  name: 'model_inference_latency_seconds',
  help: 'Latency of ML model inference in seconds',
  labelNames: ['model_name', 'model_version', 'service'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10], // 100ms to 10s
  registers: [register],
});

// Model accuracy gauge
export const modelAccuracy = new Gauge({
  name: 'model_accuracy',
  help: 'Accuracy of ML model predictions (0-1)',
  labelNames: ['model_name', 'model_version', 'service'],
  registers: [register],
});

/**
 * Business Metrics
 */

// Active users gauge
export const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Number of active users in the system',
  labelNames: ['time_window', 'service'], // time_window: daily, weekly, monthly
  registers: [register],
});

// Disease detections counter
export const diseaseDetectionsTotal = new Counter({
  name: 'disease_detections_total',
  help: 'Total number of disease detections performed',
  labelNames: ['crop_type', 'disease_name', 'confidence_level', 'service'],
  registers: [register],
});

// Crop recommendations counter
export const cropRecommendationsTotal = new Counter({
  name: 'crop_recommendations_total',
  help: 'Total number of crop recommendations generated',
  labelNames: ['recommended_crop', 'confidence_level', 'service'],
  registers: [register],
});

// Market price queries counter
export const marketPriceQueriesTotal = new Counter({
  name: 'market_price_queries_total',
  help: 'Total number of market price queries',
  labelNames: ['crop_name', 'query_type', 'service'], // query_type: current, forecast
  registers: [register],
});

// Weather forecast queries counter
export const weatherForecastQueriesTotal = new Counter({
  name: 'weather_forecast_queries_total',
  help: 'Total number of weather forecast queries',
  labelNames: ['forecast_days', 'service'],
  registers: [register],
});

// Government scheme queries counter
export const schemeQueriesTotal = new Counter({
  name: 'scheme_queries_total',
  help: 'Total number of government scheme queries',
  labelNames: ['scheme_type', 'eligible', 'service'],
  registers: [register],
});

// Chatbot queries counter
export const chatbotQueriesTotal = new Counter({
  name: 'chatbot_queries_total',
  help: 'Total number of chatbot queries',
  labelNames: ['intent', 'confidence_level', 'language', 'service'],
  registers: [register],
});

/**
 * Helper Functions
 */

/**
 * Record HTTP request metrics
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationSeconds: number,
  serviceName: string
): void {
  httpRequestDuration.observe(
    { method, route, status_code: statusCode.toString(), service: serviceName },
    durationSeconds
  );
  httpRequestsTotal.inc({
    method,
    route,
    status_code: statusCode.toString(),
    service: serviceName,
  });
}

/**
 * Record ML model inference
 */
export function recordModelInference(
  modelName: string,
  modelVersion: string,
  latencySeconds: number,
  serviceName: string
): void {
  modelInferenceLatency.observe(
    { model_name: modelName, model_version: modelVersion, service: serviceName },
    latencySeconds
  );
}

/**
 * Update model accuracy
 */
export function updateModelAccuracy(
  modelName: string,
  modelVersion: string,
  accuracy: number,
  serviceName: string
): void {
  modelAccuracy.set(
    { model_name: modelName, model_version: modelVersion, service: serviceName },
    accuracy
  );
}

/**
 * Update active users count
 */
export function updateActiveUsers(
  timeWindow: 'daily' | 'weekly' | 'monthly',
  count: number,
  serviceName: string
): void {
  activeUsers.set({ time_window: timeWindow, service: serviceName }, count);
}

/**
 * Record disease detection
 */
export function recordDiseaseDetection(
  cropType: string,
  diseaseName: string,
  confidence: number,
  serviceName: string
): void {
  const confidenceLevel = confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';
  diseaseDetectionsTotal.inc({
    crop_type: cropType,
    disease_name: diseaseName,
    confidence_level: confidenceLevel,
    service: serviceName,
  });
}

/**
 * Record crop recommendation
 */
export function recordCropRecommendation(
  recommendedCrop: string,
  confidence: number,
  serviceName: string
): void {
  const confidenceLevel = confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';
  cropRecommendationsTotal.inc({
    recommended_crop: recommendedCrop,
    confidence_level: confidenceLevel,
    service: serviceName,
  });
}

/**
 * Record market price query
 */
export function recordMarketPriceQuery(
  cropName: string,
  queryType: 'current' | 'forecast',
  serviceName: string
): void {
  marketPriceQueriesTotal.inc({
    crop_name: cropName,
    query_type: queryType,
    service: serviceName,
  });
}

/**
 * Record weather forecast query
 */
export function recordWeatherForecastQuery(
  forecastDays: number,
  serviceName: string
): void {
  weatherForecastQueriesTotal.inc({
    forecast_days: forecastDays.toString(),
    service: serviceName,
  });
}

/**
 * Record government scheme query
 */
export function recordSchemeQuery(
  schemeType: string,
  eligible: boolean,
  serviceName: string
): void {
  schemeQueriesTotal.inc({
    scheme_type: schemeType,
    eligible: eligible.toString(),
    service: serviceName,
  });
}

/**
 * Record chatbot query
 */
export function recordChatbotQuery(
  intent: string,
  confidence: number,
  language: string,
  serviceName: string
): void {
  const confidenceLevel = confidence >= 0.85 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';
  chatbotQueriesTotal.inc({
    intent,
    confidence_level: confidenceLevel,
    language,
    service: serviceName,
  });
}
