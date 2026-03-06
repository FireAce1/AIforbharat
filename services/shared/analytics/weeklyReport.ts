import cron from 'node-cron';
import analyticsService from './analyticsService';
import logger from '../utils/logger';
import nodemailer from 'nodemailer';

interface WeeklyReportData {
  week_start: string;
  week_end: string;
  total_users: number;
  active_users_7d: number;
  new_users: number;
  retention_rate_7d: number;
  retention_rate_30d: number;
  top_features: Array<{ feature: string; count: number }>;
  total_events: number;
  avg_session_duration_minutes: number;
  feature_adoption: {
    disease_detection: number;
    crop_recommendation: number;
    market_prices: number;
    weather_forecast: number;
    government_schemes: number;
  };
  success_metrics: {
    nps_score?: number;
    app_rating?: number;
    crash_rate?: number;
  };
}

class WeeklyReportService {
  private emailTransporter: nodemailer.Transporter;

  constructor() {
    // Configure email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  /**
   * Generate weekly analytics report
   */
  async generateWeeklyReport(): Promise<WeeklyReportData> {
    try {
      logger.info('Generating weekly analytics report...');

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);

      // Get basic analytics report
      const report = await analyticsService.generateReport();

      // Calculate feature adoption rates
      const featureUsage = await analyticsService.getFeatureUsage();
      const featureAdoption = {
        disease_detection: featureUsage['disease_detected'] || 0,
        crop_recommendation: featureUsage['crop_recommended'] || 0,
        market_prices: featureUsage['price_checked'] || 0,
        weather_forecast: featureUsage['weather_checked'] || 0,
        government_schemes: featureUsage['scheme_viewed'] || 0,
      };

      const weeklyReport: WeeklyReportData = {
        week_start: weekStart.toISOString(),
        week_end: now.toISOString(),
        total_users: report.total_users,
        active_users_7d: report.active_users_7d,
        new_users: 0, // TODO: Calculate from user registration events
        retention_rate_7d: report.retention_rate_7d,
        retention_rate_30d: report.retention_rate_30d,
        top_features: report.top_features,
        total_events: report.total_events,
        avg_session_duration_minutes: 0, // TODO: Calculate from session events
        feature_adoption: featureAdoption,
        success_metrics: {
          nps_score: undefined, // TODO: Calculate from NPS surveys
          app_rating: undefined, // TODO: Fetch from Play Store API
          crash_rate: undefined, // TODO: Calculate from error events
        },
      };

      logger.info('Weekly analytics report generated successfully');
      return weeklyReport;
    } catch (error) {
      logger.error('Failed to generate weekly report:', error);
      throw error;
    }
  }

  /**
   * Format report as HTML email
   */
  formatReportEmail(report: WeeklyReportData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #2c5f2d;
      border-bottom: 3px solid #2c5f2d;
      padding-bottom: 10px;
    }
    h2 {
      color: #4a7c59;
      margin-top: 30px;
    }
    .metric {
      background: #f5f5f5;
      padding: 15px;
      margin: 10px 0;
      border-radius: 5px;
      border-left: 4px solid #2c5f2d;
    }
    .metric-value {
      font-size: 24px;
      font-weight: bold;
      color: #2c5f2d;
    }
    .metric-label {
      font-size: 14px;
      color: #666;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #2c5f2d;
      color: white;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>🌾 KrishiAI Weekly Analytics Report</h1>
  
  <p><strong>Report Period:</strong> ${new Date(report.week_start).toLocaleDateString()} - ${new Date(report.week_end).toLocaleDateString()}</p>

  <h2>📊 Key Metrics</h2>
  
  <div class="metric">
    <div class="metric-value">${report.total_users.toLocaleString()}</div>
    <div class="metric-label">Total Users</div>
  </div>

  <div class="metric">
    <div class="metric-value">${report.active_users_7d.toLocaleString()}</div>
    <div class="metric-label">Active Users (7 days)</div>
  </div>

  <div class="metric">
    <div class="metric-value">${report.retention_rate_7d.toFixed(1)}%</div>
    <div class="metric-label">7-Day Retention Rate</div>
  </div>

  <div class="metric">
    <div class="metric-value">${report.retention_rate_30d.toFixed(1)}%</div>
    <div class="metric-label">30-Day Retention Rate</div>
  </div>

  <div class="metric">
    <div class="metric-value">${report.total_events.toLocaleString()}</div>
    <div class="metric-label">Total Events</div>
  </div>

  <h2>🎯 Feature Adoption</h2>
  
  <table>
    <thead>
      <tr>
        <th>Feature</th>
        <th>Usage Count</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Disease Detection</td>
        <td>${report.feature_adoption.disease_detection.toLocaleString()}</td>
      </tr>
      <tr>
        <td>Crop Recommendation</td>
        <td>${report.feature_adoption.crop_recommendation.toLocaleString()}</td>
      </tr>
      <tr>
        <td>Market Prices</td>
        <td>${report.feature_adoption.market_prices.toLocaleString()}</td>
      </tr>
      <tr>
        <td>Weather Forecast</td>
        <td>${report.feature_adoption.weather_forecast.toLocaleString()}</td>
      </tr>
      <tr>
        <td>Government Schemes</td>
        <td>${report.feature_adoption.government_schemes.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <h2>🔥 Top Features</h2>
  
  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Feature</th>
        <th>Usage Count</th>
      </tr>
    </thead>
    <tbody>
      ${report.top_features
        .map(
          (feature, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${feature.feature}</td>
          <td>${feature.count.toLocaleString()}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <h2>✅ Success Metrics</h2>
  
  <div class="metric">
    <div class="metric-value">${report.success_metrics.nps_score !== undefined ? report.success_metrics.nps_score : 'N/A'}</div>
    <div class="metric-label">NPS Score</div>
  </div>

  <div class="metric">
    <div class="metric-value">${report.success_metrics.app_rating !== undefined ? report.success_metrics.app_rating.toFixed(1) : 'N/A'}</div>
    <div class="metric-label">App Rating</div>
  </div>

  <div class="metric">
    <div class="metric-value">${report.success_metrics.crash_rate !== undefined ? report.success_metrics.crash_rate.toFixed(2) + '%' : 'N/A'}</div>
    <div class="metric-label">Crash Rate</div>
  </div>

  <div class="footer">
    <p>This is an automated weekly report from KrishiAI Analytics.</p>
    <p>For questions or issues, contact the development team.</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Send weekly report via email
   */
  async sendWeeklyReport(recipients: string[]): Promise<void> {
    try {
      const report = await this.generateWeeklyReport();
      const htmlContent = this.formatReportEmail(report);

      const mailOptions = {
        from: process.env.SMTP_FROM || 'analytics@krishiai.com',
        to: recipients.join(', '),
        subject: `KrishiAI Weekly Analytics Report - ${new Date().toLocaleDateString()}`,
        html: htmlContent,
      };

      await this.emailTransporter.sendMail(mailOptions);
      logger.info(`Weekly report sent to ${recipients.length} recipients`);
    } catch (error) {
      logger.error('Failed to send weekly report:', error);
      throw error;
    }
  }

  /**
   * Schedule weekly report generation and sending
   */
  scheduleWeeklyReport(recipients: string[]): void {
    // Run every Monday at 9:00 AM
    cron.schedule('0 9 * * 1', async () => {
      try {
        logger.info('Starting scheduled weekly report generation...');
        await this.sendWeeklyReport(recipients);
        logger.info('Weekly report sent successfully');
      } catch (error) {
        logger.error('Failed to send scheduled weekly report:', error);
      }
    });

    logger.info('Weekly report scheduled for every Monday at 9:00 AM');
  }
}

export default new WeeklyReportService();
