/**
 * Iteration Management System
 * 
 * Manages the iteration process based on pilot feedback:
 * - Issue prioritization (P0-Critical, P1-High, P2-Medium, P3-Low)
 * - Bug tracking and resolution workflow
 * - Performance bottleneck detection and optimization
 * - ML model retraining based on real-world data
 * - Documentation updates based on support questions
 * 
 * Requirements: 21.1-23.6
 */

import express from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
import nodemailer from 'nodemailer';

const app = express();
const port = process.env.ITERATION_PORT || 3102;

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

// Email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

app.use(express.json());

// ============================================================================
// ISSUE PRIORITIZATION
// ============================================================================

type Priority = 'P0' | 'P1' | 'P2' | 'P3';
type IssueType = 'bug' | 'feature' | 'performance' | 'ml_accuracy' | 'documentation';
type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';

interface Issue {
  id?: string;
  title: string;
  description: string;
  type: IssueType;
  priority: Priority;
  status: IssueStatus;
  source: string; // 'pain_point', 'nps_feedback', 'coordinator_interview', 'manual'
  sourceId?: string;
  affectedUsers: number;
  impactScore: number;
  assignedTo?: string;
  createdAt?: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
}

/**
 * Calculate priority based on severity, affected users, and impact
 */
function calculatePriority(
  severity: string,
  affectedUsers: number,
  impactScore: number
): Priority {
  // P0 (Critical): Service down, data loss, security vulnerability
  if (severity === 'critical' || impactScore >= 9) {
    return 'P0';
  }
  
  // P1 (High): Major feature broken, significant user impact
  if (severity === 'high' || (affectedUsers > 100 && impactScore >= 7)) {
    return 'P1';
  }
  
  // P2 (Medium): Minor feature issues, moderate user impact
  if (severity === 'medium' || (affectedUsers > 50 && impactScore >= 5)) {
    return 'P2';
  }
  
  // P3 (Low): Nice-to-have improvements, low user impact
  return 'P3';
}

/**
 * POST /api/iteration/issues
 * Create a new issue
 */
app.post('/api/iteration/issues', async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      severity,
      affectedUsers = 1,
      impactScore = 5,
      source = 'manual',
      sourceId,
      assignedTo,
    } = req.body;
    
    // Calculate priority
    const priority = calculatePriority(severity, affectedUsers, impactScore);
    
    // Insert into database
    const query = `
      INSERT INTO issues (
        title,
        description,
        type,
        priority,
        status,
        source,
        source_id,
        affected_users,
        impact_score,
        assigned_to,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      title,
      description,
      type,
      priority,
      source,
      sourceId,
      affectedUsers,
      impactScore,
      assignedTo,
    ]);
    
    const issue = result.rows[0];
    
    // Send notification for P0/P1 issues
    if (priority === 'P0' || priority === 'P1') {
      await sendIssueAlert(issue);
    }
    
    res.json({
      success: true,
      issue,
    });
  } catch (error) {
    console.error('Error creating issue:', error);
    res.status(500).json({ error: 'Failed to create issue' });
  }
});

/**
 * GET /api/iteration/issues
 * Get issues with filtering and sorting
 */
app.get('/api/iteration/issues', async (req, res) => {
  try {
    const {
      status = 'open',
      priority,
      type,
      assignedTo,
      limit = '50',
      offset = '0',
    } = req.query;
    
    let query = `
      SELECT *
      FROM issues
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (status !== 'all') {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (priority) {
      query += ` AND priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (assignedTo) {
      query += ` AND assigned_to = $${paramIndex}`;
      params.push(assignedTo);
      paramIndex++;
    }
    
    // Sort by priority (P0 first) then by affected users
    query += `
      ORDER BY 
        CASE priority
          WHEN 'P0' THEN 1
          WHEN 'P1' THEN 2
          WHEN 'P2' THEN 3
          WHEN 'P3' THEN 4
        END,
        affected_users DESC,
        created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      issues: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

/**
 * PATCH /api/iteration/issues/:id
 * Update issue status or assignment
 */
app.patch('/api/iteration/issues/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo, resolution } = req.body;
    
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (status) {
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
      
      if (status === 'resolved' || status === 'closed') {
        updates.push(`resolved_at = NOW()`);
      }
    }
    
    if (assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramIndex}`);
      params.push(assignedTo);
      paramIndex++;
    }
    
    if (resolution) {
      updates.push(`resolution = $${paramIndex}`);
      params.push(resolution);
      paramIndex++;
    }
    
    updates.push('updated_at = NOW()');
    
    const query = `
      UPDATE issues
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    params.push(id);
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    
    res.json({
      success: true,
      issue: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating issue:', error);
    res.status(500).json({ error: 'Failed to update issue' });
  }
});

/**
 * GET /api/iteration/issues/summary
 * Get issue summary by priority and type
 */
app.get('/api/iteration/issues/summary', async (req, res) => {
  try {
    const query = `
      SELECT 
        priority,
        type,
        status,
        COUNT(*) as count,
        SUM(affected_users) as total_affected_users
      FROM issues
      WHERE status IN ('open', 'in_progress')
      GROUP BY priority, type, status
      ORDER BY 
        CASE priority
          WHEN 'P0' THEN 1
          WHEN 'P1' THEN 2
          WHEN 'P2' THEN 3
          WHEN 'P3' THEN 4
        END
    `;
    
    const result = await pool.query(query);
    
    res.json({
      summary: result.rows,
    });
  } catch (error) {
    console.error('Error fetching issue summary:', error);
    res.status(500).json({ error: 'Failed to fetch issue summary' });
  }
});

async function sendIssueAlert(issue: any) {
  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ALERT_EMAIL || 'support@krishiai.com',
      subject: `🚨 ${issue.priority} Issue: ${issue.title}`,
      html: `
        <h2>${issue.priority} Priority Issue</h2>
        <p><strong>Title:</strong> ${issue.title}</p>
        <p><strong>Type:</strong> ${issue.type}</p>
        <p><strong>Priority:</strong> ${issue.priority}</p>
        <p><strong>Affected Users:</strong> ${issue.affected_users}</p>
        <p><strong>Impact Score:</strong> ${issue.impact_score}/10</p>
        <p><strong>Description:</strong> ${issue.description}</p>
        <p><strong>Action Required:</strong> ${issue.priority === 'P0' ? 'Immediate' : 'Within 24 hours'}</p>
      `,
    });
  } catch (error) {
    console.error('Error sending issue alert:', error);
  }
}

// ============================================================================
// PERFORMANCE BOTTLENECK DETECTION
// ============================================================================

interface PerformanceBottleneck {
  id?: string;
  service: string;
  endpoint: string;
  metric: string; // 'response_time', 'error_rate', 'throughput'
  currentValue: number;
  threshold: number;
  severity: string;
  detectedAt?: Date;
  resolvedAt?: Date;
}

/**
 * POST /api/iteration/performance/detect
 * Detect performance bottlenecks from metrics
 */
app.post('/api/iteration/performance/detect', async (req, res) => {
  try {
    // Query Prometheus for performance metrics
    const prometheusUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090';
    
    // Check API response times (threshold: 500ms)
    const responseTimeQuery = `
      histogram_quantile(0.95, 
        sum(rate(http_request_duration_seconds_bucket[5m])) by (service, endpoint, le)
      ) > 0.5
    `;
    
    // Check error rates (threshold: 1%)
    const errorRateQuery = `
      sum(rate(http_requests_total{status=~"5.."}[5m])) by (service, endpoint) /
      sum(rate(http_requests_total[5m])) by (service, endpoint) > 0.01
    `;
    
    const bottlenecks: PerformanceBottleneck[] = [];
    
    // Detect slow endpoints
    const axios = require('axios');
    const responseTimeRes = await axios.get(`${prometheusUrl}/api/v1/query`, {
      params: { query: responseTimeQuery },
    });
    
    responseTimeRes.data.data.result.forEach((result: any) => {
      bottlenecks.push({
        service: result.metric.service,
        endpoint: result.metric.endpoint,
        metric: 'response_time',
        currentValue: parseFloat(result.value[1]) * 1000, // Convert to ms
        threshold: 500,
        severity: parseFloat(result.value[1]) > 1 ? 'high' : 'medium',
      });
    });
    
    // Detect high error rates
    const errorRateRes = await axios.get(`${prometheusUrl}/api/v1/query`, {
      params: { query: errorRateQuery },
    });
    
    errorRateRes.data.data.result.forEach((result: any) => {
      bottlenecks.push({
        service: result.metric.service,
        endpoint: result.metric.endpoint,
        metric: 'error_rate',
        currentValue: parseFloat(result.value[1]) * 100, // Convert to percentage
        threshold: 1,
        severity: parseFloat(result.value[1]) > 0.05 ? 'critical' : 'high',
      });
    });
    
    // Store bottlenecks in database
    for (const bottleneck of bottlenecks) {
      const query = `
        INSERT INTO performance_bottlenecks (
          service,
          endpoint,
          metric,
          current_value,
          threshold,
          severity,
          detected_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (service, endpoint, metric) 
        DO UPDATE SET
          current_value = EXCLUDED.current_value,
          severity = EXCLUDED.severity,
          detected_at = NOW()
        RETURNING *
      `;
      
      await pool.query(query, [
        bottleneck.service,
        bottleneck.endpoint,
        bottleneck.metric,
        bottleneck.currentValue,
        bottleneck.threshold,
        bottleneck.severity,
      ]);
    }
    
    // Create issues for critical bottlenecks
    for (const bottleneck of bottlenecks) {
      if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
        await pool.query(`
          INSERT INTO issues (
            title,
            description,
            type,
            priority,
            status,
            source,
            affected_users,
            impact_score,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 'performance', $3, 'open', 'performance_monitor', 1000, $4, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [
          `Performance issue: ${bottleneck.service} ${bottleneck.endpoint}`,
          `${bottleneck.metric} is ${bottleneck.currentValue.toFixed(2)} (threshold: ${bottleneck.threshold})`,
          bottleneck.severity === 'critical' ? 'P0' : 'P1',
          bottleneck.severity === 'critical' ? 9 : 7,
        ]);
      }
    }
    
    res.json({
      success: true,
      bottlenecks,
      count: bottlenecks.length,
    });
  } catch (error) {
    console.error('Error detecting performance bottlenecks:', error);
    res.status(500).json({ error: 'Failed to detect performance bottlenecks' });
  }
});

/**
 * GET /api/iteration/performance/bottlenecks
 * Get current performance bottlenecks
 */
app.get('/api/iteration/performance/bottlenecks', async (req, res) => {
  try {
    const query = `
      SELECT *
      FROM performance_bottlenecks
      WHERE resolved_at IS NULL
      ORDER BY 
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
        END,
        detected_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      bottlenecks: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching bottlenecks:', error);
    res.status(500).json({ error: 'Failed to fetch bottlenecks' });
  }
});

// ============================================================================
// ML MODEL RETRAINING
// ============================================================================

interface ModelRetrainingJob {
  id?: string;
  modelName: string;
  reason: string;
  datasetSize: number;
  currentAccuracy: number;
  targetAccuracy: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  newAccuracy?: number;
}

/**
 * POST /api/iteration/ml/retrain
 * Queue ML model for retraining
 */
app.post('/api/iteration/ml/retrain', async (req, res) => {
  try {
    const {
      modelName,
      reason,
      datasetSize,
      currentAccuracy,
      targetAccuracy,
    } = req.body;
    
    // Insert retraining job
    const query = `
      INSERT INTO ml_retraining_jobs (
        model_name,
        reason,
        dataset_size,
        current_accuracy,
        target_accuracy,
        status,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      modelName,
      reason,
      datasetSize,
      currentAccuracy,
      targetAccuracy,
    ]);
    
    // Add to Redis queue for processing
    await redis.lpush('ml_retraining_queue', JSON.stringify(result.rows[0]));
    
    res.json({
      success: true,
      job: result.rows[0],
    });
  } catch (error) {
    console.error('Error queueing retraining job:', error);
    res.status(500).json({ error: 'Failed to queue retraining job' });
  }
});

/**
 * GET /api/iteration/ml/retraining-jobs
 * Get ML retraining jobs
 */
app.get('/api/iteration/ml/retraining-jobs', async (req, res) => {
  try {
    const { status = 'all', limit = '20' } = req.query;
    
    let query = `
      SELECT *
      FROM ml_retraining_jobs
    `;
    
    if (status !== 'all') {
      query += ` WHERE status = '${status}'`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT ${limit}`;
    
    const result = await pool.query(query);
    
    res.json({
      jobs: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching retraining jobs:', error);
    res.status(500).json({ error: 'Failed to fetch retraining jobs' });
  }
});

/**
 * POST /api/iteration/ml/collect-data
 * Collect real-world data for model improvement
 */
app.post('/api/iteration/ml/collect-data', async (req, res) => {
  try {
    const { modelName, period = '7' } = req.body;
    
    let dataQuery = '';
    let datasetSize = 0;
    
    // Collect data based on model type
    if (modelName === 'disease_detector') {
      dataQuery = `
        SELECT COUNT(*) as count
        FROM disease_detections
        WHERE detected_at >= NOW() - INTERVAL '${period} days'
          AND confidence >= 0.9
      `;
    } else if (modelName === 'crop_recommender') {
      dataQuery = `
        SELECT COUNT(*) as count
        FROM crop_recommendations
        WHERE created_at >= NOW() - INTERVAL '${period} days'
      `;
    } else if (modelName === 'price_forecaster') {
      dataQuery = `
        SELECT COUNT(*) as count
        FROM market_prices
        WHERE time >= NOW() - INTERVAL '${period} days'
      `;
    } else if (modelName === 'chatbot') {
      dataQuery = `
        SELECT COUNT(*) as count
        FROM chatbot_conversations
        WHERE created_at >= NOW() - INTERVAL '${period} days'
          AND confidence >= 0.85
      `;
    }
    
    if (dataQuery) {
      const result = await pool.query(dataQuery);
      datasetSize = parseInt(result.rows[0]?.count || '0');
    }
    
    res.json({
      success: true,
      modelName,
      datasetSize,
      period: `${period} days`,
      sufficientData: datasetSize >= 1000,
    });
  } catch (error) {
    console.error('Error collecting model data:', error);
    res.status(500).json({ error: 'Failed to collect model data' });
  }
});

// ============================================================================
// DOCUMENTATION UPDATES
// ============================================================================

interface DocumentationUpdate {
  id?: string;
  category: string; // 'faq', 'troubleshooting', 'user_guide', 'api_docs'
  question: string;
  answer: string;
  language: string;
  frequency: number; // How often this question is asked
  source: string; // 'support_ticket', 'chatbot', 'coordinator_feedback'
  status: 'pending' | 'approved' | 'published';
  createdAt?: Date;
}

/**
 * POST /api/iteration/docs/suggest
 * Suggest documentation update based on support questions
 */
app.post('/api/iteration/docs/suggest', async (req, res) => {
  try {
    const {
      category,
      question,
      answer,
      language,
      frequency = 1,
      source,
    } = req.body;
    
    // Insert documentation suggestion
    const query = `
      INSERT INTO documentation_updates (
        category,
        question,
        answer,
        language,
        frequency,
        source,
        status,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
      ON CONFLICT (question, language)
      DO UPDATE SET
        frequency = documentation_updates.frequency + 1,
        answer = EXCLUDED.answer
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      category,
      question,
      answer,
      language,
      frequency,
      source,
    ]);
    
    res.json({
      success: true,
      update: result.rows[0],
    });
  } catch (error) {
    console.error('Error suggesting documentation update:', error);
    res.status(500).json({ error: 'Failed to suggest documentation update' });
  }
});

/**
 * GET /api/iteration/docs/suggestions
 * Get documentation update suggestions
 */
app.get('/api/iteration/docs/suggestions', async (req, res) => {
  try {
    const { status = 'pending', language, limit = '50' } = req.query;
    
    let query = `
      SELECT *
      FROM documentation_updates
      WHERE status = $1
    `;
    
    const params: any[] = [status];
    let paramIndex = 2;
    
    if (language) {
      query += ` AND language = $${paramIndex}`;
      params.push(language);
      paramIndex++;
    }
    
    query += ` ORDER BY frequency DESC, created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      suggestions: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching documentation suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch documentation suggestions' });
  }
});

/**
 * POST /api/iteration/docs/analyze-support
 * Analyze support questions to identify documentation gaps
 */
app.post('/api/iteration/docs/analyze-support', async (req, res) => {
  try {
    const { period = '30' } = req.body;
    
    // Analyze chatbot queries for common questions
    const chatbotQuery = `
      SELECT 
        query_text,
        COUNT(*) as frequency,
        AVG(confidence) as avg_confidence
      FROM chatbot_conversations
      WHERE created_at >= NOW() - INTERVAL '${period} days'
        AND confidence < 0.85
      GROUP BY query_text
      HAVING COUNT(*) >= 5
      ORDER BY frequency DESC
      LIMIT 20
    `;
    
    const chatbotResult = await pool.query(chatbotQuery);
    
    // Analyze pain points for documentation needs
    const painPointQuery = `
      SELECT 
        category,
        description,
        COUNT(*) as frequency
      FROM pain_points
      WHERE created_at >= NOW() - INTERVAL '${period} days'
        AND category IN ('usability', 'language')
      GROUP BY category, description
      ORDER BY frequency DESC
      LIMIT 20
    `;
    
    const painPointResult = await pool.query(painPointQuery);
    
    // Create documentation suggestions
    const suggestions = [];
    
    for (const row of chatbotResult.rows) {
      suggestions.push({
        category: 'faq',
        question: row.query_text,
        frequency: parseInt(row.frequency),
        source: 'chatbot',
        avgConfidence: parseFloat(row.avg_confidence),
      });
    }
    
    for (const row of painPointResult.rows) {
      suggestions.push({
        category: 'troubleshooting',
        question: row.description,
        frequency: parseInt(row.frequency),
        source: 'pain_point',
      });
    }
    
    res.json({
      success: true,
      suggestions,
      total: suggestions.length,
      period: `${period} days`,
    });
  } catch (error) {
    console.error('Error analyzing support questions:', error);
    res.status(500).json({ error: 'Failed to analyze support questions' });
  }
});

// ============================================================================
// ITERATION DASHBOARD
// ============================================================================

/**
 * GET /api/iteration/dashboard
 * Get comprehensive iteration dashboard
 */
app.get('/api/iteration/dashboard', async (req, res) => {
  try {
    // Get issue summary
    const issuesQuery = `
      SELECT 
        priority,
        COUNT(*) as count
      FROM issues
      WHERE status IN ('open', 'in_progress')
      GROUP BY priority
    `;
    
    const issuesResult = await pool.query(issuesQuery);
    
    // Get performance bottlenecks
    const bottlenecksQuery = `
      SELECT COUNT(*) as count
      FROM performance_bottlenecks
      WHERE resolved_at IS NULL
    `;
    
    const bottlenecksResult = await pool.query(bottlenecksQuery);
    
    // Get ML retraining jobs
    const retrainingQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM ml_retraining_jobs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY status
    `;
    
    const retrainingResult = await pool.query(retrainingQuery);
    
    // Get documentation suggestions
    const docsQuery = `
      SELECT COUNT(*) as count
      FROM documentation_updates
      WHERE status = 'pending'
    `;
    
    const docsResult = await pool.query(docsQuery);
    
    // Get recent resolutions
    const resolutionsQuery = `
      SELECT COUNT(*) as count
      FROM issues
      WHERE resolved_at >= NOW() - INTERVAL '7 days'
    `;
    
    const resolutionsResult = await pool.query(resolutionsQuery);
    
    res.json({
      issues: {
        byPriority: issuesResult.rows,
        total: issuesResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
      },
      performanceBottlenecks: parseInt(bottlenecksResult.rows[0]?.count || '0'),
      mlRetraining: {
        byStatus: retrainingResult.rows,
        total: retrainingResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
      },
      documentationSuggestions: parseInt(docsResult.rows[0]?.count || '0'),
      recentResolutions: parseInt(resolutionsResult.rows[0]?.count || '0'),
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error fetching iteration dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch iteration dashboard' });
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
  console.log(`Iteration management system running on port ${port}`);
  console.log(`Dashboard: http://localhost:${port}/api/iteration/dashboard`);
});

export { app };
