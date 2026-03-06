import { database } from '../config/database';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import axios from 'axios';

export interface PriceAlert {
  id: string;
  user_id: string;
  phone: string;
  crop_name: string;
  market_name: string;
  target_price: number;
  alert_type: 'above' | 'below';
  is_active: boolean;
  created_at: Date;
}

export interface AlertSubscription {
  user_id: string;
  phone: string;
  crop_name: string;
  market_name: string;
  target_price: number;
  alert_type: 'above' | 'below';
}

export class AlertService {
  private smsServiceUrl: string;
  
  constructor() {
    // SMS service URL (could be Twilio, MSG91, etc.)
    this.smsServiceUrl = process.env.SMS_SERVICE_URL || 'http://localhost:3001/api/v1/sms';
  }
  
  /**
   * Create a price alert subscription
   */
  async createAlert(subscription: AlertSubscription): Promise<PriceAlert> {
    const query = `
      INSERT INTO price_alerts (
        user_id, phone, crop_name, market_name, 
        target_price, alert_type, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `;
    
    const values = [
      subscription.user_id,
      subscription.phone,
      subscription.crop_name,
      subscription.market_name,
      subscription.target_price,
      subscription.alert_type,
    ];
    
    try {
      const result = await database.query(query, values);
      const alert = result.rows[0];
      
      logger.info('Created price alert', {
        userId: subscription.user_id,
        crop: subscription.crop_name,
        targetPrice: subscription.target_price,
      });
      
      return alert;
    } catch (error) {
      logger.error('Error creating alert', { error, subscription });
      throw error;
    }
  }
  
  /**
   * Get active alerts for a user
   */
  async getUserAlerts(userId: string): Promise<PriceAlert[]> {
    const query = `
      SELECT * FROM price_alerts
      WHERE user_id = $1 AND is_active = true
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await database.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching user alerts', { error, userId });
      throw error;
    }
  }
  
  /**
   * Deactivate an alert
   */
  async deactivateAlert(alertId: string, userId: string): Promise<void> {
    const query = `
      UPDATE price_alerts
      SET is_active = false
      WHERE id = $1 AND user_id = $2
    `;
    
    try {
      await database.query(query, [alertId, userId]);
      logger.info('Deactivated alert', { alertId, userId });
    } catch (error) {
      logger.error('Error deactivating alert', { error, alertId });
      throw error;
    }
  }
  
  /**
   * Check all active alerts and send notifications
   * This should be called by a cron job
   */
  async checkAndNotifyAlerts(): Promise<void> {
    logger.info('Checking price alerts...');
    
    try {
      // Get all active alerts
      const alertsQuery = `
        SELECT * FROM price_alerts
        WHERE is_active = true
      `;
      
      const alertsResult = await database.query(alertsQuery);
      const alerts = alertsResult.rows;
      
      logger.info(`Found ${alerts.length} active alerts`);
      
      for (const alert of alerts) {
        await this.checkAlert(alert);
      }
      
      logger.info('Completed alert check');
    } catch (error) {
      logger.error('Error checking alerts', { error });
    }
  }
  
  /**
   * Check a single alert and send notification if triggered
   */
  private async checkAlert(alert: PriceAlert): Promise<void> {
    try {
      // Get current price for the crop/market
      const priceQuery = `
        SELECT price_per_kg
        FROM market_prices
        WHERE crop_name = $1 
          AND market_name = $2
          AND time >= CURRENT_DATE
        ORDER BY time DESC
        LIMIT 1
      `;
      
      const priceResult = await database.query(priceQuery, [
        alert.crop_name,
        alert.market_name,
      ]);
      
      if (priceResult.rows.length === 0) {
        logger.debug('No current price data for alert', {
          crop: alert.crop_name,
          market: alert.market_name,
        });
        return;
      }
      
      const currentPrice = parseFloat(priceResult.rows[0].price_per_kg);
      
      // Check if alert condition is met
      let shouldNotify = false;
      
      if (alert.alert_type === 'above' && currentPrice >= alert.target_price) {
        shouldNotify = true;
      } else if (alert.alert_type === 'below' && currentPrice <= alert.target_price) {
        shouldNotify = true;
      }
      
      if (shouldNotify) {
        // Check if we already sent notification today (avoid spam)
        const notificationKey = `alert_sent:${alert.id}:${new Date().toISOString().split('T')[0]}`;
        const alreadySent = await redisClient.get(notificationKey);
        
        if (!alreadySent) {
          await this.sendAlertNotification(alert, currentPrice);
          
          // Mark as sent for today
          await redisClient.set(notificationKey, 'true', 86400);
          
          logger.info('Sent price alert notification', {
            alertId: alert.id,
            crop: alert.crop_name,
            currentPrice,
            targetPrice: alert.target_price,
          });
        }
      }
    } catch (error) {
      logger.error('Error checking individual alert', { error, alertId: alert.id });
    }
  }
  
  /**
   * Send SMS notification for triggered alert
   */
  private async sendAlertNotification(alert: PriceAlert, currentPrice: number): Promise<void> {
    const message = `🔔 KrishiAI Price Alert: ${alert.crop_name} at ${alert.market_name} is now ₹${currentPrice}/kg (Target: ₹${alert.target_price}/kg)`;
    
    try {
      await axios.post(this.smsServiceUrl, {
        to: alert.phone,
        message,
        priority: 'HIGH',
      });
      
      logger.info('Sent SMS alert', {
        phone: alert.phone,
        crop: alert.crop_name,
      });
    } catch (error) {
      logger.error('Error sending SMS alert', { error, alert });
      // Don't throw - we don't want to stop processing other alerts
    }
  }
}

export const alertService = new AlertService();
