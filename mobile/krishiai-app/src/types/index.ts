/**
 * Type definitions for KrishiAI Mobile App
 */

// User types
export interface User {
  id: string;
  phone: string;
  name?: string;
  language: 'hi' | 'mr' | 'en';
  createdAt: string;
  lastActive: string;
}

// Farm types
export interface Farm {
  id: string;
  userId: string;
  location: {
    latitude: number;
    longitude: number;
  };
  sizeHectares: number;
  soilType: 'Alluvial' | 'Black' | 'Red' | 'Laterite' | 'Desert' | 'Mountain';
  irrigationType: 'Rainfed' | 'Borewell' | 'Canal' | 'Drip' | 'Sprinkler';
  createdAt: string;
}

// Crop types
export interface Crop {
  id: string;
  farmId: string;
  cropName: string;
  variety?: string;
  sowingDate: string;
  expectedHarvestDate: string;
  status: 'planned' | 'sown' | 'growing' | 'harvested';
}

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Auth: undefined;
  Main: undefined;
};

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Sync Queue types
export interface SyncQueueItem {
  id: string;
  action: string;
  payload: any;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: number;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED';
}
