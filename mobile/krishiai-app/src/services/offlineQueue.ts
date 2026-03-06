import {store} from '../store';
import {addToSyncQueue} from '../store/slices/syncSlice';

export interface OfflineRequestPayload {
  method: string;
  url: string;
  data?: any;
  headers?: Record<string, string>;
}

export type RequestPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Queue a failed request for offline sync
 * This function can be called from anywhere in the app to queue requests
 * that failed due to network issues
 */
export function queueOfflineRequest(
  action: string,
  payload: OfflineRequestPayload,
  priority?: RequestPriority,
): void {
  // Determine priority based on endpoint if not provided
  let determinedPriority: RequestPriority = priority || 'MEDIUM';

  if (!priority) {
    if (payload.url.includes('/auth/')) {
      determinedPriority = 'CRITICAL';
    } else if (
      payload.url.includes('/disease/detect') ||
      payload.url.includes('/crop/recommend')
    ) {
      determinedPriority = 'HIGH';
    } else if (
      payload.url.includes('/farm') ||
      payload.url.includes('/crop')
    ) {
      determinedPriority = 'MEDIUM';
    } else {
      determinedPriority = 'LOW';
    }
  }

  store.dispatch(
    addToSyncQueue({
      action,
      payload,
      priority: determinedPriority,
    }),
  );
}

/**
 * Queue a disease detection request
 */
export function queueDiseaseDetection(
  imageData: string,
  cropId: string,
  location?: {latitude: number; longitude: number},
): void {
  queueOfflineRequest(
    'DISEASE_DETECTION',
    {
      method: 'POST',
      url: '/api/v1/crop/disease/detect',
      data: {
        image: imageData,
        cropId,
        location,
      },
    },
    'HIGH',
  );
}

/**
 * Queue a crop recommendation request
 */
export function queueCropRecommendation(farmId: string): void {
  queueOfflineRequest(
    'CROP_RECOMMENDATION',
    {
      method: 'POST',
      url: '/api/v1/crop/recommend',
      data: {
        farmId,
      },
    },
    'HIGH',
  );
}

/**
 * Queue a farm update request
 */
export function queueFarmUpdate(
  farmId: string,
  updates: Record<string, any>,
): void {
  queueOfflineRequest(
    'FARM_UPDATE',
    {
      method: 'PUT',
      url: `/api/v1/farm/${farmId}`,
      data: updates,
    },
    'MEDIUM',
  );
}

/**
 * Queue a crop creation request
 */
export function queueCropCreation(farmId: string, cropData: any): void {
  queueOfflineRequest(
    'CROP_CREATE',
    {
      method: 'POST',
      url: '/api/v1/crop',
      data: {
        farmId,
        ...cropData,
      },
    },
    'MEDIUM',
  );
}

/**
 * Queue a user profile update request
 */
export function queueProfileUpdate(userId: string, updates: any): void {
  queueOfflineRequest(
    'PROFILE_UPDATE',
    {
      method: 'PUT',
      url: `/api/v1/user/${userId}`,
      data: updates,
    },
    'LOW',
  );
}
