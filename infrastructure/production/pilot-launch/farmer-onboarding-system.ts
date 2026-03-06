/**
 * Farmer Onboarding System for Pilot Launch
 * 
 * Tracks onboarding progress for 1,000 pilot farmers across target villages
 * in Maharashtra, MP, UP, Punjab, and Karnataka
 */

import { Pool } from 'pg';
import Redis from 'ioredis';

interface Farmer {
  id: string;
  phone: string;
  name: string;
  village: string;
  state: string;
  coordinatorId: string;
  onboardingStatus: 'invited' | 'registered' | 'profile_complete' | 'active';
  registeredAt?: Date;
  lastActiveAt?: Date;
  farmProfileComplete: boolean;
  firstFeatureUsed?: string;
}

interface VillageCoordinator {
  id: string;
  name: string;
  phone: string;
  village: string;
  state: string;
  targetFarmers: number;
  onboardedFarmers: number;
  activeFarmers: number;
  trainingCompleted: boolean;
}

interface OnboardingMetrics {
  totalInvited: number;
  totalRegistered: number;
  totalProfileComplete: number;
  totalActive: number;
  byState: Record<string, number>;
  byCoordinator: Record<string, number>;
  dailyRegistrations: number;
  conversionRate: number;
}

export class FarmerOnboardingSystem {
  private db: Pool;
  private redis: Redis;

  constructor(dbConfig: any, redisConfig: any) {
    this.db = new Pool(dbConfig);
    this.redis = new Redis(redisConfig);
  }

  /**
   * Initialize database tables for pilot launch tracking
   */
  async initializeTables(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS village_coordinators (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(15) UNIQUE NOT NULL,
        village VARCHAR(100) NOT NULL,
        state VARCHAR(50) NOT NULL,
        target_farmers INTEGER DEFAULT 50,
        onboarded_farmers INTEGER DEFAULT 0,
        active_farmers INTEGER DEFAULT 0,
        training_completed BOOLEAN DEFAULT FALSE,
        training_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        INDEX idx_coordinator_state (state),
        INDEX idx_coordinator_village (village)
      );

      CREATE TABLE IF NOT EXISTS pilot_farmers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        phone VARCHAR(15) UNIQUE NOT NULL,
        name VARCHAR(100),
        village VARCHAR(100) NOT NULL,
        state VARCHAR(50) NOT NULL,
        coordinator_id UUID REFERENCES village_coordinators(id),
        onboarding_status VARCHAR(20) DEFAULT 'invited',
        invited_at TIMESTAMP DEFAULT NOW(),
        registered_at TIMESTAMP,
        profile_completed_at TIMESTAMP,
        last_active_at TIMESTAMP,
        farm_profile_complete BOOLEAN DEFAULT FALSE,
        first_feature_used VARCHAR(50),
        INDEX idx_pilot_status (onboarding_status),
        INDEX idx_pilot_coordinator (coordinator_id),
        INDEX idx_pilot_state (state)
      );

      CREATE TABLE IF NOT EXISTS onboarding_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id UUID REFERENCES pilot_farmers(id),
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        INDEX idx_event_farmer (farmer_id),
        INDEX idx_event_type (event_type),
        INDEX idx_event_time (created_at DESC)
      );

      CREATE TABLE IF NOT EXISTS training_camps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        village VARCHAR(100) NOT NULL,
        state VARCHAR(50) NOT NULL,
        scheduled_date DATE NOT NULL,
        coordinator_id UUID REFERENCES village_coordinators(id),
        venue VARCHAR(200),
        expected_attendees INTEGER,
        actual_attendees INTEGER,
        status VARCHAR(20) DEFAULT 'scheduled',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        INDEX idx_camp_date (scheduled_date),
        INDEX idx_camp_state (state)
      );
    `);

    console.log('✓ Pilot launch tables initialized');
  }

  /**
   * Register a village coordinator
   */
  async registerCoordinator(coordinator: Omit<VillageCoordinator, 'id' | 'onboardedFarmers' | 'activeFarmers'>): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO village_coordinators (name, phone, village, state, target_farmers, training_completed)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [coordinator.name, coordinator.phone, coordinator.village, coordinator.state, coordinator.targetFarmers, coordinator.trainingCompleted]
    );

    const coordinatorId = result.rows[0].id;
    console.log(`✓ Registered coordinator: ${coordinator.name} (${coordinator.village}, ${coordinator.state})`);
    return coordinatorId;
  }

  /**
   * Invite farmers to pilot program
   */
  async inviteFarmers(farmers: Array<{ phone: string; name: string; village: string; state: string; coordinatorId: string }>): Promise<void> {
    for (const farmer of farmers) {
      await this.db.query(
        `INSERT INTO pilot_farmers (phone, name, village, state, coordinator_id, onboarding_status)
         VALUES ($1, $2, $3, $4, $5, 'invited')
         ON CONFLICT (phone) DO NOTHING`,
        [farmer.phone, farmer.name, farmer.village, farmer.state, farmer.coordinatorId]
      );

      // Send invitation SMS
      await this.sendInvitationSMS(farmer.phone, farmer.name);
    }

    console.log(`✓ Invited ${farmers.length} farmers to pilot program`);
  }

  /**
   * Track farmer registration
   */
  async trackRegistration(phone: string, userId: string): Promise<void> {
    await this.db.query(
      `UPDATE pilot_farmers
       SET user_id = $1, onboarding_status = 'registered', registered_at = NOW()
       WHERE phone = $2`,
      [userId, phone]
    );

    await this.logEvent(phone, 'registration_completed', { userId });

    // Update coordinator stats
    await this.updateCoordinatorStats(phone);

    console.log(`✓ Tracked registration for ${phone}`);
  }

  /**
   * Track farm profile completion
   */
  async trackProfileCompletion(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE pilot_farmers
       SET onboarding_status = 'profile_complete', 
           profile_completed_at = NOW(),
           farm_profile_complete = TRUE
       WHERE user_id = $1`,
      [userId]
    );

    await this.logEvent(userId, 'profile_completed', {});
    console.log(`✓ Tracked profile completion for user ${userId}`);
  }

  /**
   * Track farmer activity
   */
  async trackActivity(userId: string, featureUsed: string): Promise<void> {
    const result = await this.db.query(
      `UPDATE pilot_farmers
       SET last_active_at = NOW(),
           onboarding_status = 'active',
           first_feature_used = COALESCE(first_feature_used, $2)
       WHERE user_id = $1
       RETURNING first_feature_used`,
      [userId, featureUsed]
    );

    if (result.rows[0]?.first_feature_used === featureUsed) {
      await this.logEvent(userId, 'first_feature_used', { feature: featureUsed });
    }

    await this.logEvent(userId, 'feature_used', { feature: featureUsed });
  }

  /**
   * Get onboarding metrics
   */
  async getMetrics(): Promise<OnboardingMetrics> {
    const overall = await this.db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE onboarding_status = 'invited') as invited,
        COUNT(*) FILTER (WHERE onboarding_status IN ('registered', 'profile_complete', 'active')) as registered,
        COUNT(*) FILTER (WHERE onboarding_status IN ('profile_complete', 'active')) as profile_complete,
        COUNT(*) FILTER (WHERE onboarding_status = 'active') as active
      FROM pilot_farmers
    `);

    const byState = await this.db.query(`
      SELECT state, COUNT(*) as count
      FROM pilot_farmers
      WHERE onboarding_status IN ('registered', 'profile_complete', 'active')
      GROUP BY state
    `);

    const byCoordinator = await this.db.query(`
      SELECT c.name, COUNT(p.*) as count
      FROM village_coordinators c
      LEFT JOIN pilot_farmers p ON c.id = p.coordinator_id
      WHERE p.onboarding_status IN ('registered', 'profile_complete', 'active')
      GROUP BY c.name
    `);

    const dailyRegistrations = await this.db.query(`
      SELECT COUNT(*) as count
      FROM pilot_farmers
      WHERE registered_at >= CURRENT_DATE
    `);

    const metrics = overall.rows[0];
    const totalInvited = parseInt(metrics.invited) + parseInt(metrics.registered);
    const totalRegistered = parseInt(metrics.registered);

    return {
      totalInvited,
      totalRegistered,
      totalProfileComplete: parseInt(metrics.profile_complete),
      totalActive: parseInt(metrics.active),
      byState: Object.fromEntries(byState.rows.map(r => [r.state, parseInt(r.count)])),
      byCoordinator: Object.fromEntries(byCoordinator.rows.map(r => [r.name, parseInt(r.count)])),
      dailyRegistrations: parseInt(dailyRegistrations.rows[0].count),
      conversionRate: totalInvited > 0 ? (totalRegistered / totalInvited) * 100 : 0
    };
  }

  /**
   * Get coordinator leaderboard
   */
  async getCoordinatorLeaderboard(): Promise<Array<VillageCoordinator & { rank: number }>> {
    const result = await this.db.query(`
      SELECT 
        c.*,
        COUNT(p.*) FILTER (WHERE p.onboarding_status IN ('registered', 'profile_complete', 'active')) as onboarded_farmers,
        COUNT(p.*) FILTER (WHERE p.onboarding_status = 'active') as active_farmers,
        RANK() OVER (ORDER BY COUNT(p.*) FILTER (WHERE p.onboarding_status IN ('registered', 'profile_complete', 'active')) DESC) as rank
      FROM village_coordinators c
      LEFT JOIN pilot_farmers p ON c.id = p.coordinator_id
      GROUP BY c.id
      ORDER BY rank
    `);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      village: row.village,
      state: row.state,
      targetFarmers: row.target_farmers,
      onboardedFarmers: parseInt(row.onboarded_farmers),
      activeFarmers: parseInt(row.active_farmers),
      trainingCompleted: row.training_completed,
      rank: parseInt(row.rank)
    }));
  }

  /**
   * Schedule training camp
   */
  async scheduleTrainingCamp(camp: {
    village: string;
    state: string;
    scheduledDate: Date;
    coordinatorId: string;
    venue: string;
    expectedAttendees: number;
  }): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO training_camps (village, state, scheduled_date, coordinator_id, venue, expected_attendees, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
       RETURNING id`,
      [camp.village, camp.state, camp.scheduledDate, camp.coordinatorId, camp.venue, camp.expectedAttendees]
    );

    console.log(`✓ Scheduled training camp in ${camp.village}, ${camp.state} on ${camp.scheduledDate}`);
    return result.rows[0].id;
  }

  /**
   * Record training camp completion
   */
  async recordTrainingCompletion(campId: string, actualAttendees: number, notes: string): Promise<void> {
    await this.db.query(
      `UPDATE training_camps
       SET status = 'completed', actual_attendees = $2, notes = $3
       WHERE id = $1`,
      [campId, actualAttendees, notes]
    );

    // Mark coordinator as trained
    const camp = await this.db.query('SELECT coordinator_id FROM training_camps WHERE id = $1', [campId]);
    if (camp.rows.length > 0) {
      await this.db.query(
        'UPDATE village_coordinators SET training_completed = TRUE, training_date = CURRENT_DATE WHERE id = $1',
        [camp.rows[0].coordinator_id]
      );
    }

    console.log(`✓ Recorded training camp completion: ${actualAttendees} attendees`);
  }

  /**
   * Generate daily report
   */
  async generateDailyReport(): Promise<string> {
    const metrics = await this.getMetrics();
    const leaderboard = await this.getCoordinatorLeaderboard();

    const report = `
📊 KrishiAI Pilot Launch - Daily Report
Date: ${new Date().toLocaleDateString('en-IN')}

📈 Overall Progress
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Invited: ${metrics.totalInvited} / 1,000
Total Registered: ${metrics.totalRegistered} (${metrics.conversionRate.toFixed(1)}%)
Profile Complete: ${metrics.totalProfileComplete}
Active Users: ${metrics.totalActive}
Today's Registrations: ${metrics.dailyRegistrations}

🗺️ By State
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${Object.entries(metrics.byState).map(([state, count]) => `${state}: ${count}`).join('\n')}

🏆 Top Coordinators
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${leaderboard.slice(0, 5).map(c => 
  `${c.rank}. ${c.name} (${c.village}): ${c.onboardedFarmers}/${c.targetFarmers} farmers`
).join('\n')}

🎯 Progress to Goal: ${((metrics.totalRegistered / 1000) * 100).toFixed(1)}%
`;

    return report;
  }

  // Private helper methods

  private async sendInvitationSMS(phone: string, name: string): Promise<void> {
    // Integration with SMS gateway (Twilio/MSG91)
    const message = `नमस्ते ${name}! KrishiAI में आपका स्वागत है। ऐप डाउनलोड करें: https://play.google.com/store/apps/details?id=com.krishiai.app`;
    
    // TODO: Implement actual SMS sending
    console.log(`SMS sent to ${phone}: ${message}`);
  }

  private async logEvent(identifier: string, eventType: string, eventData: any): Promise<void> {
    // Get farmer_id from phone or user_id
    const farmer = await this.db.query(
      'SELECT id FROM pilot_farmers WHERE phone = $1 OR user_id = $1',
      [identifier]
    );

    if (farmer.rows.length > 0) {
      await this.db.query(
        'INSERT INTO onboarding_events (farmer_id, event_type, event_data) VALUES ($1, $2, $3)',
        [farmer.rows[0].id, eventType, JSON.stringify(eventData)]
      );
    }
  }

  private async updateCoordinatorStats(phone: string): Promise<void> {
    await this.db.query(`
      UPDATE village_coordinators c
      SET onboarded_farmers = (
        SELECT COUNT(*) FROM pilot_farmers p
        WHERE p.coordinator_id = c.id
        AND p.onboarding_status IN ('registered', 'profile_complete', 'active')
      ),
      active_farmers = (
        SELECT COUNT(*) FROM pilot_farmers p
        WHERE p.coordinator_id = c.id
        AND p.onboarding_status = 'active'
      )
      WHERE c.id = (
        SELECT coordinator_id FROM pilot_farmers WHERE phone = $1
      )
    `, [phone]);
  }
}
