import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  userId: string | null;
  phone: string | null;
  name: string | null;
  language: string;
  lastActive: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  token: null,
  userId: null,
  phone: null,
  name: null,
  language: 'hi',
  lastActive: null,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Login actions
    loginRequest: state => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (
      state,
      action: PayloadAction<{
        token: string;
        userId: string;
        phone: string;
        name?: string;
        language?: string;
      }>,
    ) => {
      state.isAuthenticated = true;
      state.token = action.payload.token;
      state.userId = action.payload.userId;
      state.phone = action.payload.phone;
      state.name = action.payload.name || null;
      state.language = action.payload.language || 'hi';
      state.lastActive = new Date().toISOString();
      state.isLoading = false;
      state.error = null;
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // Logout actions
    logout: state => {
      state.isAuthenticated = false;
      state.token = null;
      state.userId = null;
      state.phone = null;
      state.name = null;
      state.lastActive = null;
      state.error = null;
    },

    // Update profile
    updateProfile: (
      state,
      action: PayloadAction<{name?: string; language?: string}>,
    ) => {
      if (action.payload.name) {
        state.name = action.payload.name;
      }
      if (action.payload.language) {
        state.language = action.payload.language;
      }
    },

    // Update last active
    updateLastActive: state => {
      state.lastActive = new Date().toISOString();
    },

    // Clear error
    clearError: state => {
      state.error = null;
    },
  },
});

export const {
  loginRequest,
  loginSuccess,
  loginFailure,
  logout,
  updateProfile,
  updateLastActive,
  clearError,
} = authSlice.actions;

export default authSlice.reducer;
