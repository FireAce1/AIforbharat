/**
 * Feedback Collection System
 * 
 * Collects user feedback through:
 * - In-app surveys (NPS, feature satisfaction)
 * - Coordinator interviews
 * - Pain point tracking
 * - Usability issue reporting
 * 
 * Requirements: 21.2-21.6
 */

import express from 'express';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';

const app = express();
const port = process.env.FEEDBACK_PORT || 3101;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'krishiai_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Email transporter for notifications
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
// NPS SURVEY
// ============================================================================

interface NPSSurvey {
  userId: string;
  score: number; // 0-10
  reason?: string;
  language: string;
  createdAt: Date;
}

/**
 * POST /api/feedback/nps
 * Submit NPS survey response
 */
app.post('/api/feedback/nps', async (req, res) => {
  try {
    const { userId, score, reason, language } = req.body;
    
    // Validate score
    if (score < 0 || score > 10) {
      return res.status(400).json({ error: 'Score must be between 0 and 10' });
    }
    
    // Store in database
    const query = `
      INSERT INTO nps_surveys (user_id, score, reason, language, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, score, reason, language]);
    
    // Send notification for detractors (score 0-6)
    if (score <= 6) {
      await sendDetractorAlert(userId, score, reason);
    }
    
    res.json({
      success: true,
      survey: result.rows[0],
    });
  } catch (error) {
    console.error('Error submitting NPS survey:', error);
    res.status(500).json({ error: 'Failed to submit NPS survey' });
  }
});

/**
 * GET /api/feedback/nps/score
 * Get current NPS score
 */
app.get('/api/feedback/nps/score', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    
    const query = `
      WITH scores AS (
        SELECT 
          score,
          CASE 
            WHEN score >= 9 THEN 'promoter'
            WHEN score >= 7 THEN 'passive'
            ELSE 'detractor'
          END as category
        FROM nps_surveys
        WHERE created_at >= NOW() - INTERVAL '${period} days'
      )
      SELECT 
        COUNT(*) FILTER (WHERE category = 'promoter')::float / COUNT(*) * 100 as promoter_pct,
        COUNT(*) FILTER (WHERE category = 'detractor')::float / COUNT(*) * 100 as detractor_pct,
        (COUNT(*) FILTER (WHERE category = 'promoter')::float / COUNT(*) * 100) -
        (COUNT(*) FILTER (WHERE category = 'detractor')::float / COUNT(*) * 100) as nps_score,
        COUNT(*) as total_responses
      FROM scores
    `;
    
    const result = await pool.query(query);
    
    res.json({
      npsScore: Math.round(result.rows[0]?.nps_score || 0),
      promoterPercentage: Math.round(result.rows[0]?.promoter_pct || 0),
      detractorPercentage: Math.round(result.rows[0]?.detractor_pct || 0),
      totalResponses: parseInt(result.rows[0]?.total_responses || '0'),
      period: `${period} days`,
    });
  } catch (error) {
    console.error('Error fetching NPS score:', error);
    res.status(500).json({ error: 'Failed to fetch NPS score' });
  }
});

async function sendDetractorAlert(userId: string, score: number, reason?: string) {
  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ALERT_EMAIL || 'support@krishiai.com',
      subject: `🚨 Detractor Alert: User ${userId} gave NPS score ${score}`,
      html: `
        <h2>Detractor Alert</h2>
        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>NPS Score:</strong> ${score}/10</p>
        <p><strong>Reason:</strong> ${reason || 'Not provided'}</p>
        <p><strong>Action Required:</strong> Follow up with user to understand issues</p>
      `,
    });
  } catch (error) {
    console.error('Error sending detractor alert:', error);
  }
}

// ============================================================================
// FEATURE SATISFACTION SURVEYS
// ============================================================================

interface FeatureSurvey {
  userId: string;
  feature: string;
  satisfaction: number; // 1-5
  feedback?: string;
  language: string;
  createdAt: Date;
}

/**
 * POST /api/feedback/feature
 * Submit feature satisfaction survey
 */
app.post('/api/feedback/feature', async (req, res) => {
  try {
    const { userId, feature, satisfaction, feedback, language } = req.body;
    
    // Validate satisfaction
    if (satisfaction < 1 || satisfaction > 5) {
      return res.status(400).json({ error: 'Satisfaction must be between 1 and 5' });
    }
    
    // Store in database
    const query = `
      INSERT INTO feature_surveys (user_id, feature, satisfaction, feedback, language, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, feature, satisfaction, feedback, language]);
    
    res.json({
      success: true,
      survey: result.rows[0],
    });
  } catch (error) {
    console.error('Error submitting feature survey:', error);
    res.status(500).json({ error: 'Failed to submit feature survey' });
  }
});

/**
 * GET /api/feedback/feature/summary
 * Get feature satisfaction summary
 */
app.get('/api/feedback/feature/summary', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    
    const query = `
      SELECT 
        feature,
        AVG(satisfaction) as avg_satisfaction,
        COUNT(*) as total_responses,
        COUNT(*) FILTER (WHERE satisfaction <= 2) as dissatisfied_count
      FROM feature_surveys
      WHERE created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY feature
      ORDER BY avg_satisfaction ASC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      features: result.rows.map((row) => ({
        feature: row.feature,
        avgSatisfaction: parseFloat(row.avg_satisfaction).toFixed(2),
        totalResponses: parseInt(row.total_responses),
        dissatisfiedCount: parseInt(row.dissatisfied_count),
      })),
      period: `${period} days`,
    });
  } catch (error) {
    console.error('Error fetching feature summary:', error);
    res.status(500).json({ error: 'Failed to fetch feature summary' });
  }
});

// ============================================================================
// PAIN POINT TRACKING
// ============================================================================

interface PainPoint {
  userId: string;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  language: string;
  createdAt: Date;
}

/**
 * POST /api/feedback/pain-point
 * Report a pain point or usability issue
 */
app.post('/api/feedback/pain-point', async (req, res) => {
  try {
    const { userId, category, description, severity, language } = req.body;
    
    // Store in database
    const query = `
      INSERT INTO pain_points (user_id, category, description, severity, language, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'open', NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, category, description, severity, language]);
    
    // Send alert for critical issues
    if (severity === 'critical') {
      await sendCriticalIssueAlert(userId, category, description);
    }
    
    res.json({
      success: true,
      painPoint: result.rows[0],
    });
  } catch (error) {
    console.error('Error reporting pain point:', error);
    res.status(500).json({ error: 'Failed to report pain point' });
  }
});

/**
 * GET /api/feedback/pain-points
 * Get all pain points with filtering
 */
app.get('/api/feedback/pain-points', async (req, res) => {
  try {
    const { status = 'open', severity, category, limit = '50' } = req.query;
    
    let query = `
      SELECT *
      FROM pain_points
      WHERE status = $1
    `;
    
    const params: any[] = [status];
    let paramIndex = 2;
    
    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }
    
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    query += ` ORDER BY 
      CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      created_at DESC
      LIMIT $${paramIndex}
    `;
    
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      painPoints: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching pain points:', error);
    res.status(500).json({ error: 'Failed to fetch pain points' });
  }
});

/**
 * GET /api/feedback/pain-points/summary
 * Get pain point summary by category and severity
 */
app.get('/api/feedback/pain-points/summary', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    
    const query = `
      SELECT 
        category,
        severity,
        COUNT(*) as count
      FROM pain_points
      WHERE created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY category, severity
      ORDER BY count DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      summary: result.rows,
      period: `${period} days`,
    });
  } catch (error) {
    console.error('Error fetching pain point summary:', error);
    res.status(500).json({ error: 'Failed to fetch pain point summary' });
  }
});

async function sendCriticalIssueAlert(userId: string, category: string, description: string) {
  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ALERT_EMAIL || 'support@krishiai.com',
      subject: `🚨 Critical Issue Reported: ${category}`,
      html: `
        <h2>Critical Issue Alert</h2>
        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>Category:</strong> ${category}</p>
        <p><strong>Description:</strong> ${description}</p>
        <p><strong>Action Required:</strong> Immediate investigation and resolution</p>
      `,
    });
  } catch (error) {
    console.error('Error sending critical issue alert:', error);
  }
}

// ============================================================================
// COORDINATOR INTERVIEWS
// ============================================================================

interface CoordinatorInterview {
  coordinatorId: string;
  interviewDate: Date;
  farmersFeedback: string;
  commonIssues: string[];
  suggestions: string[];
  overallSentiment: 'positive' | 'neutral' | 'negative';
  notes: string;
}

/**
 * POST /api/feedback/coordinator-interview
 * Submit coordinator interview notes
 */
app.post('/api/feedback/coordinator-interview', async (req, res) => {
  try {
    const {
      coordinatorId,
      interviewDate,
      farmersFeedback,
      commonIssues,
      suggestions,
      overallSentiment,
      notes,
    } = req.body;
    
    // Store in database
    const query = `
      INSERT INTO coordinator_interviews (
        coordinator_id,
        interview_date,
        farmers_feedback,
        common_issues,
        suggestions,
        overall_sentiment,
        notes,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      coordinatorId,
      interviewDate,
      farmersFeedback,
      JSON.stringify(commonIssues),
      JSON.stringify(suggestions),
      overallSentiment,
      notes,
    ]);
    
    res.json({
      success: true,
      interview: result.rows[0],
    });
  } catch (error) {
    console.error('Error submitting coordinator interview:', error);
    res.status(500).json({ error: 'Failed to submit coordinator interview' });
  }
});

/**
 * GET /api/feedback/coordinator-interviews
 * Get coordinator interview summaries
 */
app.get('/api/feedback/coordinator-interviews', async (req, res) => {
  try {
    const { period = '30', sentiment } = req.query;
    
    let query = `
      SELECT *
      FROM coordinator_interviews
      WHERE interview_date >= NOW() - INTERVAL '${period} days'
    `;
    
    if (sentiment) {
      query += ` AND overall_sentiment = '${sentiment}'`;
    }
    
    query += ` ORDER BY interview_date DESC`;
    
    const result = await pool.query(query);
    
    res.json({
      interviews: result.rows.map((row) => ({
        ...row,
        commonIssues: JSON.parse(row.common_issues),
        suggestions: JSON.parse(row.suggestions),
      })),
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching coordinator interviews:', error);
    res.status(500).json({ error: 'Failed to fetch coordinator interviews' });
  }
});

// ============================================================================
// FEEDBACK ANALYTICS
// ============================================================================

/**
 * GET /api/feedback/analytics
 * Get comprehensive feedback analytics
 */
app.get('/api/feedback/analytics', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    
    // Get NPS score
    const npsQuery = `
      WITH scores AS (
        SELECT 
          score,
          CASE 
            WHEN score >= 9 THEN 'promoter'
            WHEN score >= 7 THEN 'passive'
            ELSE 'detractor'
          END as category
        FROM nps_surveys
        WHERE created_at >= NOW() - INTERVAL '${period} days'
      )
      SELECT 
        (COUNT(*) FILTER (WHERE category = 'promoter')::float / COUNT(*) * 100) -
        (COUNT(*) FILTER (WHERE category = 'detractor')::float / COUNT(*) * 100) as nps_score
      FROM scores
    `;
    
    // Get feature satisfaction
    const featureQuery = `
      SELECT 
        feature,
        AVG(satisfaction) as avg_satisfaction
      FROM feature_surveys
      WHERE created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY feature
    `;
    
    // Get pain point counts
    const painPointQuery = `
      SELECT 
        severity,
        COUNT(*) as count
      FROM pain_points
      WHERE created_at >= NOW() - INTERVAL '${period} days'
        AND status = 'open'
      GROUP BY severity
    `;
    
    // Get coordinator sentiment
    const sentimentQuery = `
      SELECT 
        overall_sentiment,
        COUNT(*) as count
      FROM coordinator_interviews
      WHERE interview_date >= NOW() - INTERVAL '${period} days'
      GROUP BY overall_sentiment
    `;
    
    const [npsRes, featureRes, painPointRes, sentimentRes] = await Promise.all([
      pool.query(npsQuery),
      pool.query(featureQuery),
      pool.query(painPointQuery),
      pool.query(sentimentQuery),
    ]);
    
    res.json({
      npsScore: Math.round(npsRes.rows[0]?.nps_score || 0),
      featureSatisfaction: featureRes.rows,
      painPoints: painPointRes.rows,
      coordinatorSentiment: sentimentRes.rows,
      period: `${period} days`,
    });
  } catch (error) {
    console.error('Error fetching feedback analytics:', error);
    res.status(500).json({ error: 'Failed to fetch feedback analytics' });
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
  console.log(`Feedback collection system running on port ${port}`);
  console.log(`Submit NPS: POST http://localhost:${port}/api/feedback/nps`);
  console.log(`Submit feature feedback: POST http://localhost:${port}/api/feedback/feature`);
  console.log(`Report pain point: POST http://localhost:${port}/api/feedback/pain-point`);
});

export { app };
