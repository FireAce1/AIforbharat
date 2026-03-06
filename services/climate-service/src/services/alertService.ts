import axios from 'axios';
import { config } from '../config';
import logger from '../utils/logger';

interface AlertRecipient {
  userId: string;
  phone: string;
  name?: string;
}

interface WeatherAlert {
  type: 'HEAVY_RAINFALL' | 'EXTREME_HEAT' | 'FROST' | 'HIGH_WIND';
  severity: 'HIGH' | 'CRITICAL';
  message: string;
  location: {
    lat: number;
    lng: number;
  };
}

class AlertService {
  private smsGatewayUrl: string;
  private smsApiKey: string;

  constructor() {
    this.smsGatewayUrl = config.sms.gatewayUrl || 'https://api.twilio.com/2010-04-01';
    this.smsApiKey = config.sms.apiKey || '';
  }

  /**
   * Send SMS alert to a single recipient
   */
  async sendSMS(phone: string, message: string): Promise<boolean> {
    try {
      // In production, integrate with actual SMS gateway (Twilio/MSG91)
      if (config.server.env === 'production' && this.smsApiKey) {
        const response = await axios.post(
          `${this.smsGatewayUrl}/Messages.json`,
          {
            To: phone,
            From: config.sms.fromNumber,
            Body: message,
          },
          {
            auth: {
              username: config.sms.accountSid || '',
              password: this.smsApiKey,
            },
          }
        );

        logger.info('SMS sent successfully', {
          phone: phone.substring(0, 6) + '****',
          messageId: response.data.sid,
        });

        return true;
      } else {
        // Development mode: log instead of sending
        logger.info('SMS (dev mode)', {
          phone: phone.substring(0, 6) + '****',
          message,
        });
        return true;
      }
    } catch (error) {
      logger.error('Failed to send SMS', {
        phone: phone.substring(0, 6) + '****',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Send weather alerts to multiple farmers
   */
  async sendWeatherAlerts(
    recipients: AlertRecipient[],
    alert: WeatherAlert
  ): Promise<{
    sent: number;
    failed: number;
    details: { userId: string; success: boolean }[];
  }> {
    const results = {
      sent: 0,
      failed: 0,
      details: [] as { userId: string; success: boolean }[],
    };

    logger.info('Sending weather alerts', {
      recipientCount: recipients.length,
      alertType: alert.type,
      severity: alert.severity,
    });

    for (const recipient of recipients) {
      const success = await this.sendSMS(recipient.phone, alert.message);

      results.details.push({
        userId: recipient.userId,
        success,
      });

      if (success) {
        results.sent++;
      } else {
        results.failed++;
      }

      // Rate limiting: wait 100ms between messages
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.info('Weather alerts sent', {
      sent: results.sent,
      failed: results.failed,
      alertType: alert.type,
    });

    return results;
  }

  /**
   * Format weather alert message in Hindi
   */
  formatAlertMessage(alert: WeatherAlert): string {
    const messages = {
      HEAVY_RAINFALL: `⚠️ भारी बारिश की चेतावनी! आज ${alert.message} की संभावना है। फसलों की सुरक्षा करें। - KrishiAI`,
      EXTREME_HEAT: `⚠️ अत्यधिक गर्मी की चेतावनी! तापमान ${alert.message}। पानी की व्यवस्था करें। - KrishiAI`,
      FROST: `⚠️ पाला चेतावनी! तापमान ${alert.message}। फसलों को ढकें। - KrishiAI`,
      HIGH_WIND: `⚠️ तेज हवा की चेतावनी! ${alert.message}। फसलों को सहारा दें। - KrishiAI`,
    };

    return messages[alert.type] || alert.message;
  }

  /**
   * Send irrigation reminder
   */
  async sendIrrigationReminder(
    phone: string,
    cropName: string,
    waterAmount: number,
    timing: string
  ): Promise<boolean> {
    const message = `💧 सिंचाई अनुस्मारक: आज ${timing} ${cropName} में ${waterAmount}mm पानी दें। - KrishiAI`;
    return this.sendSMS(phone, message);
  }

  /**
   * Send water savings notification
   */
  async sendWaterSavingsNotification(
    phone: string,
    savedAmount: number,
    period: string
  ): Promise<boolean> {
    const message = `🌱 बधाई हो! ${period} में आपने ${savedAmount}mm पानी बचाया। - KrishiAI`;
    return this.sendSMS(phone, message);
  }
}

export default new AlertService();
