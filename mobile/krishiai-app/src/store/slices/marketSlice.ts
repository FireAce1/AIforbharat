import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface MarketPrice {
  cropName: string;
  marketName: string;
  location: {
    latitude: number;
    longitude: number;
  };
  pricePerKg: number;
  quantityTraded: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  timestamp: string;
}

export interface PriceForecast {
  cropName: string;
  forecasts: {
    date: string;
    predictedPrice: number;
    confidence: number;
  }[];
  period: '7day' | '30day' | '90day';
}

export interface MarketState {
  prices: MarketPrice[];
  pricesLastUpdated: string | null;
  forecasts: PriceForecast[];
  forecastsLastUpdated: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: MarketState = {
  prices: [],
  pricesLastUpdated: null,
  forecasts: [],
  forecastsLastUpdated: null,
  isLoading: false,
  error: null,
};

const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {
    // Fetch market prices
    fetchPricesRequest: state => {
      state.isLoading = true;
      state.error = null;
    },
    fetchPricesSuccess: (state, action: PayloadAction<MarketPrice[]>) => {
      state.prices = action.payload;
      state.pricesLastUpdated = new Date().toISOString();
      state.isLoading = false;
      state.error = null;
    },
    fetchPricesFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // Fetch price forecasts
    fetchForecastsRequest: state => {
      state.isLoading = true;
      state.error = null;
    },
    fetchForecastsSuccess: (state, action: PayloadAction<PriceForecast[]>) => {
      state.forecasts = action.payload;
      state.forecastsLastUpdated = new Date().toISOString();
      state.isLoading = false;
      state.error = null;
    },
    fetchForecastsFailure: (state, action: PayloadAction<string>) => {
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
  fetchPricesRequest,
  fetchPricesSuccess,
  fetchPricesFailure,
  fetchForecastsRequest,
  fetchForecastsSuccess,
  fetchForecastsFailure,
  clearError,
} = marketSlice.actions;

export default marketSlice.reducer;
