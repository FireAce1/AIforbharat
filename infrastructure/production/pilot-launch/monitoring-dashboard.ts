/**
 * Pilot Launch Monitoring Dashboard
 * 
 * Comprehensive monitoring system for tracking:
 * - System performance (API response times, error rates, uptime)
 * - ML model performance (accuracy, inference times)
 * - Business metrics (active users, feature usage, retention)
 * 
 * Requirements: 21.2-21.6
 */

import express from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
import axios from 'axios';

const app = express();
const port = process.env.MONITORING_PORT || 3100;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'krishiai_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

app.use(express.json());

// ============================================================================
// SYSTEM PERFORMANCE MONITORING
// ============================================================================

interface SystemMetrics {
  timestamp: Date;
  apiResponseTimes: {
    auth: number;
    crop: number;
    market: number;
    climate: number;
    govt: number;
  };
  errorRates: {
    auth: number;
    crop: number;
    market: number;
    climate: number;
    govt: number;
  };
  uptime: {
    auth: boolean;
    crop: boolean;
    market: boolean;
    climate: boolean;
    govt: boolean;
  };
}

/**
 * Get system performance metrics from Prometheus
 */
async function getSystemMetrics(): Promise<SystemMetrics> {
  const prometheusUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090';
  
  try {
    // Query API response times (p95)
    const responseTimesQuery = `
      histogram_quantile(0.95, 
        sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le)
      )
    `;
    
    const responseTimesRes = await axios.get(`${prometheusUrl}/api/v1/query`, {
      params: { query: responseTimesQuery },
    });
    
    // Query error rates
    const errorRatesQuery = `
      sum(rate(http_requests_total{status=~"5.."}[5m])) by (service) /
      sum(rate(http_requests_total[5m])) by (service)
    `;
    
    const errorRatesRes = await axios.get(`${prometheusUrl}/api/v1/query`, {
      params: { query: errorRatesQuery },
    });
    
    // Query service uptime
    const uptimeQuery = `up{job=~".*-service"}`;
    const uptimeRes = await axios.get(`${prometheusUrl}/api/v1/query`, {
      params: { query: uptimeQuery },
    });
    
    // Parse results
    const apiResponseTimes = parseServiceMetrics(responseTimesRes.data.data.result);
    const errorRates = parseServiceMetrics(errorRatesRes.data.data.result);
    const uptime = parseUptimeMetrics(uptimeRes.data.data.result);
    
    return {
      timestamp: new Date(),
      apiResponseTimes,
      errorRates,
      uptime,
    };
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    throw error;
  }
}

function parseServiceMetrics(results: any[]): any {
  const metrics: any = {
    auth: 0,
    crop: 0,
    market: 0,
    climate: 0,
    govt: 0,
  };
  
  results.forEach((result) => {
    const service = result.metric.service;
    const value = parseFloat(result.value[1]);
    
    if (service.includes('auth')) metrics.auth = value;
    else if (service.includes('crop')) metrics.crop = value;
    else if (service.includes('market')) metrics.market = value;
    else if (service.includes('climate')) metrics.climate = value;
    else if (service.includes('govt')) metrics.govt = value;
  });
  
  return metrics;
}

function parseUptimeMetrics(results: any[]): any {
  const uptime: any = {
    auth: false,
    crop: false,
    market: false,
    climate: false,
    govt: false,
  };
  
  results.forEach((result) => {
    const job = result.metric.job;
    const value = parseInt(result.value[1]);
    
    if (job.includes('auth')) uptime.auth = value === 1;
    else if (job.includes('crop')) uptime.crop = value === 1;
    else if (job.includes('market')) uptime.market = value === 1;
    else if (job.includes('climate')) uptime.climate = value === 1;
    else if (job.includes('govt')) uptime.govt = value === 1;
  });
  
  return uptime;
}

// ============================================================================
// ML MODEL PERFORMANCE MONITORING
// ============================================================================

interface MLMetrics {
  timestamp: Date;
  diseaseDetector: {
    accuracy: number;
    avgInferenceTime: number;
    totalInferences: number;
  };
  cropRecommender: {
    accuracy: number;
    avgInferenceTime: number;
    totalRecommendations: number;
  };
  priceForecaster: {
    mape: number;
    avgInferenceTime: number;
    totalForecasts: number;
  };
  chatbot: {
    intentAccuracy: number;
    avgResponseTime: number;
    totalQueries: number;
  };
}

/**
 * Get ML model performance metrics
 */
async function getMLMetrics(): Promise<MLMetrics> {
  const prometheusUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090';
  
  try {
    // Query model inference times
    const inferenceTimeQuery = `
      avg(model_inference_latency_seconds) by (model)
    `;
    
    const inferenceTimeRes = await axios.get(`${prometheusUrl}/api/v1/query`, {
      params: { query: inferenceTimeQuery },
    });
    
    // Query model accuracy
    const accuracyQuery = `model_accuracy`;
    const accuracyRes = await axios.get(`${prometheusUrl}/api/v1/query`, {
      params: { query: accuracyQuery },
    });
    
    // Query total inferences
    const totalInferencesQuery = `
      sum(increase(model_inferences_total[24h])) by (model)
    `;
    
    const totalInferencesRes = await axios.get(`${prometheusUrl}/api/v1/query`, {
      params: { query: totalInferencesQuery },
    });
    
    // Parse results
    const inferenceTimes = parseMLMetrics(inferenceTimeRes.data.data.result);
    const accuracies = parseMLMetrics(accuracyRes.data.data.result);
    const totalInferences = parseMLMetrics(totalInferencesRes.data.data.result);
    
    return {
      timestamp: new Date(),
      diseaseDetector: {
        accuracy: accuracies.disease_detector || 0,
        avgInferenceTime: inferenceTimes.disease_detector || 0,
        totalInferences: totalInferences.disease_detector || 0,
      },
      cropRecommender: {
        accuracy: accuracies.crop_recommender || 0,
        avgInferenceTime: inferenceTimes.crop_recommender || 0,
        totalRecommendations: totalInferences.crop_recommender || 0,
      },
      priceForecaster: {
        mape: accuracies.price_forecaster || 0,
        avgInferenceTime: inferenceTimes.price_forecaster || 0,
        totalForecasts: totalInferences.price_forecaster || 0,
      },
      chatbot: {
        intentAccuracy: accuracies.chatbot || 0,
        avgResponseTime: inferenceTimes.chatbot || 0,
        totalQueries: totalInferences.chatbot || 0,
      },
    };
  } catch (error) {
    console.error('Error fetching ML metrics:', error);
    throw error;
  }
}

function parseMLMetrics(results: any[]): any {
  const metrics: any = {};
  
  results.forEach((result) => {
    const model = result.metric.model;
    const value = parseFloat(result.value[1]);
    metrics[model] = value;
  });
  
  return metrics;
}

// ============================================================================
// BUSINESS METRICS MONITORING
// ============================================================================

interface BusinessMetrics {
  timestamp: Date;
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  featureUsage: {
    diseaseDetections: number;
    cropRecommendations: number;
    priceChecks: number;
    weatherChecks: number;
    schemeViews: number;
    chatbotQueries: number;
  };
  retention: {
    day1: number;
    day7: number;
    day30: number;
  };
  npsScore: number;
  avgSessionDuration: number;
}

/**
 * Get business metrics from database and analytics
 */
async function getBusinessMetrics(): Promise<BusinessMetrics> {
  try {
    // Query active users
    const dauQuery = `
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics_events
      WHERE event_time >= NOW() - INTERVAL '1 day'
    `;
    
    const wauQuery = `
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics_events
      WHERE event_time >= NOW() - INTERVAL '7 days'
    `;
    
    const mauQuery = `
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics_events
      WHERE event_time >= NOW() - INTERVAL '30 days'
    `;
    
    const [dauRes, wauRes, mauRes] = await Promise.all([
      pool.query(dauQuery),
      pool.query(wauQuery),
      pool.query(mauQuery),
    ]);
    
    // Query feature usage (last 24 hours)
    const featureUsageQuery = `
      SELECT 
        event_name,
        COUNT(*) as count
      FROM analytics_events
      WHERE event_time >= NOW() - INTERVAL '1 day'
        AND event_name IN (
          'disease_detected',
          'crop_recommended',
          'price_checked',
          'weather_checked',
          'scheme_viewed',
          'chatbot_query'
        )
      GROUP BY event_name
    `;
    
    const featureUsageRes = await pool.query(featureUsageQuery);
    
    // Query retention rates
    const retentionQuery = `
      WITH cohort AS (
        SELECT 
          user_id,
          MIN(DATE(event_time)) as first_day
        FROM analytics_events
        GROUP BY user_id
      )
      SELECT
        COUNT(DISTINCT CASE 
          WHEN DATE(ae.event_time) = c.first_day + INTERVAL '1 day' 
          THEN ae.user_id 
        END)::float / COUNT(DISTINCT c.user_id) as day1_retention,
        COUNT(DISTINCT CASE 
          WHEN DATE(ae.event_time) BETWEEN c.first_day + INTERVAL '7 days' 
            AND c.first_day + INTERVAL '8 days'
          THEN ae.user_id 
        END)::float / COUNT(DISTINCT c.user_id) as day7_retention,
        COUNT(DISTINCT CASE 
          WHEN DATE(ae.event_time) BETWEEN c.first_day + INTERVAL '30 days' 
            AND c.first_day + INTERVAL '31 days'
          THEN ae.user_id 
        END)::float / COUNT(DISTINCT c.user_id) as day30_retention
      FROM cohort c
      LEFT JOIN analytics_events ae ON c.user_id = ae.user_id
      WHERE c.first_day >= NOW() - INTERVAL '60 days'
    `;
    
    const retentionRes = await pool.query(retentionQuery);
    
    // Query NPS score
    const npsQuery = `
      SELECT AVG(score) as avg_score
      FROM nps_surveys
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `;
    
    const npsRes = await pool.query(npsQuery);
    
    // Query average session duration
    const sessionDurationQuery = `
      SELECT AVG(session_duration_seconds) as avg_duration
      FROM analytics_sessions
      WHERE session_start >= NOW() - INTERVAL '7 days'
    `;
    
    const sessionDurationRes = await pool.query(sessionDurationQuery);
    
    // Parse feature usage
    const featureUsage: any = {
      diseaseDetections: 0,
      cropRecommendations: 0,
      priceChecks: 0,
      weatherChecks: 0,
      schemeViews: 0,
      chatbotQueries: 0,
    };
    
    featureUsageRes.rows.forEach((row) => {
      if (row.event_name === 'disease_detected') featureUsage.diseaseDetections = parseInt(row.count);
      else if (row.event_name === 'crop_recommended') featureUsage.cropRecommendations = parseInt(row.count);
      else if (row.event_name === 'price_checked') featureUsage.priceChecks = parseInt(row.count);
      else if (row.event_name === 'weather_checked') featureUsage.weatherChecks = parseInt(row.count);
      else if (row.event_name === 'scheme_viewed') featureUsage.schemeViews = parseInt(row.count);
      else if (row.event_name === 'chatbot_query') featureUsage.chatbotQueries = parseInt(row.count);
    });
    
    return {
      timestamp: new Date(),
      activeUsers: {
        daily: parseInt(dauRes.rows[0]?.count || '0'),
        weekly: parseInt(wauRes.rows[0]?.count || '0'),
        monthly: parseInt(mauRes.rows[0]?.count || '0'),
      },
      featureUsage,
      retention: {
        day1: parseFloat(retentionRes.rows[0]?.day1_retention || '0') * 100,
        day7: parseFloat(retentionRes.rows[0]?.day7_retention || '0') * 100,
        day30: parseFloat(retentionRes.rows[0]?.day30_retention || '0') * 100,
      },
      npsScore: parseFloat(npsRes.rows[0]?.avg_score || '0'),
      avgSessionDuration: parseFloat(sessionDurationRes.rows[0]?.avg_duration || '0'),
    };
  } catch (error) {
    console.error('Error fetching business metrics:', error);
    throw error;
  }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * GET /api/monitoring/system
 * Get current system performance metrics
 */
app.get('/api/monitoring/system', async (req, res) => {
  try {
    const metrics = await getSystemMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch system metrics' });
  }
});

/**
 * GET /api/monitoring/ml
 * Get current ML model performance metrics
 */
app.get('/api/monitoring/ml', async (req, res) => {
  try {
    const metrics = await getMLMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ML metrics' });
  }
});

/**
 * GET /api/monitoring/business
 * Get current business metrics
 */
app.get('/api/monitoring/business', async (req, res) => {
  try {
    const metrics = await getBusinessMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch business metrics' });
  }
});

/**
 * GET /api/monitoring/dashboard
 * Get all metrics for dashboard display
 */
app.get('/api/monitoring/dashboard', async (req, res) => {
  try {
    const [systemMetrics, mlMetrics, businessMetrics] = await Promise.all([
      getSystemMetrics(),
      getMLMetrics(),
      getBusinessMetrics(),
    ]);
    
    res.json({
      system: systemMetrics,
      ml: mlMetrics,
      business: businessMetrics,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(port, () => {
  console.log(`Monitoring dashboard running on port ${port}`);
  console.log(`Dashboard: http://localhost:${port}/api/monitoring/dashboard`);
});

export { getSystemMetrics, getMLMetrics, getBusinessMetrics };
