import cron from 'node-cron';
import { db } from '../config/database';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';

/**
 * Daily job to check for schemes with deadlines within 7 days
 * and send SMS notifications to subscribed users
 * Runs daily at 9:00 AM IST
 */
export const scheduleNotificationJob = () => {
  // Schedule: Run daily at 9:00 AM IST (3:30 AM UTC)
  // Cron format: minute hour day month weekday
  cron.schedule('30 3 * * *', async () => {
    logger.info('Starting scheme deadline notification job');
    
    try {
      await sendDeadlineReminders();
      logger.info('Completed scheme deadline notification job');
    } catch (error) {
      logger.error('Error in notification job', { error });
    }
  }, {
    timezone: 'Asia/Kolkata'
  });
  
  logger.info('Notification job scheduled: Daily at 9:00 AM IST');
};

/**
 * Send deadline reminders for schemes expiring within 7 days
 */
export const sendDeadlineReminders = async (): Promise<void> => {
  const client = await db.getClient();
  
  try {
    // Calculate date 7 days from now
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    // Find schemes with deadlines in 7 days that haven't been notified
    const query = `
      SELECT 
        s.id as scheme_id,
        s.scheme_name,
        s.scheme_name_hi,
        s.scheme_name_mr,
        s.application_deadline,
        s.application_link,
        sub.id as subscription_id,
        sub.user_id,
        u.phone,
        u.language
      FROM government_schemes s
      JOIN scheme_subscriptions sub ON s.id = sub.scheme_id
      JOIN users u ON sub.user_id = u.id
      WHERE s.application_deadline <= $1
        AND s.application_deadline >= CURRENT_DATE
        AND sub.notification_sent = FALSE
        AND s.is_active = TRUE
      ORDER BY s.application_deadline ASC
    `;
    
    const result = await client.query(query, [sevenDaysFromNow]);
    
    logger.info(`Found ${result.rows.length} pending notifications to send`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Send notifications to each user
    for (const row of result.rows) {
      try {
        const {
          scheme_id,
          scheme_name,
          scheme_name_hi,
          scheme_name_mr,
          application_deadline,
          application_link,
          subscription_id,
          user_id,
          phone,
          language
        } = row;
        
        // Format deadline date
        const deadlineDate = new Date(application_deadline);
        const formattedDeadline = deadlineDate.toLocaleDateString('en-IN');
        
        // Send notification in user's preferred language
        let success = false;
        
        if (language === 'hi' && scheme_name_hi) {
          success = await notificationService.sendDeadlineReminderHindi(
            phone,
            scheme_name_hi,
            formattedDeadline,
            application_link || 'N/A'
          );
        } else if (language === 'mr' && scheme_name_mr) {
          success = await notificationService.sendDeadlineReminderMarathi(
            phone,
            scheme_name_mr,
            formattedDeadline,
            application_link || 'N/A'
          );
        } else {
          success = await notificationService.sendDeadlineReminder(
            phone,
            scheme_name,
            formattedDeadline,
            application_link || 'N/A'
          );
        }
        
        if (success) {
          // Mark notification as sent to avoid duplicates
          await client.query(
            `UPDATE scheme_subscriptions 
             SET notification_sent = TRUE 
             WHERE id = $1`,
            [subscription_id]
          );
          
          successCount++;
          
          logger.info('Sent deadline reminder', {
            scheme_id,
            user_id,
            phone: phone.substring(0, 6) + '****',
            deadline: formattedDeadline
          });
        } else {
          failureCount++;
          logger.warn('Failed to send deadline reminder', {
            scheme_id,
            user_id,
            phone: phone.substring(0, 6) + '****'
          });
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        failureCount++;
        logger.error('Error sending notification', {
          error,
          subscription_id: row.subscription_id
        });
      }
    }
    
    logger.info('Notification job completed', {
      total: result.rows.length,
      success: successCount,
      failed: failureCount
    });
    
  } catch (error) {
    logger.error('Error in sendDeadlineReminders', { error });
    throw error;
  } finally {
    client.release();
  }
};
