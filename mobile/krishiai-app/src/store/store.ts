import {configureStore, combineReducers} from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import reducers
import authReducer from './slices/authSlice';
import farmReducer from './slices/farmSlice';
import cropReducer from './slices/cropSlice';
import marketReducer from './slices/marketSlice';
import weatherReducer from './slices/weatherSlice';
import syncReducer from './slices/syncSlice';

// Import root saga
import {rootSaga} from './sagas';

// Combine all reducers
const rootReducer = combineReducers({
  auth: authReducer,
  farm: farmReducer,
  crop: cropReducer,
  market: marketReducer,
  weather: weatherReducer,
  sync: syncReducer,
});

// Persist configuration
const persistConfig = {
  key: 'root',
  version: 1,
  storage: AsyncStorage,
  // Whitelist: specify which reducers to persist
  whitelist: ['auth', 'farm', 'crop', 'market', 'weather', 'sync'],
  // Blacklist: specify which reducers NOT to persist (if needed)
  // blacklist: [],
};

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Create saga middleware
const sagaMiddleware = createSagaMiddleware();

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      // Redux-persist requires these actions to be non-serializable
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(sagaMiddleware),
  devTools: __DEV__, // Enable Redux DevTools in development
});

// Run root saga
sagaMiddleware.run(rootSaga);

// Create persistor
export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
