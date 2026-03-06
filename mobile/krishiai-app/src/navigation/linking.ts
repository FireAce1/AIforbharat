/**
 * Deep Linking Configuration
 * Handles deep links and notifications
 * Validates: Requirements 1.1-3.6
 */

import type {LinkingOptions} from '@react-navigation/native';
import type {RootStackParamList} from '../types/navigation';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['krishiai://', 'https://krishiai.app'],
  config: {
    screens: {
      Auth: {
        screens: {
          PhoneInput: 'auth/phone',
          OTPVerification: 'auth/otp',
          LanguageSelection: 'auth/language',
          FarmProfile: 'auth/farm-profile',
        },
      },
      Main: {
        screens: {
          Home: 'home',
          DiseaseDetection: 'disease-detection',
          CropRecommendation: 'crop-recommendation',
          Market: 'market',
          Weather: 'weather',
          Schemes: 'schemes',
          Chatbot: 'chatbot',
          Settings: 'settings',
        },
      },
    },
  },
};
