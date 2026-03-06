import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface Crop {
  id: string;
  farmId: string;
  cropName: string;
  variety: string;
  sowingDate: string;
  expectedHarvestDate: string;
  status: 'planned' | 'sown' | 'growing' | 'harvested';
  createdAt: string;
  updatedAt?: string;
}

export interface CropRecommendation {
  crop: string;
  confidence: number;
  expectedYield: number;
  investmentRequired: number;
  expectedRevenue: number;
  waterRequirements: number;
  sowingWindow: {
    start: string;
    end: string;
  };
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface DiseaseDetection {
  id: string;
  cropId: string;
  diseaseName: string;
  diseaseNameLocal: string;
  scientificName: string;
  confidence: number;
  severity: 'Early' | 'Moderate' | 'Severe';
  imageUrl: string;
  treatments: {
    organic: string[];
    chemical: string[];
  };
  detectedAt: string;
}

export interface CropState {
  crops: Crop[];
  recommendations: CropRecommendation[];
  recommendationsLastUpdated: string | null;
  diseaseDetections: DiseaseDetection[];
  isLoading: boolean;
  error: string | null;
}

const initialState: CropState = {
  crops: [],
  recommendations: [],
  recommendationsLastUpdated: null,
  diseaseDetections: [],
  isLoading: false,
  error: null,
};

const cropSlice = createSlice({
  name: 'crop',
  initialState,
  reducers: {
    // Fetch crops
    fetchCropsRequest: state => {
      state.isLoading = true;
      state.error = null;
    },
    fetchCropsSuccess: (state, action: PayloadAction<Crop[]>) => {
      state.crops = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    fetchCropsFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // Add crop
    addCropSuccess: (state, action: PayloadAction<Crop>) => {
      state.crops.push(action.payload);
    },

    // Update crop
    updateCropSuccess: (state, action: PayloadAction<Crop>) => {
      const index = state.crops.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.crops[index] = action.payload;
      }
    },

    // Crop recommendations
    fetchRecommendationsRequest: state => {
      state.isLoading = true;
      state.error = null;
    },
    fetchRecommendationsSuccess: (
      state,
      action: PayloadAction<CropRecommendation[]>,
    ) => {
      state.recommendations = action.payload;
      state.recommendationsLastUpdated = new Date().toISOString();
      state.isLoading = false;
      state.error = null;
    },
    fetchRecommendationsFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // Disease detection
    addDiseaseDetectionRequest: state => {
      state.isLoading = true;
      state.error = null;
    },
    addDiseaseDetectionSuccess: (
      state,
      action: PayloadAction<DiseaseDetection>,
    ) => {
      state.diseaseDetections.unshift(action.payload);
      state.isLoading = false;
      state.error = null;
    },
    addDiseaseDetectionFailure: (state, action: PayloadAction<string>) => {
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
  fetchCropsRequest,
  fetchCropsSuccess,
  fetchCropsFailure,
  addCropSuccess,
  updateCropSuccess,
  fetchRecommendationsRequest,
  fetchRecommendationsSuccess,
  fetchRecommendationsFailure,
  addDiseaseDetectionRequest,
  addDiseaseDetectionSuccess,
  addDiseaseDetectionFailure,
  clearError,
} = cropSlice.actions;

export default cropSlice.reducer;
