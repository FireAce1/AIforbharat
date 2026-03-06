import React, { Suspense, lazy } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Loading fallback component
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#4CAF50" />
  </View>
);

// Lazy load screens to reduce initial bundle size
export const LazyHomeScreen = lazy(() => import('../screens/HomeScreen'));
export const LazyCropRecommendationScreen = lazy(() => import('../screens/CropRecommendationScreen'));
export const LazyCropDetailScreen = lazy(() => import('../screens/CropDetailScreen'));
export const LazyMarketPricesScreen = lazy(() => import('../screens/MarketPricesScreen'));
export const LazyWeatherForecastScreen = lazy(() => import('../screens/WeatherForecastScreen'));
export const LazyWaterAdvisoryScreen = lazy(() => import('../screens/WaterAdvisoryScreen'));
export const LazySchemesScreen = lazy(() => import('../screens/SchemesScreen'));
export const LazySchemeDetailScreen = lazy(() => import('../screens/SchemeDetailScreen'));
export const LazyChatbotScreen = lazy(() => import('../screens/ChatbotScreen'));
export const LazyDiseaseDetectionScreen = lazy(() => import('../screens/DiseaseDetectionScreen'));
export const LazySettingsScreen = lazy(() => import('../screens/SettingsScreen'));

// HOC to wrap lazy screens with Suspense
export const withSuspense = (Component: React.LazyExoticComponent<any>) => {
  return (props: any) => (
    <Suspense fallback={<LoadingScreen />}>
      <Component {...props} />
    </Suspense>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
