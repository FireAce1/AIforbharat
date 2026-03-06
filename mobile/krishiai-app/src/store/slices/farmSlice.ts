import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface Farm {
  id: string;
  userId: string;
  location: {
    latitude: number;
    longitude: number;
  };
  sizeHectares: number;
  soilType: string;
  irrigationType: string;
  selectedCrop?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FarmState {
  farms: Farm[];
  selectedFarmId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: FarmState = {
  farms: [],
  selectedFarmId: null,
  isLoading: false,
  error: null,
};

const farmSlice = createSlice({
  name: 'farm',
  initialState,
  reducers: {
    // Fetch farms
    fetchFarmsRequest: state => {
      state.isLoading = true;
      state.error = null;
    },
    fetchFarmsSuccess: (state, action: PayloadAction<Farm[]>) => {
      state.farms = action.payload;
      state.isLoading = false;
      state.error = null;
      // Auto-select first farm if none selected
      if (!state.selectedFarmId && action.payload.length > 0) {
        state.selectedFarmId = action.payload[0].id;
      }
    },
    fetchFarmsFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // Add farm
    addFarmRequest: state => {
      state.isLoading = true;
      state.error = null;
    },
    addFarmSuccess: (state, action: PayloadAction<Farm>) => {
      state.farms.push(action.payload);
      // Auto-select if first farm
      if (state.farms.length === 1) {
        state.selectedFarmId = action.payload.id;
      }
      state.isLoading = false;
      state.error = null;
    },
    addFarmFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // Update farm
    updateFarmRequest: state => {
      state.isLoading = true;
      state.error = null;
    },
    updateFarmSuccess: (state, action: PayloadAction<Farm>) => {
      const index = state.farms.findIndex(f => f.id === action.payload.id);
      if (index !== -1) {
        state.farms[index] = action.payload;
      }
      state.isLoading = false;
      state.error = null;
    },
    updateFarmFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // Select farm
    selectFarm: (state, action: PayloadAction<string>) => {
      state.selectedFarmId = action.payload;
    },

    // Clear error
    clearError: state => {
      state.error = null;
    },
  },
});

export const {
  fetchFarmsRequest,
  fetchFarmsSuccess,
  fetchFarmsFailure,
  addFarmRequest,
  addFarmSuccess,
  addFarmFailure,
  updateFarmRequest,
  updateFarmSuccess,
  updateFarmFailure,
  selectFarm,
  clearError,
} = farmSlice.actions;

export default farmSlice.reducer;
