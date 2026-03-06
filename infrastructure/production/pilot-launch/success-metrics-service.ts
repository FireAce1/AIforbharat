/**
 * Success Metrics Service
 * Task 19.4: Measure success metrics
 * 
 * Tracks and aggregates pilot success metrics:
 * - App installations (target: 1,000)
 * - Monthly active users (target: 70% retention = 700 users)
 * - Disease detections (target: 500+)
 * - Marketplace inquiries (target: 200+)
 * - NPS score (target: >50)
 * - Average session duration (target: >5 minutes)
 * - Farmer income increase (target: 15% average)
 * - Water usage reduction (target: 20% average)
 * - Crop loss reduction (target: 25% average)
 */

import { Pool } from 'pg';
import { createClient } from 'redis';

interface SuccessMetrics {
  totalActiveInstallations: number;
  installationsLast30Days: number;
  monthlyActiveUsers: number;
  retentionRatePercentage: number;
  totalDiseaseDetections: number;
  detectionsLast30Days: number;
  totalMarketplaceInquiries: number;
  inquiriesLast30Days: number;
  avgNpsScore: number;
  avgSessionDurationMinutes: number;
  avgIncomeIncreasePercentage: number;
  avgWaterReductionPercentage: number;
  avgCropLossReductionPercentage: number;
}

interface MetricTarget {
  name: string;
  current: number;
  target: number;
  unit: string;
  status: 'on_track' | 'at_risk' | 'achieved';
  percentageOfTarget: number;
}

interface AppInstallation {
  userId: string;
  deviceId: string;
  deviceModel?: string;
  androidVersion?: string;
  appVersion: string;
  installationSource?: string;
}

interface UserActivity {
  userId: string;
  activityDate: Date;
  sessionCount: number;
  totalSessionDurationSeconds: number;
  featuresUsed: string[];
}

interface NPSSurvey {
  userId: string;
  score: number;
  feedbackText?: string;
  surveyType?: string;
}

interface FarmerOutcomeSurvey {
  userId: string;
  surveyPeriod: string;
  surveyDate: Date;
  monthlyIncomeInr?: number;
  incomeIncreasePercentage?: number;
  waterUsageMm?: number;
  waterReductionPercentage?: number;
  cropLossPercentage?: number;
  cropLossReductionPercentage?: number;
  satisfactionScore?: number;
  challengesFaced?: string;
  suggestions?: string;
}

export class SuccessMetricsService {
  private db: Pool;
  private redis: ReturnType<typeof createClient>;

  constructor(db: Pool, redis: ReturnType<typeof createClient>) {
    this.db = db;
    this.redis = redis;
  }

  /**
   * Get aggregated success metrics summary
   */
  async getSuccessMetricsSummary(): Promise<SuccessMetrics> {
    const cacheKey = 'success_metrics:summary';
    
    // Try cache first (5 minute TTL)
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.db.query('SELECT * FROM success_metrics_summary');
    const metrics: SuccessMetrics = {
      totalActiveInstallations: parseInt(result.rows[0].total_active_installations) || 0,
      installationsLast30Days: parseInt(result.rows[0].installations_last_30_days) || 0,
      monthlyActiveUsers: parseInt(result.rows[0].monthly_active_users) || 0,
      retentionRatePercentage: parseFloat(result.rows[0].retention_rate_percentage) || 0,
      totalDiseaseDetections: parseInt(result.rows[0].total_disease_detections) || 0,
      detectionsLast30Days: parseInt(result.rows[0].detections_last_30_days) || 0,
      totalMarketplaceInquiries: parseInt(result.rows[0].total_marketplace_inquiries) || 0,
      inquiriesLast30Days: parseInt(result.rows[0].inquiries_last_30_days) || 0,
      avgNpsScore: parseFloat(result.rows[0].avg_nps_score) || 0,
      avgSessionDurationMinutes: parseFloat(result.rows[0].avg_session_duration_minutes) || 0,
      avgIncomeIncreasePercentage: parseFloat(result.rows[0].avg_income_increase_percentage) || 0,
      avgWaterReductionPercentage: parseFloat(result.rows[0].avg_water_reduction_percentage) || 0,
      avgCropLossReductionPercentage: parseFloat(result.rows[0].avg_crop_loss_reduction_percentage) || 0,
    };

    // Cache for 5 minutes
    await this.redis.setEx(cacheKey, 300, JSON.stringify(metrics));

    return metrics;
  }

  /**
   * Get metrics with targets and status
   */
  async getMetricsWithTargets(): Promise<MetricTarget[]> {
    const metrics = await this.getSuccessMetricsSummary();

    const targets: MetricTarget[] = [
      {
        name: 'App Installations',
        current: metrics.totalActiveInstallations,
        target: 1000,
        unit: 'installations',
        status: this.getStatus(metrics.totalActiveInstallations, 1000),
        percentageOfTarget: this.getPercentage(metrics.totalActiveInstallations, 1000),
      },
      {
        name: 'Monthly Active Users',
        current: metrics.monthlyActiveUsers,
        target: 700,
        unit: 'users',
        status: this.getStatus(metrics.monthlyActiveUsers, 700),
        percentageOfTarget: this.getPercentage(metrics.monthlyActiveUsers, 700),
      },
      {
        name: 'Retention Rate',
        current: metrics.retentionRatePercentage,
        target: 70,
        unit: '%',
        status: this.getStatus(metrics.retentionRatePercentage, 70),
        percentageOfTarget: this.getPercentage(metrics.retentionRatePercentage, 70),
      },
      {
        name: 'Disease Detections',
        current: metrics.totalDiseaseDetections,
        target: 500,
        unit: 'detections',
        status: this.getStatus(metrics.totalDiseaseDetections, 500),
        percentageOfTarget: this.getPercentage(metrics.totalDiseaseDetections, 500),
      },
      {
        name: 'Marketplace Inquiries',
        current: metrics.totalMarketplaceInquiries,
        target: 200,
        unit: 'inquiries',
        status: this.getStatus(metrics.totalMarketplaceInquiries, 200),
        percentageOfTarget: this.getPercentage(metrics.totalMarketplaceInquiries, 200),
      },
      {
        name: 'NPS Score',
        current: metrics.avgNpsScore,
        target: 50,
        unit: 'score',
        status: this.getStatus(metrics.avgNpsScore, 50),
        percentageOfTarget: this.getPercentage(metrics.avgNpsScore, 50),
      },
      {
        name: 'Avg Session Duration',
        current: metrics.avgSessionDurationMinutes,
        target: 5,
        unit: 'minutes',
        status: this.getStatus(metrics.avgSessionDurationMinutes, 5),
        percentageOfTarget: this.getPercentage(metrics.avgSessionDurationMinutes, 5),
      },
      {
        name: 'Income Increase',
        current: metrics.avgIncomeIncreasePercentage,
        target: 15,
        unit: '%',
        status: this.getStatus(metrics.avgIncomeIncreasePercentage, 15),
        percentageOfTarget: this.getPercentage(metrics.avgIncomeIncreasePercentage, 15),
      },
      {
        name: 'Water Usage Reduction',
        current: metrics.avgWaterReductionPercentage,
        target: 20,
        unit: '%',
        status: this.getStatus(metrics.avgWaterReductionPercentage, 20),
        percentageOfTarget: this.getPercentage(metrics.avgWaterReductionPercentage, 20),
      },
      {
        name: 'Crop Loss Reduction',
        current: metrics.avgCropLossReductionPercentage,
        target: 25,
        unit: '%',
        status: this.getStatus(metrics.avgCropLossReductionPercentage, 25),
        percentageOfTarget: this.getPercentage(metrics.avgCropLossReductionPercentage, 25),
      },
    ];

    return targets;
  }

  /**
   * Track app installation
   */
  async trackAppInstallation(installation: AppInstallation): Promise<void> {
    await this.db.query(
      `INSERT INTO app_installations 
       (user_id, device_id, device_model, android_version, app_version, installation_source, first_launch_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (device_id) DO UPDATE SET
         first_launch_at = COALESCE(app_installations.first_launch_at, NOW()),
         is_active = TRUE`,
      [
        installation.userId,
        installation.deviceId,
        installation.deviceModel,
        installation.androidVersion,
        installation.appVersion,
        installation.installationSource,
      ]
    );

    // Invalidate cache
    await this.redis.del('success_metrics:summary');
  }

  /**
   * Track daily user activity
   */
  async trackUserActivity(activity: UserActivity): Promise<void> {
    await this.db.query(
      `INSERT INTO user_activity 
       (user_id, activity_date, session_count, total_session_duration_seconds, features_used)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, activity_date) DO UPDATE SET
         session_count = user_activity.session_count + $3,
         total_session_duration_seconds = user_activity.total_session_duration_seconds + $4,
         features_used = user_activity.features_used || $5::jsonb`,
      [
        activity.userId,
        activity.activityDate,
        activity.sessionCount,
        activity.totalSessionDurationSeconds,
        JSON.stringify(activity.featuresUsed),
      ]
    );

    // Invalidate cache
    await this.redis.del('success_metrics:summary');
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(userId: string, featureName: string): Promise<void> {
    await this.db.query(
      `INSERT INTO feature_usage (user_id, feature_name, usage_count, last_used_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (user_id, feature_name) DO UPDATE SET
         usage_count = feature_usage.usage_count + 1,
         last_used_at = NOW()`,
      [userId, featureName]
    );
  }

  /**
   * Submit NPS survey
   */
  async submitNPSSurvey(survey: NPSSurvey): Promise<void> {
    await this.db.query(
      `INSERT INTO nps_surveys (user_id, score, feedback_text, survey_date, survey_type)
       VALUES ($1, $2, $3, CURRENT_DATE, $4)`,
      [survey.userId, survey.score, survey.feedbackText, survey.surveyType || 'monthly']
    );

    // Invalidate cache
    await this.redis.del('success_metrics:summary');
  }

  /**
   * Submit farmer outcome survey
   */
  async submitFarmerOutcomeSurvey(survey: FarmerOutcomeSurvey): Promise<void> {
    await this.db.query(
      `INSERT INTO farmer_outcome_surveys 
       (user_id, survey_period, survey_date, monthly_income_inr, income_increase_percentage,
        water_usage_mm, water_reduction_percentage, crop_loss_percentage, 
        crop_loss_reduction_percentage, satisfaction_score, challenges_faced, suggestions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        survey.userId,
        survey.surveyPeriod,
        survey.surveyDate,
        survey.monthlyIncomeInr,
        survey.incomeIncreasePercentage,
        survey.waterUsageMm,
        survey.waterReductionPercentage,
        survey.cropLossPercentage,
        survey.cropLossReductionPercentage,
        survey.satisfactionScore,
        survey.challengesFaced,
        survey.suggestions,
      ]
    );

    // Invalidate cache
    await this.redis.del('success_metrics:summary');
  }

  /**
   * Get retention cohort analysis
   */
  async getRetentionCohortAnalysis(): Promise<any[]> {
    const result = await this.db.query(
      'SELECT * FROM retention_cohort_analysis ORDER BY cohort_month DESC LIMIT 12'
    );
    return result.rows;
  }

  /**
   * Get feature adoption metrics
   */
  async getFeatureAdoptionMetrics(): Promise<any[]> {
    const result = await this.db.query('SELECT * FROM feature_adoption_metrics');
    return result.rows;
  }

  /**
   * Get disease detection metrics
   */
  async getDiseaseDetectionMetrics(days: number = 30): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM disease_detection_metrics 
       WHERE detection_date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY detection_date DESC`
    );
    return result.rows;
  }

  /**
   * Generate success metrics report
   */
  async generateSuccessMetricsReport(): Promise<string> {
    const metrics = await this.getSuccessMetricsSummary();
    const targets = await this.getMetricsWithTargets();
    const cohorts = await this.getRetentionCohortAnalysis();
    const features = await this.getFeatureAdoptionMetrics();

    let report = '# KrishiAI Pilot Success Metrics Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += '## Key Metrics Summary\n\n';
    targets.forEach((target) => {
      const statusEmoji = target.status === 'achieved' ? '✅' : target.status === 'on_track' ? '🟢' : '🔴';
      report += `${statusEmoji} **${target.name}**: ${target.current.toFixed(2)} ${target.unit} / ${target.target} ${target.unit} (${target.percentageOfTarget.toFixed(1)}%)\n`;
    });

    report += '\n## Detailed Metrics\n\n';
    report += `- **Total Active Installations**: ${metrics.totalActiveInstallations}\n`;
    report += `- **Installations (Last 30 Days)**: ${metrics.installationsLast30Days}\n`;
    report += `- **Monthly Active Users**: ${metrics.monthlyActiveUsers}\n`;
    report += `- **Retention Rate**: ${metrics.retentionRatePercentage.toFixed(2)}%\n`;
    report += `- **Total Disease Detections**: ${metrics.totalDiseaseDetections}\n`;
    report += `- **Detections (Last 30 Days)**: ${metrics.detectionsLast30Days}\n`;
    report += `- **Total Marketplace Inquiries**: ${metrics.totalMarketplaceInquiries}\n`;
    report += `- **Inquiries (Last 30 Days)**: ${metrics.inquiriesLast30Days}\n`;
    report += `- **Average NPS Score**: ${metrics.avgNpsScore.toFixed(2)}\n`;
    report += `- **Average Session Duration**: ${metrics.avgSessionDurationMinutes.toFixed(2)} minutes\n`;
    report += `- **Average Income Increase**: ${metrics.avgIncomeIncreasePercentage.toFixed(2)}%\n`;
    report += `- **Average Water Reduction**: ${metrics.avgWaterReductionPercentage.toFixed(2)}%\n`;
    report += `- **Average Crop Loss Reduction**: ${metrics.avgCropLossReductionPercentage.toFixed(2)}%\n`;

    report += '\n## Retention Cohort Analysis\n\n';
    report += '| Cohort Month | Cohort Size | Active Users | Retention Rate |\n';
    report += '|--------------|-------------|--------------|----------------|\n';
    cohorts.forEach((cohort) => {
      report += `| ${cohort.cohort_month} | ${cohort.cohort_size} | ${cohort.active_users} | ${cohort.retention_rate_percentage}% |\n`;
    });

    report += '\n## Feature Adoption\n\n';
    report += '| Feature | Unique Users | Total Usage | Avg Usage/User | Adoption Rate |\n';
    report += '|---------|--------------|-------------|----------------|---------------|\n';
    features.forEach((feature) => {
      report += `| ${feature.feature_name} | ${feature.unique_users} | ${feature.total_usage} | ${feature.avg_usage_per_user} | ${feature.adoption_rate_percentage}% |\n`;
    });

    return report;
  }

  /**
   * Helper: Get status based on current vs target
   */
  private getStatus(current: number, target: number): 'on_track' | 'at_risk' | 'achieved' {
    const percentage = (current / target) * 100;
    if (percentage >= 100) return 'achieved';
    if (percentage >= 70) return 'on_track';
    return 'at_risk';
  }

  /**
   * Helper: Get percentage of target
   */
  private getPercentage(current: number, target: number): number {
    return Math.round((current / target) * 100 * 10) / 10;
  }
}
