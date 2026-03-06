import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface HourlyForecast {
  time: string;
  temperature: number;
  rainfall: number;
  humidity: number;
  windSpeed: number;
}

export interface DailyForecast {
  date: string;
  tempMin: number;
  tempMax: number;
  rainfall: number;
  humidity: number;
  windSpeed: number;
  hourly: HourlyForecast[];
}

export interface WeatherAlert {
  id: string;
  type: 'HEAVY_RAINFALL' | 'EXTREME_HEAT' | 'FROST' | 'HIGH_WIND' | 'HAIL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: string;
}

export interface IrrigationRecommendation {
  date: string;
  shouldIrrigate: boolean;
  amountMm: number;
  timing: 'morning' | 'evening';
  reason: string;
  waterSavedMm: number;
  etc: number;
  effectiveRainfall: number;
}

export interface WeatherState {
  forecasts: DailyForecast[];
  forecastsLastUpdated: string | null;
  alerts: WeatherAlert[];
  irrigationRecommendations: IrrigationRecommendation[];
  irrigationLastUpdated: string | null;
  totalWaterSavedMm: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: WeatherState = {
  forecasts: [],
  forecastsLastUpdated: null,
  alerts: [],
  irrigationRecommendations: [],
  irrigationLastUpdated: null,
  totalWaterSavedMm: 0,
  isLoading: false,
  error: null,
};

const weatherSlice = createSlice({
  name: 'weather',
  initialState,
  reducers: {
    // Fetch weather forecasts
    fetchForecastsRequest: state => {
      state.isLoading = true;
      state.error = null;
    },
    fetchForecastsSuccess: (state, action: PayloadAction<DailyForecast[]>) => {
      state.forecasts = action.payload;
      state.forecastsLastUpdated = new Date().toISOString();
      state.isLoading = false;
      state.error = null;
    },
    fetchForecastsFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // Weather alerts
    addWeatherAlert: (state, action: PayloadAction<WeatherAlert>) => {
      state.alerts.unshift(action.payload);
      // Keep only last 10 alerts
      if (state.alerts.length > 10) {
        state.alerts = state.alerts.slice(0, 10);
      }
    },
    clearWeatherAlerts: state => {
      state.alerts = [];
    },

    // Irrigation recommendations
    fetchIrrigationRequest: state => {
      state.isLoading = true;
      state.error = null;
    },
    fetchIrrigationSuccess: (
      state,
      action: PayloadAction<IrrigationRecommendation[]>,
    ) => {
      state.irrigationRecommendations = action.payload;
      state.irrigationLastUpdated = new Date().toISOString();
      // Calculate total water saved
      state.totalWaterSavedMm = action.payload.reduce(
        (sum, rec) => sum + rec.waterSavedMm,
        0,
      );
      state.isLoading = false;
      state.error = null;
    },
    fetchIrrigationFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // Clear error
    clearError: state => {
      state.error = null;
    },
  },
});

export const {
  fetchForecastsRequest,
  fetchForecastsSuccess,
  fetchForecastsFailure,
  addWeatherAlert,
  clearWeatherAlerts,
  fetchIrrigationRequest,
  fetchIrrigationSuccess,
  fetchIrrigationFailure,
  clearError,
} = weatherSlice.actions;

export default weatherSlice.reducer;
