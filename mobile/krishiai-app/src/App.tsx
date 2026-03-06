/**
 * KrishiAI Mobile Application
 * Main App Component with Navigation
 */

import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import Config from 'react-native-config';
import {store, persistor} from './store';
import './i18n'; // Initialize i18n
import AppNavigator from './navigation/AppNavigator';
import {linking} from './navigation/linking';
import {initializeNetworkMonitor, stopNetworkMonitor} from './services/networkMonitor';
import {initializeSentry, trackScreen} from './utils/sentry';

// Initialize Sentry before app starts
initializeSentry({
  dsn: Config.SENTRY_DSN || '',
  environment: Config.ENVIRONMENT || 'development',
  enableInExpoDevelopment: false,
  debug: __DEV__,
});

const App = (): React.JSX.Element => {
  useEffect(() => {
    // Initialize network monitor for auto-sync on WiFi
    const networkMonitor = initializeNetworkMonitor();
    console.log('Network monitor initialized');

    // Cleanup on unmount
    return () => {
      stopNetworkMonitor();
      console.log('Network monitor stopped');
    };
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <NavigationContainer 
          linking={linking}
          onStateChange={(state) => {
            // Track screen navigation in Sentry
            const currentRoute = state?.routes[state.index];
            if (currentRoute) {
              trackScreen(currentRoute.name, currentRoute.params);
            }
          }}
        >
          <StatusBar
            barStyle="light-content"
            backgroundColor="#2E7D32"
          />
          <AppNavigator />
        </NavigationContainer>
      </PersistGate>
    </Provider>
  );
};

export default App;
