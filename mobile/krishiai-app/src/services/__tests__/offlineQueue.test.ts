import {
  queueOfflineRequest,
  queueDiseaseDetection,
  queueCropRecommendation,
  queueFarmUpdate,
  queueCropCreation,
  queueProfileUpdate,
} from '../offlineQueue';
import {store} from '../../store';
import {addToSyncQueue} from '../../store/slices/syncSlice';

// Mock the store
jest.mock('../../store', () => ({
  store: {
    dispatch: jest.fn(),
  },
}));

describe('Offline Queue Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('queueOfflineRequest', () => {
    it('should queue request with specified priority', () => {
      queueOfflineRequest(
        'TEST_ACTION',
        {
          method: 'POST',
          url: '/api/v1/test',
          data: {test: true},
        },
        'HIGH',
      );

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue({
          action: 'TEST_ACTION',
          payload: {
            method: 'POST',
            url: '/api/v1/test',
            data: {test: true},
          },
          priority: 'HIGH',
        }),
      );
    });

    it('should auto-determine CRITICAL priority for auth endpoints', () => {
      queueOfflineRequest('AUTH_REQUEST', {
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        data: {code: '123456'},
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue(
          expect.objectContaining({
            priority: 'CRITICAL',
          }),
        ),
      );
    });

    it('should auto-determine HIGH priority for disease detection', () => {
      queueOfflineRequest('DISEASE_DETECT', {
        method: 'POST',
        url: '/api/v1/crop/disease/detect',
        data: {image: 'base64'},
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue(
          expect.objectContaining({
            priority: 'HIGH',
          }),
        ),
      );
    });

    it('should auto-determine HIGH priority for crop recommendations', () => {
      queueOfflineRequest('CROP_RECOMMEND', {
        method: 'POST',
        url: '/api/v1/crop/recommend',
        data: {farmId: '123'},
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue(
          expect.objectContaining({
            priority: 'HIGH',
          }),
        ),
      );
    });

    it('should auto-determine MEDIUM priority for farm endpoints', () => {
      queueOfflineRequest('FARM_UPDATE', {
        method: 'PUT',
        url: '/api/v1/farm/123',
        data: {name: 'Updated'},
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue(
          expect.objectContaining({
            priority: 'MEDIUM',
          }),
        ),
      );
    });

    it('should auto-determine MEDIUM priority for crop endpoints', () => {
      queueOfflineRequest('CROP_CREATE', {
        method: 'POST',
        url: '/api/v1/crop',
        data: {name: 'Wheat'},
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue(
          expect.objectContaining({
            priority: 'MEDIUM',
          }),
        ),
      );
    });

    it('should default to LOW priority for other endpoints', () => {
      queueOfflineRequest('ANALYTICS', {
        method: 'POST',
        url: '/api/v1/analytics/track',
        data: {event: 'page_view'},
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue(
          expect.objectContaining({
            priority: 'LOW',
          }),
        ),
      );
    });
  });

  describe('queueDiseaseDetection', () => {
    it('should queue disease detection with correct payload', () => {
      queueDiseaseDetection('base64-image-data', 'crop-123', {
        latitude: 19.076,
        longitude: 72.8777,
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue({
          action: 'DISEASE_DETECTION',
          payload: {
            method: 'POST',
            url: '/api/v1/crop/disease/detect',
            data: {
              image: 'base64-image-data',
              cropId: 'crop-123',
              location: {
                latitude: 19.076,
                longitude: 72.8777,
              },
            },
          },
          priority: 'HIGH',
        }),
      );
    });

    it('should queue disease detection without location', () => {
      queueDiseaseDetection('base64-image-data', 'crop-123');

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue(
          expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                image: 'base64-image-data',
                cropId: 'crop-123',
                location: undefined,
              }),
            }),
          }),
        ),
      );
    });
  });

  describe('queueCropRecommendation', () => {
    it('should queue crop recommendation with correct payload', () => {
      queueCropRecommendation('farm-456');

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue({
          action: 'CROP_RECOMMENDATION',
          payload: {
            method: 'POST',
            url: '/api/v1/crop/recommend',
            data: {
              farmId: 'farm-456',
            },
          },
          priority: 'HIGH',
        }),
      );
    });
  });

  describe('queueFarmUpdate', () => {
    it('should queue farm update with correct payload', () => {
      queueFarmUpdate('farm-789', {
        name: 'Updated Farm Name',
        size_hectares: 2.5,
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue({
          action: 'FARM_UPDATE',
          payload: {
            method: 'PUT',
            url: '/api/v1/farm/farm-789',
            data: {
              name: 'Updated Farm Name',
              size_hectares: 2.5,
            },
          },
          priority: 'MEDIUM',
        }),
      );
    });
  });

  describe('queueCropCreation', () => {
    it('should queue crop creation with correct payload', () => {
      queueCropCreation('farm-101', {
        crop_name: 'Wheat',
        variety: 'HD-2967',
        sowing_date: '2024-11-15',
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue({
          action: 'CROP_CREATE',
          payload: {
            method: 'POST',
            url: '/api/v1/crop',
            data: {
              farmId: 'farm-101',
              crop_name: 'Wheat',
              variety: 'HD-2967',
              sowing_date: '2024-11-15',
            },
          },
          priority: 'MEDIUM',
        }),
      );
    });
  });

  describe('queueProfileUpdate', () => {
    it('should queue profile update with correct payload', () => {
      queueProfileUpdate('user-202', {
        name: 'Updated Name',
        language: 'mr',
      });

      expect(store.dispatch).toHaveBeenCalledWith(
        addToSyncQueue({
          action: 'PROFILE_UPDATE',
          payload: {
            method: 'PUT',
            url: '/api/v1/user/user-202',
            data: {
              name: 'Updated Name',
              language: 'mr',
            },
          },
          priority: 'LOW',
        }),
      );
    });
  });
});
