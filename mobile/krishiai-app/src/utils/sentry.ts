import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import Config from 'react-native-config';

interface SentryConfig {
  dsn: string;
  environment: string;
  enableInExpoDevelopment?: boolean;
  debug?: boolean;
}

/**
 * Initialize Sentry for React Native error tracking
 */
export const initializeSentry = (config: SentryConfig): void => {
  if (!config.dsn) {
    console.warn('Sentry DSN not provided. Error tracking disabled.');
    return;
  }

  // Don't initialize in development unless explicitly enabled
  if (__DEV__ && !config.enableInExpoDevelopment) {
    console.log('Sentry disabled in development mode');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment || 'development',
    
    // Performance monitoring
    tracesSampleRate: config.environment === 'production' ? 0.1 : 1.0,
    
    // Enable automatic session tracking
    enableAutoSessionTracking: true,
    
    // Session timeout (30 minutes)
    sessionTrackingIntervalMillis: 30000,
    
    // Enable native crash reporting
    enableNative: true,
    enableNativeCrashHandling: true,
    
    // Enable automatic breadcrumbs
    enableAutoPerformanceTracing: true,
    
    // Debug mode
    debug: config.debug || __DEV__,
    
    // Add device context
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      // Remove sensitive query parameters
      if (event.request?.query_string) {
        const sensitiveParams = ['password', 'token', 'api_key', 'otp', 'phone'];
        sensitiveParams.forEach(param => {
          if (event.request?.query_string?.includes(param)) {
            event.request.query_string = event.request.query_string.replace(
              new RegExp(`${param}=[^&]*`, 'gi'),
              `${param}=***REDACTED***`
            );
          }
        });
      }
      
      return event;
    },
    
    // Add platform-specific tags
    initialScope: {
      tags: {
        platform: Platform.OS,
        platform_version: Platform.Version.toString(),
      },
    },
  });

  console.log(`Sentry initialized for ${Platform.OS} in ${config.environment} environment`);
};

/**
 * Capture exception with additional context
 */
export const captureException = (
  error: Error,
  context?: {
    userId?: string;
    screen?: string;
    action?: string;
    [key: string]: any;
  }
): string => {
  Sentry.withScope((scope) => {
    if (context) {
      // Add user context
      if (context.userId) {
        scope.setUser({ id: context.userId });
      }
      
      // Add tags
      if (context.screen) {
        scope.setTag('screen', context.screen);
      }
      if (context.action) {
        scope.setTag('action', context.action);
      }
      
      // Add extra context
      const { userId, screen, action, ...extraContext } = context;
      if (Object.keys(extraContext).length > 0) {
        scope.setContext('additional', sanitizeContext(extraContext));
      }
    }
    
    Sentry.captureException(error);
  });
  
  return Sentry.lastEventId() || '';
};

/**
 * Add breadcrumb for debugging
 */
export const addBreadcrumb = (
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, any>
): void => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data: data ? sanitizeContext(data) : undefined,
    timestamp: Date.now() / 1000,
  });
};

/**
 * Capture message with context
 */
export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
): string => {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('message_context', sanitizeContext(context));
    }
    Sentry.captureMessage(message, level);
  });
  
  return Sentry.lastEventId() || '';
};

/**
 * Set user context
 */
export const setUser = (user: {
  id: string;
  phone?: string;
  language?: string;
}): void => {
  Sentry.setUser({
    id: user.id,
    // Redact phone number for privacy
    phone: user.phone ? '***REDACTED***' : undefined,
    language: user.language,
  });
};

/**
 * Clear user context (on logout)
 */
export const clearUser = (): void => {
  Sentry.setUser(null);
};

/**
 * Set custom tag
 */
export const setTag = (key: string, value: string): void => {
  Sentry.setTag(key, value);
};

/**
 * Set custom context
 */
export const setContext = (name: string, context: Record<string, any>): void => {
  Sentry.setContext(name, sanitizeContext(context));
};

/**
 * Track screen navigation
 */
export const trackScreen = (screenName: string, params?: Record<string, any>): void => {
  addBreadcrumb(
    `Navigated to ${screenName}`,
    'navigation',
    'info',
    params ? { screen: screenName, params } : { screen: screenName }
  );
  
  setTag('current_screen', screenName);
};

/**
 * Track crash rate
 */
export const trackCrash = (crashed: boolean): void => {
  setTag('crash_occurred', crashed ? 'yes' : 'no');
  
  if (crashed) {
    captureMessage('Application crash detected', 'fatal');
  }
};

/**
 * Flush Sentry events (useful before app close)
 */
export const flushSentry = async (timeout: number = 2000): Promise<boolean> => {
  try {
    await Sentry.flush(timeout);
    return true;
  } catch (error) {
    console.error('Failed to flush Sentry events:', error);
    return false;
  }
};

/**
 * Sanitize context to remove sensitive information
 */
const sanitizeContext = (context: any): any => {
  if (!context || typeof context !== 'object') {
    return context;
  }
  
  const sensitiveFields = [
    'password',
    'token',
    'api_key',
    'apiKey',
    'secret',
    'otp',
    'phone',
    'email',
    'authorization',
    'cookie',
  ];
  
  const sanitized = Array.isArray(context) ? [...context] : { ...context };
  
  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeContext(sanitized[key]);
    }
  }
  
  return sanitized;
};

/**
 * Wrap async function with error tracking
 */
export const withErrorTracking = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: { screen?: string; action?: string }
): T => {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error as Error, context);
      throw error;
    }
  }) as T;
};

export { Sentry };
