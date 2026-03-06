import analytics from '@react-native-firebase/analytics';
import analyticsService, { AnalyticsEvents } from '../analytics';

jest.mock('@react-native-firebase/analytics', () => {
  return () => ({
    setAnalyticsCollectionEnabled: jest.fn().mockResolvedValue(undefined),
    logEvent: jest.fn().mockResolvedValue(undefined),
    logScreenView: jest.fn().mockResolvedValue(undefined),
    setUserId: jest.fn().mockResolvedValue(undefined),
    setUserProperty: jest.fn().mockResolvedValue(undefined),
  });
});

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should enable analytics collection', async () => {
      await analyticsService.initialize();
      expect(analytics().setAnalyticsCollectionEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe('logEvent', () => {
    it('should log custom event with parameters', async () => {
      await analyticsService.initialize();
      
      const params = {
        disease_name: 'Tomato Late Blight',
        confidence: 0.95,
      };

      await analyticsService.logEvent(AnalyticsEvents.DISEASE_DETECTED, params);

      expect(analytics().logEvent).toHaveBeenCalledWith(
        AnalyticsEvents.DISEASE_DETECTED,
        expect.objectContaining(params)
      );
    });

    it('should add platform and timestamp to events', async () => {
      await analyticsService.initialize();
      
      await analyticsService.logEvent(AnalyticsEvents.SCREEN_VIEW, {
        screen_name: 'HomeScreen',
      });

      expect(analytics().logEvent).toHaveBeenCalledWith(
        AnalyticsEvents.SCREEN_VIEW,
        expect.objectContaining({
          screen_name: 'HomeScreen',
          platform: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('logScreenView', () => {
    it('should log screen view', async () => {
      await analyticsService.initialize();
      
      await analyticsService.logScreenView('HomeScreen', 'HomeScreenClass');

      expect(analytics().logScreenView).toHaveBeenCalledWith({
        screen_name: 'HomeScreen',
        screen_class: 'HomeScreenClass',
      });
    });

    it('should use screen name as class if not provided', async () => {
      await analyticsService.initialize();
      
      await analyticsService.logScreenView('HomeScreen');

      expect(analytics().logScreenView).toHaveBeenCalledWith({
        screen_name: 'HomeScreen',
        screen_class: 'HomeScreen',
      });
    });
  });

  describe('setUserId', () => {
    it('should set user ID', async () => {
      await analyticsService.initialize();
      
      await analyticsService.setUserId('user123');

      expect(analytics().setUserId).toHaveBeenCalledWith('user123');
    });
  });

  describe('setUserProperty', () => {
    it('should set user property', async () => {
      await analyticsService.initialize();
      
      await analyticsService.setUserProperty('language', 'hi');

      expect(analytics().setUserProperty).toHaveBeenCalledWith('language', 'hi');
    });
  });

  describe('setUserProperties', () => {
    it('should set multiple user properties', async () => {
      await analyticsService.initialize();
      
      const properties = {
        language: 'hi',
        farm_size: '2.5',
        soil_type: 'Black',
      };

      await analyticsService.setUserProperties(properties);

      expect(analytics().setUserProperty).toHaveBeenCalledTimes(3);
      expect(analytics().setUserProperty).toHaveBeenCalledWith('language', 'hi');
      expect(analytics().setUserProperty).toHaveBeenCalledWith('farm_size', '2.5');
      expect(analytics().setUserProperty).toHaveBeenCalledWith('soil_type', 'Black');
    });
  });

  describe('logDiseaseDetection', () => {
    it('should log disease detection event', async () => {
      await analyticsService.initialize();
      
      const params = {
        disease_name: 'Tomato Late Blight',
        confidence: 0.95,
        severity: 'Moderate',
        crop_type: 'Tomato',
        detection_time_ms: 1500,
      };

      await analyticsService.logDiseaseDetection(params);

      expect(analytics().logEvent).toHaveBeenCalledWith(
        AnalyticsEvents.DISEASE_DETECTED,
        expect.objectContaining(params)
      );
    });
  });

  describe('logCropRecommendation', () => {
    it('should log crop recommendation event', async () => {
      await analyticsService.initialize();
      
      const params = {
        recommended_crops: ['Tomato', 'Onion', 'Cotton'],
        top_crop: 'Tomato',
        confidence: 0.89,
        farm_size: 2.5,
        soil_type: 'Black',
      };

      await analyticsService.logCropRecommendation(params);

      expect(analytics().logEvent).toHaveBeenCalledWith(
        AnalyticsEvents.CROP_RECOMMENDED,
        expect.objectContaining(params)
      );
    });
  });

  describe('logSync', () => {
    it('should log sync started event', async () => {
      await analyticsService.initialize();
      
      await analyticsService.logSync({ status: 'started' });

      expect(analytics().logEvent).toHaveBeenCalledWith(
        AnalyticsEvents.SYNC_STARTED,
        expect.objectContaining({ status: 'started' })
      );
    });

    it('should log sync completed event', async () => {
      await analyticsService.initialize();
      
      await analyticsService.logSync({
        status: 'completed',
        items_synced: 10,
        duration_ms: 5000,
      });

      expect(analytics().logEvent).toHaveBeenCalledWith(
        AnalyticsEvents.SYNC_COMPLETED,
        expect.objectContaining({
          status: 'completed',
          items_synced: 10,
          duration_ms: 5000,
        })
      );
    });

    it('should log sync failed event', async () => {
      await analyticsService.initialize();
      
      await analyticsService.logSync({
        status: 'failed',
        error_message: 'Network error',
      });

      expect(analytics().logEvent).toHaveBeenCalledWith(
        AnalyticsEvents.SYNC_FAILED,
        expect.objectContaining({
          status: 'failed',
          error_message: 'Network error',
        })
      );
    });
  });

  describe('logError', () => {
    it('should log error event', async () => {
      await analyticsService.initialize();
      
      const params = {
        error_type: 'API_ERROR',
        error_message: 'Failed to fetch data',
        screen_name: 'HomeScreen',
      };

      await analyticsService.logError(params);

      expect(analytics().logEvent).toHaveBeenCalledWith(
        AnalyticsEvents.ERROR_OCCURRED,
        expect.objectContaining(params)
      );
    });
  });

  describe('logSessionStart', () => {
    it('should log session start event', async () => {
      await analyticsService.initialize();
      
      await analyticsService.logSessionStart();

      expect(analytics().logEvent).toHaveBeenCalledWith(
        AnalyticsEvents.SESSION_START,
        expect.objectContaining({
          session_start_time: expect.any(String),
        })
      );
    });
  });

  describe('logSessionEnd', () => {
    it('should log session end event with duration', async () => {
      await analyticsService.initialize();
      
      await analyticsService.logSessionEnd(300000); // 5 minutes

      expect(analytics().logEvent).toHaveBeenCalledWith(
        AnalyticsEvents.SESSION_END,
        expect.objectContaining({
          session_duration_ms: 300000,
          session_end_time: expect.any(String),
        })
      );
    });
  });
});
