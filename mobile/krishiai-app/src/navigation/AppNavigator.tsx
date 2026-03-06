/**
 * App Navigator
 * Main navigation structure with AuthStack and MainTabs
 * Validates: Requirements 1.1-3.6
 */

import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useSelector} from 'react-redux';
import type {RootState} from '../store';
import type {AuthStackParamList, MainTabParamList, RootStackParamList} from '../types/navigation';

// Auth Screens
import PhoneInputScreen from '../screens/PhoneInputScreen';
import OTPVerificationScreen from '../screens/OTPVerificationScreen';
import LanguageSelectionScreen from '../screens/LanguageSelectionScreen';
import FarmProfileScreen from '../screens/FarmProfileScreen';

// Main Screens - Lazy loaded to reduce initial bundle size
import {
  LazyHomeScreen,
  LazyDiseaseDetectionScreen,
  LazyCropRecommendationScreen,
  LazyCropDetailScreen,
  LazyMarketPricesScreen,
  LazyWeatherForecastScreen,
  LazyWaterAdvisoryScreen,
  LazySchemesScreen,
  LazySchemeDetailScreen,
  LazyChatbotScreen,
  LazySettingsScreen,
  withSuspense,
} from './LazyScreens';

// Wrap lazy screens with Suspense
const HomeScreen = withSuspense(LazyHomeScreen);
const DiseaseDetectionScreen = withSuspense(LazyDiseaseDetectionScreen);
const CropRecommendationScreen = withSuspense(LazyCropRecommendationScreen);
const CropDetailScreen = withSuspense(LazyCropDetailScreen);
const MarketPricesScreen = withSuspense(LazyMarketPricesScreen);
const WeatherForecastScreen = withSuspense(LazyWeatherForecastScreen);
const WaterAdvisoryScreen = withSuspense(LazyWaterAdvisoryScreen);
const SchemesScreen = withSuspense(LazySchemesScreen);
const SchemeDetailScreen = withSuspense(LazySchemeDetailScreen);
const ChatbotScreen = withSuspense(LazyChatbotScreen);
const SettingsScreen = withSuspense(LazySettingsScreen);

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth Stack Navigator
 * Handles onboarding flow: Phone → OTP → Language → Farm Profile
 */
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <AuthStack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <AuthStack.Screen name="OTPVerification" component={OTPVerificationScreen} />
      <AuthStack.Screen name="LanguageSelection" component={LanguageSelectionScreen} />
      <AuthStack.Screen name="FarmProfile" component={FarmProfileScreen} />
    </AuthStack.Navigator>
  );
};

/**
 * Main Tab Navigator
 * Bottom tab navigation for main app features
 */
const MainNavigator = () => {
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#2E7D32',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarActiveTintColor: '#2E7D32',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
      <MainTab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: () => null, // Icons will be added in future task
        }}
      />
      <MainTab.Screen
        name="DiseaseDetection"
        component={DiseaseDetectionScreen}
        options={{
          title: 'Disease Detection',
          tabBarLabel: 'Disease',
          tabBarIcon: () => null,
        }}
      />
      <MainTab.Screen
        name="CropRecommendation"
        component={CropRecommendationScreen}
        options={{
          title: 'Crop Recommendation',
          tabBarLabel: 'Crops',
          tabBarIcon: () => null,
        }}
      />
      <MainTab.Screen
        name="CropDetail"
        component={CropDetailScreen}
        options={{
          title: 'Crop Details',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <MainTab.Screen
        name="Market"
        component={MarketPricesScreen}
        options={{
          title: 'Market Prices',
          tabBarLabel: 'Market',
          tabBarIcon: () => null,
        }}
      />
      <MainTab.Screen
        name="Weather"
        component={WeatherForecastScreen}
        options={{
          title: 'Weather',
          tabBarLabel: 'Weather',
          tabBarIcon: () => null,
        }}
      />
      <MainTab.Screen
        name="WaterAdvisory"
        component={WaterAdvisoryScreen}
        options={{
          title: 'Water Advisory',
          tabBarButton: () => null, // Hide from tab bar, accessible from Weather screen
        }}
      />
      <MainTab.Screen
        name="Schemes"
        component={SchemesScreen}
        options={{
          title: 'Government Schemes',
          tabBarLabel: 'Schemes',
          tabBarIcon: () => null,
        }}
      />
      <MainTab.Screen
        name="SchemeDetail"
        component={SchemeDetailScreen}
        options={{
          title: 'Scheme Details',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <MainTab.Screen
        name="Chatbot"
        component={ChatbotScreen}
        options={{
          title: 'Chatbot',
          tabBarLabel: 'Chat',
          tabBarIcon: () => null,
        }}
      />
      <MainTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: () => null,
        }}
      />
    </MainTab.Navigator>
  );
};

/**
 * Root Navigator
 * Conditional navigation based on authentication state
 */
const AppNavigator = () => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  return (
    <RootStack.Navigator screenOptions={{headerShown: false}}>
      {!isAuthenticated ? (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <RootStack.Screen name="Main" component={MainNavigator} />
      )}
    </RootStack.Navigator>
  );
};

export default AppNavigator;
