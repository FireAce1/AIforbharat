import request from 'supertest';
import app from '../index';
import { db } from '../config/database';
import { notificationService } from '../services/notificationService';
import { sendDeadlineReminders } from '../jobs/notificationJob';

// Mock the notification service
jest.mock('../services/notificationService', () => ({
  notificationService: {
    sendDeadlineReminder: jest.fn(),
    sendDeadlineReminderHindi: jest.fn(),
    sendDeadlineReminderMarathi: jest.fn(),
  },
}));

describe('Scheme Notification System', () => {
  let testUserId: string;
  let testSchemeId: string;

  beforeAll(async () => {
    // Create test user
    const userResult = await db.query(
      `INSERT INTO users (phone, name, language) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['+919876543210', 'Test User', 'hi']
    );
    testUserId = userResult.rows[0].id;

    // Create test scheme with deadline in 5 days
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 5);

    const schemeResult = await db.query(
      `INSERT INTO government_schemes (
        scheme_name, scheme_name_hi, scheme_name_mr,
        description, application_deadline, application_link,
        scheme_type, state, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        'Test Scheme',
        'परीक्षण योजना',
        'चाचणी योजना',
        'Test scheme description',
        deadlineDate.toISOString().split('T')[0],
        'https://example.com/apply',
        'subsidy',
        'Maharashtra',
        true
      ]
    );
    testSchemeId = schemeResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM scheme_subscriptions WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM government_schemes WHERE id = $1', [testSchemeId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await db.close();
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /api/v1/govt/schemes/alerts/subscribe', () => {
    it('should successfully subscribe user to scheme alerts', async () => {
      const response = await request(app)
        .post('/api/v1/govt/schemes/alerts/subscribe')
        .send({
          userId: testUserId,
          schemeId: testSchemeId,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully subscribed to scheme deadline alerts');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.user_id).toBe(testUserId);
      expect(response.body.data.scheme_id).toBe(testSchemeId);
      expect(response.body.data.notification_sent).toBe(false);
    });

    it('should return 409 for duplicate subscription', async () => {
      // First subscription
      await request(app)
        .post('/api/v1/govt/schemes/alerts/subscribe')
        .send({
          userId: testUserId,
          schemeId: testSchemeId,
        })
        .expect(201);

      // Duplicate subscription
      const response = await request(app)
        .post('/api/v1/govt/schemes/alerts/subscribe')
        .send({
          userId: testUserId,
          schemeId: testSchemeId,
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Already subscribed to this scheme');
    });

    it('should return 400 for invalid userId format', async () => {
      const response = await request(app)
        .post('/api/v1/govt/schemes/alerts/subscribe')
        .send({
          userId: 'invalid-uuid',
          schemeId: testSchemeId,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid subscription parameters');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/govt/schemes/alerts/subscribe')
        .send({
          userId: testUserId,
          // Missing schemeId
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid subscription parameters');
    });

    it('should return 500 for non-existent scheme', async () => {
      const fakeSchemeId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .post('/api/v1/govt/schemes/alerts/subscribe')
        .send({
          userId: testUserId,
          schemeId: fakeSchemeId,
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Deadline Reminder Job', () => {
    beforeEach(async () => {
      // Clean up any existing subscriptions
      await db.query('DELETE FROM scheme_subscriptions WHERE user_id = $1', [testUserId]);
    });

    it('should send notifications for schemes with deadlines within 7 days', async () => {
      // Create subscription
      await db.query(
        `INSERT INTO scheme_subscriptions (user_id, scheme_id, notification_sent)
         VALUES ($1, $2, FALSE)`,
        [testUserId, testSchemeId]
      );

      // Mock successful SMS sending
      (notificationService.sendDeadlineReminderHindi as jest.Mock).mockResolvedValue(true);

      // Run the notification job
      await sendDeadlineReminders();

      // Verify SMS was sent
      expect(notificationService.sendDeadlineReminderHindi).toHaveBeenCalledWith(
        '+919876543210',
        'परीक्षण योजना',
        expect.any(String),
        'https://example.com/apply'
      );

      // Verify notification_sent flag was updated
      const result = await db.query(
        `SELECT notification_sent FROM scheme_subscriptions 
         WHERE user_id = $1 AND scheme_id = $2`,
        [testUserId, testSchemeId]
      );
      expect(result.rows[0].notification_sent).toBe(true);
    });

    it('should not send duplicate notifications', async () => {
      // Create subscription with notification already sent
      await db.query(
        `INSERT INTO scheme_subscriptions (user_id, scheme_id, notification_sent)
         VALUES ($1, $2, TRUE)`,
        [testUserId, testSchemeId]
      );

      // Run the notification job
      await sendDeadlineReminders();

      // Verify SMS was NOT sent
      expect(notificationService.sendDeadlineReminderHindi).not.toHaveBeenCalled();
    });

    it('should handle SMS sending failures gracefully', async () => {
      // Create subscription
      await db.query(
        `INSERT INTO scheme_subscriptions (user_id, scheme_id, notification_sent)
         VALUES ($1, $2, FALSE)`,
        [testUserId, testSchemeId]
      );

      // Mock failed SMS sending
      (notificationService.sendDeadlineReminderHindi as jest.Mock).mockResolvedValue(false);

      // Run the notification job - should not throw
      await expect(sendDeadlineReminders()).resolves.not.toThrow();

      // Verify notification_sent flag was NOT updated
      const result = await db.query(
        `SELECT notification_sent FROM scheme_subscriptions 
         WHERE user_id = $1 AND scheme_id = $2`,
        [testUserId, testSchemeId]
      );
      expect(result.rows[0].notification_sent).toBe(false);
    });

    it('should send notifications in correct language based on user preference', async () => {
      // Update user language to Marathi
      await db.query(
        `UPDATE users SET language = 'mr' WHERE id = $1`,
        [testUserId]
      );

      // Create subscription
      await db.query(
        `INSERT INTO scheme_subscriptions (user_id, scheme_id, notification_sent)
         VALUES ($1, $2, FALSE)`,
        [testUserId, testSchemeId]
      );

      // Mock successful SMS sending
      (notificationService.sendDeadlineReminderMarathi as jest.Mock).mockResolvedValue(true);

      // Run the notification job
      await sendDeadlineReminders();

      // Verify Marathi SMS was sent
      expect(notificationService.sendDeadlineReminderMarathi).toHaveBeenCalledWith(
        '+919876543210',
        'चाचणी योजना',
        expect.any(String),
        'https://example.com/apply'
      );

      // Reset user language
      await db.query(
        `UPDATE users SET language = 'hi' WHERE id = $1`,
        [testUserId]
      );
    });

    it('should not send notifications for schemes with deadlines beyond 7 days', async () => {
      // Create scheme with deadline in 10 days
      const farDeadline = new Date();
      farDeadline.setDate(farDeadline.getDate() + 10);

      const farSchemeResult = await db.query(
        `INSERT INTO government_schemes (
          scheme_name, description, application_deadline, 
          application_link, scheme_type, state, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          'Far Future Scheme',
          'Scheme with far deadline',
          farDeadline.toISOString().split('T')[0],
          'https://example.com/apply',
          'subsidy',
          'Maharashtra',
          true
        ]
      );
      const farSchemeId = farSchemeResult.rows[0].id;

      // Create subscription
      await db.query(
        `INSERT INTO scheme_subscriptions (user_id, scheme_id, notification_sent)
         VALUES ($1, $2, FALSE)`,
        [testUserId, farSchemeId]
      );

      // Run the notification job
      await sendDeadlineReminders();

      // Verify no SMS was sent for far deadline
      expect(notificationService.sendDeadlineReminderHindi).not.toHaveBeenCalled();

      // Clean up
      await db.query('DELETE FROM scheme_subscriptions WHERE scheme_id = $1', [farSchemeId]);
      await db.query('DELETE FROM government_schemes WHERE id = $1', [farSchemeId]);
    });

    it('should not send notifications for inactive schemes', async () => {
      // Create inactive scheme
      const inactiveDeadline = new Date();
      inactiveDeadline.setDate(inactiveDeadline.getDate() + 5);

      const inactiveSchemeResult = await db.query(
        `INSERT INTO government_schemes (
          scheme_name, description, application_deadline, 
          application_link, scheme_type, state, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          'Inactive Scheme',
          'Inactive scheme',
          inactiveDeadline.toISOString().split('T')[0],
          'https://example.com/apply',
          'subsidy',
          'Maharashtra',
          false
        ]
      );
      const inactiveSchemeId = inactiveSchemeResult.rows[0].id;

      // Create subscription
      await db.query(
        `INSERT INTO scheme_subscriptions (user_id, scheme_id, notification_sent)
         VALUES ($1, $2, FALSE)`,
        [testUserId, inactiveSchemeId]
      );

      // Run the notification job
      await sendDeadlineReminders();

      // Verify no SMS was sent for inactive scheme
      expect(notificationService.sendDeadlineReminderHindi).not.toHaveBeenCalled();

      // Clean up
      await db.query('DELETE FROM scheme_subscriptions WHERE scheme_id = $1', [inactiveSchemeId]);
      await db.query('DELETE FROM government_schemes WHERE id = $1', [inactiveSchemeId]);
    });
  });
});
