# KrishiAI MVP - Implementation Tasks

## Overview

This implementation plan converts the KrishiAI MVP design into discrete coding tasks that build incrementally toward a complete offline-first, AI-powered agricultural platform. Each task includes property-based testing to ensure universal correctness properties are validated.

## Tasks

### 1. Project Setup & Infrastructure

- [-] 1.1 Initialize monorepo structure and development environment
  - Create root directory with services/, mobile/, ml-models/, infrastructure/ folders
  - Set up Git repository with comprehensive .gitignore for Node.js, Python, React Native
  - Initialize package.json with workspace configuration and development scripts
  - Create docker-compose.yml with PostgreSQL 14+, Redis 7+, TimescaleDB extension
  - Write setup script (setup.sh) to initialize local development environment
  - **Validates: Requirements 17.1-17.6, Design Section 1.2**

- [ ] 1.2 Set up database schema with TimescaleDB
  - Set up database migration tool (node-pg-migrate)
  - Create initial migration: users, otp_codes, farms, crops, disease_detections tables
  - Create TimescaleDB hypertables: market_prices, weather_forecasts with time partitioning
  - Add performance indexes: phone lookup, geospatial queries, time-series queries
  - Configure data retention policies: 5 years for prices, 2 years for weather
  - **Validates: Requirements 17.1-17.6, Design Section 4.1-4.2**

- [ ] 1.3 Configure Redis caching infrastructure
  - Configure Redis connection pooling with 20 max connections
  - Implement cache key naming convention: service:resource:id
  - Set up TTL policies: OTP (5 min), API responses (1 hour), sessions (7 days)
  - Create Redis utility module with get/set/delete/expire helpers
  - **Validates: Requirements 15.1, Design Section 9.1**

- [ ]* 1.4 Write property tests for infrastructure setup
  - **Property 33: Cache Duration Consistency** - Test cache retention periods for different data types
  - **Property 35: ACID Transaction Compliance** - Test database transaction integrity
  - Use fast-check to generate random cache keys and verify TTL enforcement
  - **Validates: Design Properties 33, 35**

### 2. Authentication Service Implementation

- [ ] 2.1 Initialize Auth Service with Node.js and TypeScript
  - Create services/auth-service/ with Express framework
  - Install dependencies: express, jsonwebtoken, bcrypt, redis, pg, joi, winston
  - Set up project structure: routes, controllers, services, middleware
  - Create Dockerfile with multi-stage build for production optimization
  - **Validates: Design Section 2.2.1**

- [ ] 2.2 Implement OTP generation and SMS delivery
  - Create OTPService class with crypto.randomInt(100000, 999999) for 6-digit generation
  - Integrate SMS gateway SDK (Twilio/MSG91) with retry logic and delivery confirmation
  - Implement rate limiting: 5 OTP requests per hour per phone using Redis counters
  - Store hashed OTP in Redis with 300-second TTL using bcrypt
  - Add structured logging with winston for OTP generation and delivery events
  - **Validates: Requirements 1.1, 1.2, 1.5, Design Section 8.1**

- [ ] 2.3 Implement OTP verification and JWT token generation
  - Create verifyOTP function with bcrypt comparison and single-use validation
  - Implement JWT generation with HS256 algorithm, 7-day expiry, user payload
  - Create user record in PostgreSQL on successful verification
  - Handle edge cases: expired OTP, invalid OTP, already verified OTP
  - **Validates: Requirements 1.4, 15.3, Design Section 8.1**

- [ ] 2.4 Create JWT authentication middleware
  - Implement authenticateJWT middleware for Bearer token extraction and validation
  - Add token blacklist support using Redis for logout functionality
  - Create token refresh endpoint with sliding expiration
  - Handle authentication errors with appropriate HTTP status codes
  - **Validates: Requirements 15.3, Design Section 8.1**

- [ ]* 2.5 Write property tests for authentication
  - **Property 1: OTP Generation and Validation** - Test OTP format, expiry, single-use for any valid phone
  - **Property 2: Rate Limiting Consistency** - Test 5 requests/hour and 30-second resend limits
  - **Property 3: JWT Token Validity** - Test JWT access and 7-day expiry for any valid verification
  - Use fast-check to generate random phone numbers and verify authentication properties
  - **Validates: Design Properties 1, 2, 3**

### 3. Mobile App Foundation

- [ ] 3.1 Initialize React Native project with TypeScript
  - Create mobile/krishiai-app/ using React Native CLI with TypeScript template
  - Configure for Android: minSdkVersion 26, targetSdkVersion 33, 2GB RAM optimization
  - Install core dependencies: @reduxjs/toolkit, react-redux, redux-saga, @react-navigation/native
  - Set up folder structure: screens, components, services, store, utils, types
  - Configure Metro bundler for optimal performance and bundle splitting
  - **Validates: Requirements 16.1, 16.2, Design Section 2.1**

- [ ] 3.2 Set up Redux state management with offline persistence
  - Configure Redux store with configureStore and middleware
  - Create slices: authSlice, farmSlice, cropSlice, marketSlice, weatherSlice, syncSlice
  - Set up Redux Saga for async operations and side effects
  - Implement redux-persist with AsyncStorage for offline state persistence
  - Create typed hooks (useAppDispatch, useAppSelector) for type safety
  - **Validates: Design Section 2.1.1**

- [ ] 3.3 Set up WatermelonDB for offline-first data storage
  - Install @nozbe/watermelondb and configure SQLite adapter for Android
  - Create schema: users, farms, crops, cached_weather, cached_prices, sync_queue tables
  - Create models with associations: User, Farm, Crop, CachedWeather, CachedPrice, SyncQueueItem
  - Set up database initialization and migration system
  - **Validates: Requirements 10.1-10.7, Design Section 6.1**

- [ ] 3.4 Implement API client with offline queue support
  - Create ApiClient class using axios with base URL and timeout configuration
  - Add request interceptor for JWT token attachment from Redux state
  - Add response interceptor for error handling, token refresh, and offline detection
  - Implement queueOfflineRequest function to add failed requests to sync queue
  - Add retry logic with exponential backoff for network failures
  - **Validates: Requirements 11.1-11.6, Design Section 6.2**

- [ ]* 3.5 Write property tests for mobile app foundation
  - **Property 26: Sync Queue Priority Processing** - Test priority ordering for any mix of queued items
  - **Property 27: Sync Retry and Failure Handling** - Test exponential backoff and failure marking
  - **Property 28: Conflict Resolution Consistency** - Test last-write-wins for any conflicting data
  - Use fast-check to generate random sync queue scenarios and verify processing behavior
  - **Validates: Design Properties 26, 27, 28**

### 4. Multi-Language Support Implementation

- [ ] 4.1 Set up i18n infrastructure with React Native
  - Install react-i18next and configure for React Native environment
  - Create translation files: locales/hi.json (Hindi), locales/mr.json (Marathi)
  - Translate all UI strings, error messages, and user-facing text
  - Implement language detection and persistence using AsyncStorage
  - **Validates: Requirements 2.1-2.5, Design Section 2.1**

- [ ] 4.2 Create language selection and voice integration
  - Build LanguageSelectionScreen with native script display (हिंदी, मराठी)
  - Integrate react-native-voice for speech-to-text in Hindi and Marathi
  - Integrate react-native-tts for text-to-speech output in selected language
  - Implement voice input components for text fields throughout the app
  - **Validates: Requirements 2.3, 9.1, 9.4, Design Section 2.1**

- [ ]* 4.3 Write property tests for multi-language support
  - **Property 4: UI Translation Completeness** - Test translation for any language selection
  - **Property 5: Voice I/O Language Consistency** - Test voice recognition and TTS for any supported language
  - Use fast-check to generate random UI screens and verify translation completeness
  - **Validates: Design Properties 4, 5**

### 5. Disease Detection AI Implementation

- [ ] 5.1 Train disease detection model with MobileNetV3
  - Create ml-models/disease-detector/ with training pipeline
  - Download and preprocess PlantVillage dataset (87K images, 120 diseases)
  - Implement data augmentation: rotation, flip, zoom, brightness adjustment
  - Fine-tune MobileNetV3-Small on disease dataset with custom classification head
  - Achieve >90% accuracy on validation set with early stopping and model checkpointing
  - **Validates: Requirements 5.2, Design Section 7.1**

- [ ] 5.2 Convert model to TensorFlow Lite for mobile deployment
  - Convert trained model to TensorFlow Lite with quantization
  - Optimize model size to <15MB for mobile deployment
  - Test inference speed on Android emulator (target <2 seconds)
  - Create model versioning and update mechanism
  - **Validates: Requirements 5.1, Design Section 7.1**

- [ ] 5.3 Integrate TensorFlow Lite in mobile app
  - Install react-native-tensorflow-lite and configure for Android
  - Copy disease_detector.tflite to android/app/src/main/assets/
  - Create TFLiteService for model loading and inference
  - Implement image preprocessing: resize to 224x224, normalize, convert to tensor
  - Cache model in memory for fast repeated inference
  - **Validates: Requirements 5.1, 5.6, Design Section 2.1.2**

- [ ] 5.4 Create disease detection screen with camera integration
  - Build DiseaseDetectionScreen using react-native-vision-camera
  - Implement camera permissions handling and error states
  - Add image capture, preview, and crop/rotate functionality
  - Display inference results: disease name (local + scientific), confidence, severity
  - Show treatment recommendations with organic/chemical options
  - **Validates: Requirements 5.3, 5.4, 5.5, Design Section 2.1**

- [ ]* 5.5 Write property tests for disease detection
  - **Property 10: Disease Detection Performance and Accuracy** - Test <2s inference and >90% accuracy for any plant image
  - **Property 11: Disease Detection Offline Functionality** - Test offline operation and sync queue addition
  - **Property 12: Treatment Recommendation Structure** - Test organic-first recommendation structure
  - Use synthetic plant disease images for consistent property testing
  - **Validates: Design Properties 10, 11, 12**

### 6. Crop Intelligence Service

- [ ] 6.1 Initialize Crop Service with Python and FastAPI
  - Create services/crop-service/ with FastAPI framework
  - Install dependencies: fastapi, uvicorn, sqlalchemy, psycopg2, redis, xgboost, scikit-learn
  - Set up project structure: routes, models, services, ml modules
  - Configure CORS middleware and API documentation with OpenAPI
  - **Validates: Design Section 2.2.2**

- [ ] 6.2 Train crop recommendation model with XGBoost
  - Create ml-models/crop-recommender/ with training pipeline
  - Collect and preprocess training data: soil, weather, market, yield history
  - Engineer 12 features: soil N/P/K/pH, weather averages, farm characteristics, market trends
  - Train XGBoost classifier with 50 crop classes (n_estimators=100, max_depth=6)
  - Achieve >85% accuracy with 5-fold cross-validation
  - **Validates: Requirements 4.6, Design Section 7.2**

- [ ] 6.3 Implement crop recommendation endpoint
  - Create POST /api/v1/crop/recommend with FastAPI
  - Fetch farm data, weather forecast, and market trends
  - Load XGBoost model and prepare feature vector
  - Return top 3 recommendations with yield, investment, revenue, water needs, risk level
  - Cache results in Redis with 24-hour TTL
  - **Validates: Requirements 4.1-4.5, Design Section 2.2.2**

- [ ]* 6.4 Write property tests for crop intelligence
  - **Property 8: Crop Recommendation Performance and Structure** - Test 3 recommendations <500ms with all required fields
  - **Property 9: Crop Recommendation Accuracy** - Test >85% accuracy for any soil/weather/market conditions
  - Use Hypothesis to generate random farm conditions and verify recommendation properties
  - **Validates: Design Properties 8, 9**

### 7. Market Intelligence Service

- [ ] 7.1 Initialize Market Service with Node.js and TimescaleDB
  - Create services/market-service/ with Express and TypeScript
  - Set up TimescaleDB connection for time-series price data
  - Create data ingestion pipeline for Agmarknet and eNAM APIs
  - Schedule daily price updates at 6:00 AM IST using node-cron
  - **Validates: Requirements 6.1, 6.2, Design Section 2.2.3**

- [ ] 7.2 Train price forecasting models
  - Create ml-models/price-forecaster/ with ARIMA and LSTM models
  - Collect 5 years of historical price data from market_prices table
  - Train ARIMA model for 7-day forecasts (order=(5,1,2))
  - Train LSTM model for 30-day forecasts with 2 LSTM layers
  - Create ensemble model: 0.6 * ARIMA + 0.4 * LSTM
  - Achieve >85% accuracy (MAPE < 15%) on validation data
  - **Validates: Requirements 6.4, Design Section 7.3**

- [ ] 7.3 Implement market price endpoints
  - Create GET /api/v1/market/prices with geospatial queries (PostGIS ST_DWithin)
  - Create GET /api/v1/market/forecast with ARIMA/LSTM ensemble predictions
  - Implement price trend calculation: >2% change for up/down indicators
  - Add price alert functionality with SMS notifications
  - Cache responses in Redis with appropriate TTLs
  - **Validates: Requirements 6.1-6.6, Design Section 2.2.3**

- [ ]* 7.4 Write property tests for market intelligence
  - **Property 13: Market Price Geospatial Query** - Test 5 nearest mandis for any farm location
  - **Property 14: Price Trend Calculation** - Test trend indicators for any price data
  - **Property 15: Price Forecasting Accuracy** - Test >85% accuracy for any crop/location
  - **Property 16: Price Alert Notification** - Test SMS alerts for any target price
  - Use fast-check to generate random locations and price data for testing
  - **Validates: Design Properties 13, 14, 15, 16**

### 8. Climate Intelligence Service

- [ ] 8.1 Initialize Climate Service with weather data integration
  - Create services/climate-service/ with Node.js and Express
  - Integrate IMD API for weather data with authentication and error handling
  - Set up ISRO MOSDAC integration for satellite data
  - Schedule weather updates every 6 hours using node-cron
  - Store forecasts in weather_forecasts TimescaleDB hypertable
  - **Validates: Requirements 7.1, 18.1, Design Section 2.2.4**

- [ ] 8.2 Implement water advisory algorithm
  - Create FAO-56 Penman-Monteith implementation for evapotranspiration calculation
  - Calculate crop water requirements based on growth stage and crop coefficients
  - Factor in effective rainfall (0.8 * rainfall) and soil moisture
  - Determine irrigation recommendations with water quantity and timing
  - **Validates: Requirements 7.4, 7.5, Design Section 2.2.4**

- [ ] 8.3 Implement weather and water advisory endpoints
  - Create GET /api/v1/climate/weather/forecast with 7-day hourly breakdown
  - Create GET /api/v1/climate/water/advisory with irrigation recommendations
  - Implement critical weather alerting for extreme conditions
  - Add SMS alert integration for weather warnings
  - **Validates: Requirements 7.1-7.6, Design Section 2.2.4**

- [ ]* 8.4 Write property tests for climate intelligence
  - **Property 17: Weather Forecast Updates and Accuracy** - Test 6-hour updates and 5km accuracy
  - **Property 18: Critical Weather Alerting** - Test SMS alerts for any extreme conditions
  - **Property 19: Irrigation Calculation Accuracy** - Test FAO-56 formula for any conditions
  - **Property 20: Water Savings Tracking** - Test savings calculation for any irrigation decisions
  - Use Hypothesis to generate random weather data and verify calculation accuracy
  - **Validates: Design Properties 17, 18, 19, 20**

### 9. Government Services Implementation

- [ ] 9.1 Initialize Government Service with scheme data
  - Create services/govt-service/ with Node.js and Express
  - Set up web scraping for government portals: PM-KISAN, PMFBY, KCC, state schemes
  - Create government_schemes table with multilingual support
  - Schedule weekly scheme data updates using node-cron
  - **Validates: Requirements 8.1, Design Section 2.2**

- [ ] 9.2 Implement scheme discovery and filtering
  - Create GET /api/v1/govt/schemes with full-text search and filtering
  - Filter by eligibility: land size, crop type, location, farmer category
  - Support Hindi and Marathi responses using translation tables
  - Cache scheme data in Redis with 24-hour TTL
  - **Validates: Requirements 8.2-8.5, Design Section 2.2**

- [ ] 9.3 Train and deploy chatbot NLP model
  - Create ml-models/chatbot-nlp/ with IndicBERT for Hindi/Marathi
  - Train intent classification for 20+ farming intents
  - Achieve >85% intent recognition accuracy on validation set
  - Deploy model with FastAPI for real-time inference
  - **Validates: Requirements 9.2, Design Section 2.2**

- [ ] 9.4 Implement chatbot endpoint with voice support
  - Create POST /api/v1/govt/chatbot with text and voice input support
  - Integrate with other services based on intent routing
  - Implement fallback responses for unrecognized queries
  - Add conversation history storage for offline access
  - **Validates: Requirements 9.1-9.6, Design Section 2.2**

- [ ]* 9.5 Write property tests for government services
  - **Property 21: Scheme Filtering and Display** - Test filtering and multilingual display for any farmer profile
  - **Property 22: Scheme Update and Notification** - Test weekly updates and 7-day deadline reminders
  - **Property 23: Chatbot Intent Recognition and Response** - Test >85% accuracy and <1s response for any query
  - **Property 24: Chatbot Fallback Behavior** - Test fallback responses for any unrecognized query
  - Use fast-check to generate random farmer profiles and queries for testing
  - **Validates: Design Properties 21, 22, 23, 24**

### 10. Mobile App Feature Integration

- [ ] 10.1 Create navigation structure and onboarding flow
  - Set up React Navigation with AuthStack and MainTabs
  - Build onboarding screens: phone input, OTP verification, language selection, farm profile
  - Implement conditional navigation based on authentication state
  - Add deep linking support for notifications
  - **Validates: Requirements 1.1-3.6, Design Section 2.1**

- [ ] 10.2 Implement crop recommendation and disease detection screens
  - Build CropRecommendationScreen with loading states and result display
  - Build DiseaseDetectionScreen with camera integration and result display
  - Implement offline caching and sync queue integration
  - Add error handling and retry mechanisms
  - **Validates: Requirements 4.1-5.7, Design Section 2.1**

- [ ] 10.3 Implement market and weather screens
  - Build MarketPricesScreen with geolocation and price trend display
  - Build WeatherForecastScreen with 7-day forecast and hourly breakdown
  - Build WaterAdvisoryScreen with irrigation recommendations
  - Implement offline caching with "Last updated" timestamps
  - **Validates: Requirements 6.1-7.6, Design Section 2.1**

- [ ] 10.4 Implement government services screens
  - Build SchemesScreen with search, filtering, and eligibility indicators
  - Build ChatbotScreen with voice input and conversation history
  - Implement offline scheme caching and conversation storage
  - Add notification handling for scheme deadlines and weather alerts
  - **Validates: Requirements 8.1-9.6, Design Section 2.1**

- [ ]* 10.5 Write property tests for mobile app features
  - **Property 25: Offline Functionality Completeness** - Test offline operation with timestamps for any cached data
  - **Property 29: Network Resilience** - Test graceful network interruption handling for any sync operation
  - Use fast-check to generate random network conditions and verify app resilience
  - **Validates: Design Properties 25, 29**

### 11. Performance Optimization and Testing

- [ ] 11.1 Implement comprehensive caching strategy
  - Add Redis caching middleware to all services with appropriate TTLs
  - Implement cache invalidation on data updates
  - Add cache hit/miss metrics and monitoring
  - Optimize mobile app bundle size with code splitting and lazy loading
  - **Validates: Requirements 12.1, 16.6, Design Section 9.1**

- [ ] 11.2 Optimize database and API performance
  - Add composite indexes for common query patterns
  - Implement connection pooling for all database connections
  - Add query performance monitoring and slow query logging
  - Optimize image compression and storage
  - **Validates: Requirements 12.1-12.5, Design Section 9.2-9.3**

- [ ]* 11.3 Write comprehensive property tests for performance
  - **Property 30: API Response Time Consistency** - Test <500ms for 95% of any read operations
  - **Property 31: Mobile App Performance** - Test <3s startup and <2s disease detection for any device
  - **Property 32: System Scalability** - Test consistent performance for any load up to 1,000 users
  - Use k6 and fast-check for load testing with property validation
  - **Validates: Design Properties 30, 31, 32**

### 12. Security and Compliance Implementation

- [ ] 12.1 Implement comprehensive security measures
  - Configure TLS 1.3 for all API endpoints with certificate management
  - Implement data encryption at rest using AES-256 for PII fields
  - Add comprehensive input validation and sanitization
  - Implement rate limiting with Redis-based counters
  - **Validates: Requirements 15.1-15.7, Design Section 8.1-8.4**

- [ ] 12.2 Ensure DPDP Act 2023 compliance
  - Implement user consent management for data collection
  - Add data deletion functionality (right to be forgotten)
  - Create privacy policy in Hindi and Marathi
  - Add audit logging for all data access and modifications
  - **Validates: Requirements 20.1-20.6, Design Section 8**

- [ ]* 12.3 Write property tests for security
  - **Property 2: Rate Limiting Consistency** - Test rate limits for any user and endpoint
  - **Property 34: Data Compression and Transmission** - Test gzip compression for any data upload
  - Use fast-check to generate random attack scenarios and verify security measures
  - **Validates: Design Properties 2, 34**

### 13. Monitoring, Deployment, and Launch Preparation

- [ ] 13.1 Set up comprehensive monitoring and observability
  - Install Prometheus metrics collection in all services
  - Set up Grafana dashboards for API performance, ML model metrics, business metrics
  - Configure structured logging with winston and centralized log aggregation
  - Set up Sentry for error tracking and alerting
  - **Validates: Design Section 10.1-10.3**

- [ ] 13.2 Create Kubernetes deployment manifests
  - Write deployment.yaml for each service with resource limits and health checks
  - Configure HorizontalPodAutoscaler for auto-scaling based on CPU/memory
  - Set up ConfigMaps and Secrets for environment variables
  - Create service meshes and ingress controllers
  - **Validates: Design Section 11.1**

- [ ] 13.3 Set up CI/CD pipeline with automated testing
  - Configure GitHub Actions for automated testing on every commit
  - Set up automated property test execution on pull requests
  - Implement gradual rollout strategy: 10% → 50% → 100%
  - Add automated rollback on deployment failures
  - **Validates: Design Section 11.2**

- [ ] 13.4 Prepare for pilot launch
  - Set up production environment with monitoring and alerting
  - Create user documentation in Hindi and Marathi
  - Train village coordinators with 2-day training program
  - Set up support channels: WhatsApp group, phone hotline
  - Create incident response plan and runbooks
  - **Validates: Requirements 21.1-23.6**

---

**Total Tasks**: 13 major sections, 50+ individual tasks
**Estimated Timeline**: 16-20 weeks for MVP
**Priority**: Complete sections 1-5 first (core infrastructure and AI features)

**Property-Based Testing Integration**:
- 35 correctness properties mapped to specific tasks
- Each property test validates universal system behavior
- Minimum 100 iterations per property test for thorough validation
- Property tests complement unit tests for comprehensive coverage

**Next Steps**:
1. Review and approve this enhanced task list
2. Begin implementation with Section 1 (Project Setup & Infrastructure)
3. Execute property tests alongside implementation tasks
4. Update task status as work progresses using the taskStatus toolon Mobile Feature

- [ ] 11.1 Create crop recommendation screen
  - Build CropRecommendationScreen with "Get Recommendations" button
  - Show loading state with progress indicator and "Analyzing..." text
  - Display top 3 crop recommendations as cards with ranking badges (1st, 2nd, 3rd)
  - Show confidence score as progress bar (0-100%)
  - Add "View Details" button on each card
  - **Validates: Requirements 2.2.1 (Crop Recommendation)**

- [ ] 11.2 Display detailed crop information
  - Create CropDetailScreen for expanded view
  - Display expected yield in tons/hectare with visual gauge
  - Show investment required in ₹ with itemized breakdown
  - Display expected revenue and profit with color coding (green if profitable)
  - Show water requirements in liters/hectare/season
  - Display best sowing window with calendar dates
  - Show risk level (Low/Medium/High) with color badge and explanation
  - Add "Select This Crop" button to save choice
  - **Validates: Requirements 2.2.1**

- [ ] 11.3 Implement recommendation caching
  - Cache recommendations in WatermelonDB with farm_id and timestamp
  - Refresh recommendations when: farm data changes, season changes (every 3 months), manual refresh
  - Show cached recommendations offline with "Last updated" timestamp
  - Display "Refresh Recommendations" button
  - **Validates: Requirements 2.6.1 (Offline Mode), Design Section 6.1**

- [ ] 11.4 Write tests for crop recommendation UI
  - Test recommendation display shows 3 crops with all required fields
  - Test offline caching: recommendations available without network
  - Test loading states display correctly
  - Test error handling: network error, no recommendations available
  - Use React Native Testing Library
  - **Validates: Design Section 12.1**

## 12. Government Services

- [ ] 12.1 Initialize Government Service project
  - Create services/govt-service/ directory
  - Initialize Node.js project with TypeScript and Express
  - Install dependencies: express, pg, redis, cheerio, axios, node-cron
  - Set up project structure
  - Create government_schemes table in PostgreSQL
  - Add GET /health endpoint
  - **Validates: Design Section 2.2**

- [ ] 12.2 Implement scheme data ingestion
  - Create scrapers for government portals: PM-KISAN, PMFBY, KCC, state subsidy portals
  - Implement web scraping with cheerio for scheme details
  - Normalize data: scheme_name, description, benefits, eligibility, documents_required, deadline, application_url
  - Schedule weekly updates using node-cron (every Sunday at 2 AM)
  - Store schemes in government_schemes table
  - Add logging for scraping success/failures
  - **Validates: Requirements 2.5.1 (Scheme Discovery), 4.2 (External Data)**

- [ ] 12.3 Implement scheme discovery endpoint
  - Create GET /api/v1/govt/schemes endpoint with query params: keyword, category, location
  - Implement full-text search on scheme_name and description
  - Filter by eligibility: land_size, crop_type, location (state/district)
  - Return: scheme details, eligibility_match (boolean), documents_required, deadline
  - Support Hindi and Marathi responses using translation table
  - Cache results in Redis with 24-hour TTL
  - **Validates: Requirements 2.5.1**

- [ ] 12.4 Implement basic chatbot
  - Install transformers library and download IndicBERT model for Hindi/Marathi
  - Create ml-models/chatbot-nlp/ directory
  - Train intent classification model on 20+ intents: weather_query, price_query, scheme_query, disease_query, greeting, etc.
  - Create POST /api/v1/govt/chatbot endpoint accepting text or voice input
  - Implement intent recognition with confidence threshold (>0.7)
  - Route to appropriate service based on intent: weather → Climate Service, prices → Market Service
  - Return response in user's language with <1 second latency
  - Achieve 85% intent recognition accuracy on test set
  - Fallback to FAQ for unrecognized intents
  - **Validates: Requirements 2.5.2 (Basic Chatbot)**

- [ ] 12.5 Write tests for Government Service
  - Test scheme search: verify keyword matching and filtering
  - Test eligibility filtering: verify correct schemes returned based on criteria
  - Test chatbot intent recognition: achieve 85% accuracy on test set
  - Test multilingual support: verify Hindi and Marathi responses
  - Test response time: verify <1 second for chatbot
  - Use Jest with supertest
  - **Validates: Design Section 12.1**

## 13. Mobile Government Services Features

- [ ] 13.1 Create schemes discovery screen
  - Build SchemesScreen with search bar and category filters (Agriculture, Subsidy, Insurance, Credit)
  - Display scheme cards with: name, category badge, deadline, eligibility indicator
  - Implement search functionality with debouncing (300ms)
  - Show eligibility indicator: green checkmark (eligible), gray (not eligible), yellow (partial match)
  - Create SchemeDetailScreen showing full details, documents required, application link
  - Add "Apply Now" button opening application URL in browser
  - **Validates: Requirements 2.5.1 (Scheme Discovery)**

- [ ] 13.2 Implement scheme caching for offline
  - Cache all scheme information in WatermelonDB (government_schemes table)
  - Update cache weekly when online
  - Show cached schemes offline with "Offline Mode" indicator
  - Display last update timestamp
  - **Validates: Requirements 2.6.1 (Offline Mode)**

- [ ] 13.3 Create chatbot screen
  - Build ChatbotScreen with chat UI (message bubbles, input field)
  - Implement voice input button using react-native-voice
  - Add text input field with send button
  - Display typing indicator while waiting for response
  - Show quick reply suggestions based on common intents
  - Implement message history stored in WatermelonDB
  - Add "Clear Chat" option in menu
  - **Validates: Requirements 2.5.2 (Basic Chatbot)**

- [ ] 13.4 Integrate voice recognition
  - Install and configure react-native-voice for speech-to-text
  - Support Hindi and Marathi language detection
  - Convert speech to text and send to chatbot endpoint
  - Display transcribed text in chat before sending
  - Add voice playback for chatbot responses using react-native-tts
  - Handle permissions for microphone access
  - **Validates: Requirements 2.1.2 (Language Selection), 2.5.2**

## 14. Offline Sync Implementation

- [ ] 14.1 Implement sync queue manager
  - Create SyncQueueManager class in mobile app
  - Define SyncQueueItem model with: id, action, entity_type, payload, priority, status, retry_count, created_at
  - Implement priority levels: CRITICAL (0), HIGH (1), MEDIUM (2), LOW (3)
  - Create addToQueue(item) method to insert items
  - Implement processQueue() method: sort by priority then created_at, process sequentially
  - Add retry logic: max 3 attempts with exponential backoff (1s, 2s, 4s)
  - Track status: PENDING, SYNCING, COMPLETED, FAILED
  - **Validates: Requirements 2.6.2 (Background Sync), Design Section 6.2, Property 2.1**

- [ ] 14.2 Implement auto-sync on WiFi
  - Use @react-native-community/netinfo to detect network changes
  - Listen for network state changes: isConnected and type (wifi/cellular)
  - Trigger processQueue() automatically when WiFi connected
  - Show sync progress notification with item count
  - Update UI with sync status indicator
  - **Validates: Requirements 2.6.2**

- [ ] 14.3 Implement manual sync option
  - Add "Sync Now" button in SettingsScreen
  - Display pending items count badge on sync button
  - Show sync progress modal with: items synced, items remaining, current item
  - Display last successful sync timestamp
  - Add pull-to-refresh on main screens to trigger sync
  - **Validates: Requirements 2.6.2**

- [ ] 14.4 Implement conflict resolution
  - Implement last-write-wins strategy using timestamps
  - Compare local updated_at with server updated_at
  - If local newer: push to server, if server newer: pull from server
  - Log conflicts to conflict_log table for debugging
  - Display conflict resolution summary to user (optional)
  - **Validates: Design Section 6.3, Property 2.3**

- [ ] 14.5 Write tests for sync functionality
  - Test priority-based execution: verify CRITICAL items process before LOW
  - Test retry logic: verify 3 attempts with exponential backoff
  - Test conflict resolution: create conflicting updates, verify last-write-wins
  - Test offline-online consistency: create data offline, sync, verify server matches
  - Use Jest with mocked network conditions
  - **Validates: Design Section 12.1, Property 2.1-2.3**

## 15. Performance Optimization

- [ ] 15.1 Implement API response caching
  - Add Redis caching middleware to all services
  - Cache GET requests with appropriate TTLs: prices (1h), weather (6h), schemes (24h)
  - Implement cache key strategy: `service:endpoint:params_hash`
  - Add cache invalidation on POST/PUT/DELETE operations
  - Add X-Cache-Status header (HIT/MISS) for debugging
  - **Validates: Requirements 3.1.1 (Response Time), Design Section 9.1**

- [ ] 15.2 Implement database query optimization
  - Add composite indexes for common query patterns
  - Use prepared statements for all queries
  - Implement connection pooling: max 20 connections per service
  - Add query performance logging (log queries >100ms)
  - Optimize N+1 queries with eager loading
  - **Validates: Requirements 3.1.1, Design Section 9.2**

- [ ] 15.3 Implement image optimization
  - Install sharp library in Crop Service
  - Resize uploaded images to max 800x800 before storage
  - Convert to WebP format with 80% quality
  - Compress images before upload from mobile app
  - Implement lazy loading for image lists
  - **Validates: Requirements 3.5.2 (Data Usage), Design Section 9.3**

- [ ] 15.4 Optimize mobile app bundle size
  - Enable Hermes JavaScript engine in android/app/build.gradle
  - Remove unused dependencies using depcheck
  - Enable ProGuard for Android release builds
  - Split APK by ABI (armeabi-v7a, arm64-v8a)
  - Verify final APK size <15MB
  - **Validates: Requirements 3.3.1 (Mobile Optimization)**

- [ ] 15.5 Run performance tests
  - Install k6 for load testing
  - Create load test scripts for all critical endpoints
  - Test with 100 concurrent users for 5 minutes
  - Verify p95 response time <500ms for all endpoints
  - Verify error rate <1%
  - Generate performance report
  - **Validates: Requirements 3.1.1, Design Section 12.4, Property 4.1**

## 16. Security Implementation

- [ ] 16.1 Implement TLS/HTTPS
  - Configure TLS 1.3 for all API endpoints
  - Obtain SSL certificates (Let's Encrypt for staging, commercial for production)
  - Enable HSTS headers with max-age=31536000
  - Implement certificate pinning in mobile app
  - Redirect all HTTP traffic to HTTPS
  - **Validates: Requirements 3.4.2 (Data Protection), Design Section 8.2**

- [ ] 16.2 Implement data encryption at rest
  - Encrypt PII fields in database using AES-256-GCM
  - Create encryption utility module with encrypt/decrypt functions
  - Store encryption keys in environment variables (AWS Secrets Manager for production)
  - Implement key rotation policy (rotate every 90 days)
  - Encrypt sensitive fields: phone, name, location coordinates
  - **Validates: Requirements 3.4.2, Design Section 8.2**

- [ ] 16.3 Implement input validation
  - Install express-validator in all Node.js services
  - Create validation middleware for all endpoints
  - Validate phone numbers: /^\+91[6-9]\d{9}$/
  - Validate names: 2-100 characters, alphanumeric + spaces
  - Validate coordinates: latitude (-90 to 90), longitude (-180 to 180)
  - Sanitize all user inputs to prevent XSS
  - Return clear error messages with field-level details
  - **Validates: Design Section 8.3**

- [ ] 16.4 Implement rate limiting
  - Install express-rate-limit middleware
  - Configure OTP endpoint: 5 requests per hour per phone
  - Configure API endpoints: 1000 requests per hour per user
  - Configure ML inference: 50 requests per hour per user
  - Return 429 status with Retry-After header when exceeded
  - Add rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  - **Validates: Requirements 3.4.1 (Authentication), Design Section 8.4, Property 4.2**

- [ ] 16.5 Write security tests
  - Test JWT validation: verify invalid tokens rejected
  - Test rate limiting: verify 429 returned after limit exceeded
  - Test input validation: verify malicious inputs rejected
  - Test encryption/decryption: verify data encrypted at rest
  - Test XSS prevention: verify script tags sanitized
  - Use Jest and OWASP ZAP for security testing
  - **Validates: Design Section 12.1, Property 1.3, 4.2**

## 17. Monitoring & Observability

- [ ] 17.1 Set up Prometheus metrics
  - Install prom-client in all Node.js services
  - Create metrics: http_request_duration_seconds (histogram), http_requests_total (counter)
  - Add ML metrics: model_inference_latency_seconds, model_accuracy (gauge)
  - Add business metrics: active_users, disease_detections_total, crop_recommendations_total
  - Expose /metrics endpoint in each service
  - **Validates: Design Section 10.1**

- [ ] 17.2 Set up structured logging
  - Install winston in all Node.js services
  - Configure JSON format logging with timestamp, level, service, message, context
  - Add request ID to all logs using middleware
  - Separate error logs (error.log) from combined logs (combined.log)
  - Log important events: user registration, OTP sent, disease detection, sync completed
  - Implement log rotation (daily, keep 30 days)
  - **Validates: Design Section 10.2**

- [ ] 17.3 Set up error tracking
  - Install @sentry/node in all services and @sentry/react-native in mobile app
  - Configure Sentry with DSN from environment variables
  - Capture exceptions with context: userId, requestId, endpoint, payload
  - Set up error alerts for critical errors (email/Slack)
  - Add breadcrumbs for debugging
  - **Validates: Design Section 10.3**

- [ ] 17.4 Create monitoring dashboards
  - Set up Grafana with Prometheus data source
  - Create dashboard: API Performance (response times, error rates by endpoint)
  - Create dashboard: ML Model Performance (inference latency, accuracy by model)
  - Create dashboard: Business Metrics (active users, feature usage, detections per day)
  - Create dashboard: Infrastructure (CPU, memory, disk usage by service)
  - Set up alerts: p95 latency >500ms, error rate >1%, service down
  - **Validates: Design Section 10.1**

## 18. Deployment & DevOps

- [ ] 18.1 Create Kubernetes manifests
  - Create infrastructure/k8s/ directory
  - Write deployment.yaml for each service with 3 replicas
  - Configure resource limits: CPU (250m-500m), memory (256Mi-512Mi)
  - Add liveness probe: HTTP GET /health every 10s
  - Add readiness probe: HTTP GET /ready every 5s
  - Create service.yaml for each service (ClusterIP type)
  - Create HorizontalPodAutoscaler: min 3, max 10 replicas, target CPU 70%
  - Create ConfigMap for environment variables
  - Create Secret for sensitive data (DB credentials, API keys)
  - **Validates: Design Section 11.1**

- [ ] 18.2 Set up production CI/CD
  - Extend .github/workflows/deploy-production.yml
  - Add automated testing gate: all tests must pass
  - Add Docker image security scanning with Trivy
  - Implement gradual rollout: deploy to 10% → wait 5 min → 50% → wait 10 min → 100%
  - Add rollback capability: kubectl rollout undo on failure
  - Add deployment notifications to Slack
  - **Validates: Design Section 11.2**

- [ ] 18.3 Set up database backups
  - Configure PostgreSQL continuous archiving (WAL archiving)
  - Enable point-in-time recovery (PITR)
  - Schedule daily snapshots at 2 AM using pg_dump
  - Retain daily snapshots for 30 days
  - Schedule weekly full backups on Sundays
  - Retain weekly backups for 1 year
  - Store backups in S3 with encryption
  - Test restore procedure monthly
  - **Validates: Design Section 15.1**

- [ ] 18.4 Set up disaster recovery
  - Configure cross-region replication for PostgreSQL (primary: us-east-1, replica: us-west-2)
  - Set up automated failover with health checks
  - Document failover procedures in runbook
  - Test disaster recovery quarterly
  - Verify RTO (Recovery Time Objective): 1 hour
  - Verify RPO (Recovery Point Objective): 5 minutes
  - **Validates: Design Section 15.2**

## 19. Testing & Quality Assurance

- [ ] 19.1 Write integration tests
  - Set up test environment with Docker Compose (test database, Redis)
  - Test auth flow: send OTP → verify OTP → get JWT → access protected endpoint
  - Test crop recommendation flow: create farm → request recommendation → verify response
  - Test disease detection flow: upload image → get detection → verify stored in DB
  - Test market price flow: fetch prices → verify geospatial query → verify caching
  - Use Jest with supertest for API testing
  - Achieve >70% code coverage
  - **Validates: Design Section 12.2**

- [ ] 19.2 Write E2E tests for mobile app
  - Set up Detox testing framework with Android emulator
  - Test complete onboarding: phone → OTP → language → farm profile → home screen
  - Test disease detection: open camera → capture → view results → save
  - Test offline functionality: disable network → use features → verify cached data
  - Test sync after reconnection: enable network → verify sync queue processed
  - Run tests on CI/CD pipeline
  - **Validates: Design Section 12.3**

- [ ] 19.3 Perform accessibility testing
  - Test voice input/output with Hindi and Marathi
  - Test high contrast UI in simulated sunlight (increase brightness, test readability)
  - Verify touch target sizes: all buttons ≥48x48dp
  - Test with low-end device (2GB RAM): verify app runs smoothly
  - Test with slow network (2G): verify graceful degradation
  - Use Android Accessibility Scanner
  - **Validates: Requirements 3.3.1, 3.3.2 (Accessibility)**

- [ ] 19.4 Perform load testing
  - Create k6 load test scripts for all critical endpoints
  - Test with 1,000 concurrent users for 10 minutes
  - Verify system handles 100K database records
  - Test auto-scaling: verify pods scale from 3 to 10 under load
  - Verify p95 latency remains <500ms under load
  - Generate load test report with graphs
  - **Validates: Requirements 3.1.2 (Scalability)**

## 20. Documentation & Launch Preparation

- [ ] 20.1 Write API documentation
  - Create docs/api/ directory
  - Document all endpoints with OpenAPI 3.0 specification
  - Include request/response schemas with examples
  - Add authentication instructions (JWT token usage)
  - Document error codes and messages
  - Add rate limiting information
  - Publish with Swagger UI at /api-docs endpoint
  - **Validates: Design Section 5**

- [ ] 20.2 Create user guides
  - Write onboarding guide in Hindi and Marathi (PDF format)
  - Create video tutorials for key features: disease detection, crop recommendation, market prices
  - Record videos in Hindi with Marathi subtitles
  - Prepare FAQ document covering common questions (20+ Q&A)
  - Create troubleshooting guide for common issues
  - Host documentation on website or in-app help section
  - **Validates: Requirements 2.6.1 (Offline Mode)**

- [ ] 20.3 Prepare for pilot launch
  - Set up production environment on AWS/GCP
  - Configure monitoring and alerts (Prometheus, Grafana, Sentry)
  - Set up support channels: WhatsApp group, phone hotline
  - Train village coordinators: 2-day training program
  - Prepare launch checklist: infrastructure, testing, documentation, support
  - Create incident response plan
  - **Validates: Requirements 9.1 (Assumptions)**

- [ ] 20.4 Set up analytics tracking
  - Install analytics SDK in mobile app (Firebase Analytics or Mixpanel)
  - Track feature usage: screen views, button clicks, feature completion
  - Track session metrics: duration, frequency, retention
  - Implement custom events: disease_detected, crop_recommended, price_checked
  - Set up analytics dashboard with key metrics
  - Track success metrics: NPS, retention rate, feature adoption
  - Create weekly analytics report
  - **Validates: Requirements 7 (Success Criteria)**

---

**Total Tasks**: 20 major sections, 100+ individual tasks
**Estimated Timeline**: 16-20 weeks for MVP
**Priority**: Complete sections 1-6 first (core infrastructure and crop intelligence)

**Next Steps**:
1. Review and approve this task list
2. Begin implementation with Section 1 (Project Setup & Infrastructure)
3. Execute tasks sequentially or assign to team members
4. Update task status as work progresses
5. Run tests after each section completion
