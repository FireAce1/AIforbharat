// Export store and persistor
export {store, persistor} from './store';
export type {RootState, AppDispatch} from './store';

// Export typed hooks
export {useAppDispatch, useAppSelector} from './hooks';

// Export slice actions individually to avoid naming conflicts
import * as authSliceExports from './slices/authSlice';
import * as farmSliceExports from './slices/farmSlice';
import * as cropSliceExports from './slices/cropSlice';
import * as marketSliceExports from './slices/marketSlice';
import * as weatherSliceExports from './slices/weatherSlice';
import * as syncSliceExports from './slices/syncSlice';

export const authActions = authSliceExports;
export const farmActions = farmSliceExports;
export const cropActions = cropSliceExports;
export const marketActions = marketSliceExports;
export const weatherActions = weatherSliceExports;
export const syncActions = syncSliceExports;

// Export types
export type {AuthState} from './slices/authSlice';
export type {Farm, FarmState} from './slices/farmSlice';
export type {
  Crop,
  CropRecommendation,
  DiseaseDetection,
  CropState,
} from './slices/cropSlice';
export type {MarketPrice, PriceForecast, MarketState} from './slices/marketSlice';
export type {
  HourlyForecast,
  DailyForecast,
  WeatherAlert,
  IrrigationRecommendation,
  WeatherState,
} from './slices/weatherSlice';
export type {SyncQueueItem, SyncState} from './slices/syncSlice';
