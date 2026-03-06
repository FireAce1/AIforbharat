import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';

interface SMSPayload {
  to: string;
  message: string;
}

/**
 * NotificationService handles SMS notifications for scheme deadline alerts
 */
export class NotificationService {
  private smsGatewayUrl: string;
  private smsApiKey: string;
  private smsAccountSid: string;
  private smsFromNumber: string;

  constructor() {
    this.smsGatewayUrl = config.sms?.gatewayUrl || 'https://api.twilio.com/2010-04-01';
    this.smsApiKey = config.sms?.apiKey || '';
    this.smsAccountSid = config.sms?.accountSid || '';
    this.smsFromNumber = config.sms?.fromNumber || '';
  }

  /**
   * Send SMS notification to a single recipient
   * @param phone - Recipient phone number (format: +91XXXXXXXXXX)
   * @param message - SMS message content
   * @returns Promise<boolean> - true if sent successfully
   */
  async sendSMS(phone: string, message: string): Promise<boolean> {
    try {
      // In production, integrate with actual SMS gateway (Twilio/MSG91)
      if (config.nodeEnv === 'production' && this.smsApiKey) {
        const response = await axios.post(
          `${this.smsGatewayUrl}/Accounts/${this.smsAccountSid}/Messages.json`,
          {
            To: phone,
            From: this.smsFromNumber,
            Body: message,
          },
          {
            auth: {
              username: this.smsAccountSid,
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
   * Send scheme deadline reminder notification
   * @param phone - Recipient phone number
   * @param schemeName - Name of the scheme
   * @param deadline - Application deadline date
   * @param applicationLink - Link to apply for the scheme
   * @returns Promise<boolean> - true if sent successfully
   */
  async sendDeadlineReminder(
    phone: string,
    schemeName: string,
    deadline: string,
    applicationLink: string
  ): Promise<boolean> {
    const message = `⏰ Reminder: ${schemeName} deadline is ${deadline}. Apply now: ${applicationLink} - KrishiAI`;
    return this.sendSMS(phone, message);
  }

  /**
   * Send scheme deadline reminder in Hindi
   * @param phone - Recipient phone number
   * @param schemeName - Name of the scheme in Hindi
   * @param deadline - Application deadline date
   * @param applicationLink - Link to apply for the scheme
   * @returns Promise<boolean> - true if sent successfully
   */
  async sendDeadlineReminderHindi(
    phone: string,
    schemeName: string,
    deadline: string,
    applicationLink: string
  ): Promise<boolean> {
    const message = `⏰ अनुस्मारक: ${schemeName} की अंतिम तिथि ${deadline} है। अभी आवेदन करें: ${applicationLink} - KrishiAI`;
    return this.sendSMS(phone, message);
  }

  /**
   * Send scheme deadline reminder in Marathi
   * @param phone - Recipient phone number
   * @param schemeName - Name of the scheme in Marathi
   * @param deadline - Application deadline date
   * @param applicationLink - Link to apply for the scheme
   * @returns Promise<boolean> - true if sent successfully
   */
  async sendDeadlineReminderMarathi(
    phone: string,
    schemeName: string,
    deadline: string,
    applicationLink: string
  ): Promise<boolean> {
    const message = `⏰ स्मरणपत्र: ${schemeName} ची अंतिम तारीख ${deadline} आहे. आता अर्ज करा: ${applicationLink} - KrishiAI`;
    return this.sendSMS(phone, message);
  }
}

export const notificationService = new NotificationService();
