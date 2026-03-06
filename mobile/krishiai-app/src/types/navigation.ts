/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import type {NativeStackScreenProps} from '@react-navigation/native-stack';

// Auth Stack Parameter List
export type AuthStackParamList = {
  PhoneInput: undefined;
  OTPVerification: {phone: string};
  LanguageSelection: undefined;
  FarmProfile: undefined;
  Main: undefined; // Allow navigation to Main from auth flow
};

// Main Tab Parameter List
export type MainTabParamList = {
  Home: undefined;
  DiseaseDetection: undefined;
  CropRecommendation: undefined;
  CropDetail: {recommendation: CropRecommendation};
  Market: undefined;
  Weather: undefined;
  WaterAdvisory: undefined;
  Schemes: undefined;
  SchemeDetail: {scheme: any}; // CachedScheme type
  Chatbot: undefined;
  Settings: undefined;
};

// Crop Recommendation Type
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

// Root Stack Parameter List
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// Screen Props Types
export type PhoneInputScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'PhoneInput'
>;

export type OTPVerificationScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'OTPVerification'
>;

export type LanguageSelectionScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'LanguageSelection'
>;

export type FarmProfileScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'FarmProfile'
>;
