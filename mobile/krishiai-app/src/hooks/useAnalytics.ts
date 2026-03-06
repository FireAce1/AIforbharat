import { useEffect, useRef } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import analyticsService from '../services/analytics';

/**
 * Hook to automatically track screen views
 */
export const useScreenTracking = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const routeNameRef = useRef<string>();

  useEffect(() => {
    const currentRouteName = route.name;

    if (routeNameRef.current !== currentRouteName) {
      // Log screen view
      analyticsService.logScreenView(currentRouteName);
      routeNameRef.current = currentRouteName;
    }
  }, [route.name]);
};

/**
 * Hook to track feature usage with timing
 */
export const useFeatureTracking = (featureName: string) => {
  const startTimeRef = useRef<number>();

  useEffect(() => {
    // Feature accessed
    startTimeRef.current = Date.now();
    analyticsService.logFeatureUsage({
      feature_name: featureName,
      action: 'accessed',
    });

    return () => {
      // Feature exited
      if (startTimeRef.current) {
        const duration = Date.now() - startTimeRef.current;
        analyticsService.logFeatureUsage({
          feature_name: featureName,
          action: 'exited',
          duration_ms: duration,
        });
      }
    };
  }, [featureName]);
};

/**
 * Hook to track button clicks
 */
export const useButtonTracking = () => {
  const route = useRoute();

  const trackButtonClick = (buttonName: string, context?: string) => {
    analyticsService.logButtonClick({
      button_name: buttonName,
      screen_name: route.name,
      context,
    });
  };

  return { trackButtonClick };
};

/**
 * Hook to track session duration
 */
export const useSessionTracking = () => {
  const sessionStartRef = useRef<number>();

  useEffect(() => {
    // Session started
    sessionStartRef.current = Date.now();
    analyticsService.logSessionStart();

    return () => {
      // Session ended
      if (sessionStartRef.current) {
        const duration = Date.now() - sessionStartRef.current;
        analyticsService.logSessionEnd(duration);
      }
    };
  }, []);
};
