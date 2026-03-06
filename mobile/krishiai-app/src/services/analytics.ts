import analytics from '@react-native-firebase/analytics';
import { Platform } from 'react-native';

// Custom event names
export const AnalyticsEvents = {
  // Disease Detection
  DISEASE_DETECTED: 'disease_detected',
  DISEASE_DETECTION_STARTED: 'disease_detection_started',
  DISEASE_DETECTION_FAILED: 'disease_detection_failed',
  
  // Crop Recommendation
  CROP_RECOMMENDED: 'crop_recommended',
  CROP_RECOMMENDATION_REQUESTED: 'crop_recommendation_requested',
  CROP_SELECTED: 'crop_selected',
  
  // Market Intelligence
  PRICE_CHECKED: 'price_checked',
  PRICE_ALERT_CREATED: 'price_alert_created',
  PRICE_FORECAST_VIEWED: 'price_forecast_viewed',
  
  // Government Schemes
  SCHEME_VIEWED: 'scheme_viewed',
  SCHEME_SEARCHED: 'scheme_searched',
  SCHEME_APPLICATION_STARTED: 'scheme_application_started',
  
  // Weather & Water
  WEATHER_CHECKED: 'weather_checked',
  WATER_ADVISORY_VIEWED: 'water_advisory_viewed',
  IRRIGATION_RECOMMENDATION_FOLLOWED: 'irrigation_recommendation_followed',
  
  // Chatbot
  CHATBOT_QUERY_SENT: 'chatbot_query_sent',
  CHATBOT_VOICE_USED: 'chatbot_voice_used',
  
  // Sync
  SYNC_STARTED: 'sync_started',
  SYNC_COMPLETED: 'sync_completed',
  SYNC_FAILED: 'sync_failed',
  
  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  LANGUAGE_SELECTED: 'language_selected',
  FARM_PROFILE_CREATED: 'farm_profile_created',
  
  // Feature Usage
  FEATURE_ACCESSED: 'feature_accessed',
  SCREEN_VIEW: 'screen_view',
  BUTTON_CLICKED: 'button_clicked',
  
  // Errors
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',
  
  // Engagement
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
} as const;

// User properties
export const UserProperties = {
  LANGUAGE: 'language',
  FARM_SIZE: 'farm_size',
  SOIL_TYPE: 'soil_type',
  IRRIGATION_TYPE: 'irrigation_type',
  STATE: 'state',
  DISTRICT: 'district',
  USER_TYPE: 'user_type',
} as const;

class AnalyticsService {
  private isInitialized = false;

  /**
   * Initialize analytics service
   */
  async initialize(): Promise<void> {
    try {
      await analytics().setAnalyticsCollectionEnabled(true);
      this.isInitialized = true;
      console.log('Analytics initialized successfully');
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
    }
  }

  /**
   * Log a custom event
   */
  async logEvent(
    eventName: string,
    params?: { [key: string]: any }
  ): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Analytics not initialized');
      return;
    }

    try {
      // Add common parameters
      const enrichedParams = {
        ...params,
        platform: Platform.OS,
        timestamp: new Date().toISOString(),
      };

      await analytics().logEvent(eventName, enrichedParams);
      console.log(`Analytics event logged: ${eventName}`, enrichedParams);
    } catch (error) {
      console.error(`Failed to log event ${eventName}:`, error);
    }
  }

  /**
   * Log screen view
   */
  async logScreenView(
    screenName: string,
    screenClass?: string
  ): Promise<void> {
    try {
      await analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
      
      // Also log as custom event for easier querying
      await this.logEvent(AnalyticsEvents.SCREEN_VIEW, {
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
    } catch (error) {
      console.error(`Failed to log screen view ${screenName}:`, error);
    }
  }

  /**
   * Set user ID
   */
  async setUserId(userId: string): Promise<void> {
    try {
      await analytics().setUserId(userId);
      console.log(`User ID set: ${userId}`);
    } catch (error) {
      console.error('Failed to set user ID:', error);
    }
  }

  /**
   * Set user property
   */
  async setUserProperty(name: string, value: string): Promise<void> {
    try {
      await analytics().setUserProperty(name, value);
      console.log(`User property set: ${name} = ${value}`);
    } catch (error) {
      console.error(`Failed to set user property ${name}:`, error);
    }
  }

  /**
   * Set multiple user properties
   */
  async setUserProperties(properties: { [key: string]: string }): Promise<void> {
    try {
      for (const [key, value] of Object.entries(properties)) {
        await analytics().setUserProperty(key, value);
      }
      console.log('User properties set:', properties);
    } catch (error) {
      console.error('Failed to set user properties:', error);
    }
  }

  /**
   * Log disease detection event
   */
  async logDiseaseDetection(params: {
    disease_name: string;
    confidence: number;
    severity: string;
    crop_type?: string;
    detection_time_ms: number;
  }): Promise<void> {
    await this.logEvent(AnalyticsEvents.DISEASE_DETECTED, params);
  }

  /**
   * Log crop recommendation event
   */
  async logCropRecommendation(params: {
    recommended_crops: string[];
    top_crop: string;
    confidence: number;
    farm_size: number;
    soil_type: string;
  }): Promise<void> {
    await this.logEvent(AnalyticsEvents.CROP_RECOMMENDED, params);
  }

  /**
   * Log price check event
   */
  async logPriceCheck(params: {
    crop_name: string;
    current_price: number;
    trend: string;
    mandis_count: number;
  }): Promise<void> {
    await this.logEvent(AnalyticsEvents.PRICE_CHECKED, params);
  }

  /**
   * Log scheme view event
   */
  async logSchemeView(params: {
    scheme_id: string;
    scheme_name: string;
    scheme_type: string;
    is_eligible: boolean;
  }): Promise<void> {
    await this.logEvent(AnalyticsEvents.SCHEME_VIEWED, params);
  }

  /**
   * Log chatbot query event
   */
  async logChatbotQuery(params: {
    query_type: 'text' | 'voice';
    intent?: string;
    confidence?: number;
    response_time_ms: number;
  }): Promise<void> {
    await this.logEvent(AnalyticsEvents.CHATBOT_QUERY_SENT, params);
  }

  /**
   * Log sync event
   */
  async logSync(params: {
    status: 'started' | 'completed' | 'failed';
    items_synced?: number;
    duration_ms?: number;
    error_message?: string;
  }): Promise<void> {
    const eventName =
      params.status === 'started'
        ? AnalyticsEvents.SYNC_STARTED
        : params.status === 'completed'
        ? AnalyticsEvents.SYNC_COMPLETED
        : AnalyticsEvents.SYNC_FAILED;

    await this.logEvent(eventName, params);
  }

  /**
   * Log error event
   */
  async logError(params: {
    error_type: string;
    error_message: string;
    screen_name?: string;
    stack_trace?: string;
  }): Promise<void> {
    await this.logEvent(AnalyticsEvents.ERROR_OCCURRED, params);
  }

  /**
   * Log feature usage
   */
  async logFeatureUsage(params: {
    feature_name: string;
    action: string;
    duration_ms?: number;
  }): Promise<void> {
    await this.logEvent(AnalyticsEvents.FEATURE_ACCESSED, params);
  }

  /**
   * Log button click
   */
  async logButtonClick(params: {
    button_name: string;
    screen_name: string;
    context?: string;
  }): Promise<void> {
    await this.logEvent(AnalyticsEvents.BUTTON_CLICKED, params);
  }

  /**
   * Log session start
   */
  async logSessionStart(): Promise<void> {
    await this.logEvent(AnalyticsEvents.SESSION_START, {
      session_start_time: new Date().toISOString(),
    });
  }

  /**
   * Log session end
   */
  async logSessionEnd(sessionDurationMs: number): Promise<void> {
    await this.logEvent(AnalyticsEvents.SESSION_END, {
      session_duration_ms: sessionDurationMs,
      session_end_time: new Date().toISOString(),
    });
  }
}

export default new AnalyticsService();
