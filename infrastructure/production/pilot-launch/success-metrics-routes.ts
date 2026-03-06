/**
 * Success Metrics API Routes
 * Task 19.4: Measure success metrics
 * 
 * Provides REST API endpoints for success metrics tracking and reporting
 */

import { Router, Request, Response } from 'express';
import { SuccessMetricsService } from './success-metrics-service';
import { Pool } from 'pg';
import { createClient } from 'redis';

export function createSuccessMetricsRoutes(db: Pool, redis: ReturnType<typeof createClient>): Router {
  const router = Router();
  const metricsService = new SuccessMetricsService(db, redis);

  /**
   * GET /api/success-metrics/summary
   * Get aggregated success metrics summary
   */
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const metrics = await metricsService.getSuccessMetricsSummary();
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching success metrics summary:', error);
      res.status(500).json({ error: 'Failed to fetch success metrics' });
    }
  });

  /**
   * GET /api/success-metrics/targets
   * Get metrics with targets and status
   */
  router.get('/targets', async (req: Request, res: Response) => {
    try {
      const targets = await metricsService.getMetricsWithTargets();
      res.json(targets);
    } catch (error) {
      console.error('Error fetching metrics with targets:', error);
      res.status(500).json({ error: 'Failed to fetch metrics with targets' });
    }
  });

  /**
   * POST /api/success-metrics/installation
   * Track app installation
   */
  router.post('/installation', async (req: Request, res: Response) => {
    try {
      const { userId, deviceId, deviceModel, androidVersion, appVersion, installationSource } = req.body;

      if (!userId || !deviceId || !appVersion) {
        return res.status(400).json({ error: 'Missing required fields: userId, deviceId, appVersion' });
      }

      await metricsService.trackAppInstallation({
        userId,
        deviceId,
        deviceModel,
        androidVersion,
        appVersion,
        installationSource,
      });

      res.json({ success: true, message: 'Installation tracked successfully' });
    } catch (error) {
      console.error('Error tracking installation:', error);
      res.status(500).json({ error: 'Failed to track installation' });
    }
  });

  /**
   * POST /api/success-metrics/activity
   * Track daily user activity
   */
  router.post('/activity', async (req: Request, res: Response) => {
    try {
      const { userId, activityDate, sessionCount, totalSessionDurationSeconds, featuresUsed } = req.body;

      if (!userId || !activityDate) {
        return res.status(400).json({ error: 'Missing required fields: userId, activityDate' });
      }

      await metricsService.trackUserActivity({
        userId,
        activityDate: new Date(activityDate),
        sessionCount: sessionCount || 1,
        totalSessionDurationSeconds: totalSessionDurationSeconds || 0,
        featuresUsed: featuresUsed || [],
      });

      res.json({ success: true, message: 'Activity tracked successfully' });
    } catch (error) {
      console.error('Error tracking activity:', error);
      res.status(500).json({ error: 'Failed to track activity' });
    }
  });

  /**
   * POST /api/success-metrics/feature-usage
   * Track feature usage
   */
  router.post('/feature-usage', async (req: Request, res: Response) => {
    try {
      const { userId, featureName } = req.body;

      if (!userId || !featureName) {
        return res.status(400).json({ error: 'Missing required fields: userId, featureName' });
      }

      await metricsService.trackFeatureUsage(userId, featureName);

      res.json({ success: true, message: 'Feature usage tracked successfully' });
    } catch (error) {
      console.error('Error tracking feature usage:', error);
      res.status(500).json({ error: 'Failed to track feature usage' });
    }
  });

  /**
   * POST /api/success-metrics/nps
   * Submit NPS survey
   */
  router.post('/nps', async (req: Request, res: Response) => {
    try {
      const { userId, score, feedbackText, surveyType } = req.body;

      if (!userId || score === undefined) {
        return res.status(400).json({ error: 'Missing required fields: userId, score' });
      }

      if (score < 0 || score > 10) {
        return res.status(400).json({ error: 'Score must be between 0 and 10' });
      }

      await metricsService.submitNPSSurvey({
        userId,
        score,
        feedbackText,
        surveyType,
      });

      res.json({ success: true, message: 'NPS survey submitted successfully' });
    } catch (error) {
      console.error('Error submitting NPS survey:', error);
      res.status(500).json({ error: 'Failed to submit NPS survey' });
    }
  });

  /**
   * POST /api/success-metrics/farmer-outcome
   * Submit farmer outcome survey
   */
  router.post('/farmer-outcome', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        surveyPeriod,
        surveyDate,
        monthlyIncomeInr,
        incomeIncreasePercentage,
        waterUsageMm,
        waterReductionPercentage,
        cropLossPercentage,
        cropLossReductionPercentage,
        satisfactionScore,
        challengesFaced,
        suggestions,
      } = req.body;

      if (!userId || !surveyPeriod) {
        return res.status(400).json({ error: 'Missing required fields: userId, surveyPeriod' });
      }

      await metricsService.submitFarmerOutcomeSurvey({
        userId,
        surveyPeriod,
        surveyDate: surveyDate ? new Date(surveyDate) : new Date(),
        monthlyIncomeInr,
        incomeIncreasePercentage,
        waterUsageMm,
        waterReductionPercentage,
        cropLossPercentage,
        cropLossReductionPercentage,
        satisfactionScore,
        challengesFaced,
        suggestions,
      });

      res.json({ success: true, message: 'Farmer outcome survey submitted successfully' });
    } catch (error) {
      console.error('Error submitting farmer outcome survey:', error);
      res.status(500).json({ error: 'Failed to submit farmer outcome survey' });
    }
  });

  /**
   * GET /api/success-metrics/cohorts
   * Get retention cohort analysis
   */
  router.get('/cohorts', async (req: Request, res: Response) => {
    try {
      const cohorts = await metricsService.getRetentionCohortAnalysis();
      res.json(cohorts);
    } catch (error) {
      console.error('Error fetching cohort analysis:', error);
      res.status(500).json({ error: 'Failed to fetch cohort analysis' });
    }
  });

  /**
   * GET /api/success-metrics/features
   * Get feature adoption metrics
   */
  router.get('/features', async (req: Request, res: Response) => {
    try {
      const features = await metricsService.getFeatureAdoptionMetrics();
      res.json(features);
    } catch (error) {
      console.error('Error fetching feature adoption metrics:', error);
      res.status(500).json({ error: 'Failed to fetch feature adoption metrics' });
    }
  });

  /**
   * GET /api/success-metrics/disease-detections
   * Get disease detection metrics
   */
  router.get('/disease-detections', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const metrics = await metricsService.getDiseaseDetectionMetrics(days);
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching disease detection metrics:', error);
      res.status(500).json({ error: 'Failed to fetch disease detection metrics' });
    }
  });

  /**
   * GET /api/success-metrics/report
   * Generate success metrics report
   */
  router.get('/report', async (req: Request, res: Response) => {
    try {
      const report = await metricsService.generateSuccessMetricsReport();
      
      // Return as markdown
      res.setHeader('Content-Type', 'text/markdown');
      res.send(report);
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });

  /**
   * GET /api/success-metrics/dashboard
   * Serve the success metrics dashboard HTML
   */
  router.get('/dashboard', (req: Request, res: Response) => {
    res.sendFile('success-metrics-dashboard.html', { root: __dirname });
  });

  return router;
}

