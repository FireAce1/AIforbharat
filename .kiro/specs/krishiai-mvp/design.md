# KrishiAI MVP - Design Document

## 1. Design Overview

### 1.1 Architecture Philosophy
The KrishiAI MVP follows a **microservices architecture** with an **offline-first mobile application**. The design prioritizes:
- **Resilience**: Works without internet connectivity
- **Performance**: Fast response times on low-end devices
- **Scalability**: Can grow from 1K to 1M+ users
- **Maintainability**: Clear separation of concerns

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Mobile App (React Native)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ On-Device AI │  │ Local Cache  │  │  Sync Queue  │ │
│  │ (TFLite)     │  │ (WatermelonDB)│  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↕ (GraphQL/REST)
┌─────────────────────────────────────────────────────────┐
│              API Gateway (Kong) + Load Balancer          │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                    Microservices Layer                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │  Auth    │  │  Crop    │  │  Market  │  │ Climate ││
│  │ Service  │  │ Service  │  │ Service  │  │ Service ││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘│
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│              Data Layer (PostgreSQL + Redis)             │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Technology Stack Summary
- **Mobile**: React Native, Redux, WatermelonDB, TensorFlow Lite
- **Backend**: Node.js (Express), Python (FastAPI for ML)
- **Database**: PostgreSQL with TimescaleDB, Redis
- **Infrastructure**: Docker, Kubernetes, AWS/GCP
- **AI/ML**: TensorFlow, PyTorch, MobileNetV3, XGBoost

---

## 2. System Components

### 2.1 Mobile Application

#### 2.1.1 Architecture Layers

**Presentation Layer**
- React Native components (functional with hooks)
- Material Design UI components
- Voice input/output integration
- Camera integration for disease detection

**State Management Layer**
- Redux for global state
- Redux Saga for side effects
- Local state for UI-only concerns

**Business Logic Layer**
- API client (Axios with interceptors)
- Offline manager (sync queue, conflict resolution)
- Data transformation and validation

**Data Layer**
- WatermelonDB (offline-first database)
- AsyncStorage (key-value for settings)
- TensorFlow Lite (on-device AI models)

#### 2.1.2 Key Features Implementation

**Offline-First Strategy**
```javascript
// Sync queue architecture
{
  id: uuid,
  action: 'CREATE_DISEASE_DETECTION',
  payload: { image, cropId, location },
  priority: 'HIGH',
  timestamp: Date.now(),
  retryCount: 0,
  status: 'PENDING'
}
```

**On-Device AI Models**
- Disease Detection: MobileNetV3 (15MB, quantized)
- Pest Identification: YOLOv5-nano (8MB)
- Voice Recognition: Whisper-tiny (39MB)
- Models loaded on app start, cached in memory

### 2.2 Backend Services

#### 2.2.1 Auth Service
**Responsibility**: User authentication and authorization


**Technology**: Node.js + Express + JWT

**Endpoints**:
- `POST /api/v1/auth/send-otp` - Send OTP to phone
- `POST /api/v1/auth/verify-otp` - Verify OTP and issue JWT
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `GET /api/v1/auth/profile` - Get user profile

**Database Schema**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    name VARCHAR(100),
    language VARCHAR(5) DEFAULT 'hi',
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP,
    INDEX idx_phone (phone)
);

CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_phone_expires (phone, expires_at)
);
```

**Security Measures**:
- OTP valid for 5 minutes
- Rate limiting: 5 OTP requests per hour per phone
- JWT expiry: 7 days
- Bcrypt for sensitive data hashing

#### 2.2.2 Crop Service
**Responsibility**: Crop recommendations, disease detection, yield prediction


**Technology**: Python + FastAPI + TensorFlow

**Endpoints**:
- `POST /api/v1/crop/recommend` - Get crop recommendations
- `POST /api/v1/crop/disease/detect` - Detect disease from image
- `GET /api/v1/crop/yield/predict` - Predict yield
- `GET /api/v1/crop/calendar` - Get crop calendar

**Database Schema**:
```sql
CREATE TABLE farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    location GEOGRAPHY(POINT),
    size_hectares DECIMAL(10,2),
    soil_type VARCHAR(50),
    irrigation_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user (user_id),
    INDEX idx_location USING GIST (location)
);

CREATE TABLE crops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farms(id),
    crop_name VARCHAR(100),
    variety VARCHAR(100),
    sowing_date DATE,
    expected_harvest DATE,
    status VARCHAR(20),
    INDEX idx_farm (farm_id)
);

CREATE TABLE disease_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_id UUID REFERENCES crops(id),
    image_url VARCHAR(500),
    disease_name VARCHAR(100),
    confidence DECIMAL(5,4),
    severity VARCHAR(20),
    detected_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_crop (crop_id)
);
```


**AI Models**:

*Crop Recommendation Model*
```python
# XGBoost ensemble model
features = [
    'soil_nitrogen', 'soil_phosphorus', 'soil_potassium', 'soil_ph',
    'rainfall_avg', 'temperature_avg', 'humidity_avg',
    'farm_size', 'irrigation_type', 'previous_crop',
    'market_price_trend', 'demand_forecast'
]

model = XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1
)

# Returns top 3 crops with confidence scores
output = {
    'recommendations': [
        {'crop': 'Tomato', 'confidence': 0.89, ...},
        {'crop': 'Onion', 'confidence': 0.82, ...},
        {'crop': 'Cotton', 'confidence': 0.76, ...}
    ]
}
```

*Disease Detection Model*
- Base: MobileNetV3 (pre-trained on ImageNet)
- Fine-tuned on PlantVillage dataset (87K images)
- Custom dataset: 150K images (38 crops, 120 diseases)
- Input: 224x224 RGB image
- Output: Disease class + confidence + severity

#### 2.2.3 Market Service
**Responsibility**: Price information, forecasting, profit calculation

**Technology**: Node.js + Express + Python (ML models)

**Endpoints**:
- `GET /api/v1/market/prices` - Current prices by crop and location
- `GET /api/v1/market/forecast` - Price forecast (7/30/90 days)
- `POST /api/v1/market/profit/calculate` - Calculate profit estimate
- `GET /api/v1/market/mandis/nearby` - Get nearby mandis


**Database Schema**:
```sql
CREATE TABLE market_prices (
    time TIMESTAMPTZ NOT NULL,
    crop_name VARCHAR(100),
    market_name VARCHAR(100),
    location GEOGRAPHY(POINT),
    price_per_kg DECIMAL(10,2),
    quantity_traded DECIMAL(10,2),
    PRIMARY KEY (time, crop_name, market_name)
);

-- TimescaleDB hypertable for time-series data
SELECT create_hypertable('market_prices', 'time');
```

**Price Forecasting Model**:
```python
# ARIMA + LSTM hybrid model
# Short-term (7-day): ARIMA
arima_model = ARIMA(order=(5,1,2))

# Medium-term (30-day): LSTM
lstm_model = Sequential([
    LSTM(64, return_sequences=True, input_shape=(30, 5)),
    Dropout(0.2),
    LSTM(32),
    Dense(7)  # 7-day forecast
])

# Ensemble prediction
forecast = 0.6 * arima_pred + 0.4 * lstm_pred
```

**Data Sources**:
- Agmarknet API (6,000+ mandis, daily updates)
- eNAM API (National Agriculture Market)
- Web scraping for retail prices (BigBasket, etc.)

#### 2.2.4 Climate Service
**Responsibility**: Weather forecasts, water advisory, climate risk

**Technology**: Node.js + Express + Python (ML models)

**Endpoints**:
- `GET /api/v1/climate/weather/forecast` - 7-day weather forecast
- `GET /api/v1/climate/water/advisory` - Irrigation recommendations
- `GET /api/v1/climate/risk/assess` - Climate risk assessment
- `GET /api/v1/climate/alerts` - Critical weather alerts


**Database Schema**:
```sql
CREATE TABLE weather_forecasts (
    time TIMESTAMPTZ NOT NULL,
    location GEOGRAPHY(POINT),
    temperature DECIMAL(5,2),
    rainfall DECIMAL(5,2),
    humidity DECIMAL(5,2),
    wind_speed DECIMAL(5,2),
    source VARCHAR(50),
    PRIMARY KEY (time, location)
);

SELECT create_hypertable('weather_forecasts', 'time');

CREATE TABLE irrigation_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farms(id),
    crop_id UUID REFERENCES crops(id),
    recommendation_date DATE NOT NULL,
    should_irrigate BOOLEAN NOT NULL,
    water_amount_mm DECIMAL(5,2),
    timing VARCHAR(20),
    water_saved_mm DECIMAL(5,2),
    calculation_method VARCHAR(50) DEFAULT 'FAO-56',
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_farm_date (farm_id, recommendation_date)
);

CREATE TABLE water_savings_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farms(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_water_saved_mm DECIMAL(10,2),
    traditional_usage_mm DECIMAL(10,2),
    optimized_usage_mm DECIMAL(10,2),
    savings_percentage DECIMAL(5,2),
    INDEX idx_farm_period (farm_id, period_start, period_end)
);
```

**Data Sources**:
- IMD API (India Meteorological Department) - updates every 6 hours
- ISRO MOSDAC - satellite data (INSAT-3D)
- NASA POWER - solar radiation, wind data

**Weather Update Schedule**:
- Fetch from IMD API every 6 hours (00:00, 06:00, 12:00, 18:00 IST)
- Automatic retry on failure with exponential backoff
- Cache previous forecast if API unavailable
- Hyperlocal accuracy: 5-kilometer grid resolution

**Critical Weather Alert Thresholds**:
```python
CRITICAL_THRESHOLDS = {
    'heavy_rainfall': 100,  # mm/day
    'extreme_heat': 45,     # °C
    'frost': 5,             # °C
    'high_wind': 60,        # km/h
    'hail': True            # any hail event
}

def check_critical_weather(forecast):
    alerts = []
    
    if forecast['rainfall'] > CRITICAL_THRESHOLDS['heavy_rainfall']:
        alerts.append({
            'type': 'HEAVY_RAINFALL',
            'severity': 'HIGH',
            'message': f"Heavy rainfall expected: {forecast['rainfall']}mm"
        })
    
    if forecast['temperature'] > CRITICAL_THRESHOLDS['extreme_heat']:
        alerts.append({
            'type': 'EXTREME_HEAT',
            'severity': 'HIGH',
            'message': f"Extreme heat warning: {forecast['temperature']}°C"
        })
    
    if forecast['temperature'] < CRITICAL_THRESHOLDS['frost']:
        alerts.append({
            'type': 'FROST',
            'severity': 'CRITICAL',
            'message': f"Frost warning: {forecast['temperature']}°C"
        })
    
    return alerts

async def send_critical_alerts(alerts, affected_farmers):
    for alert in alerts:
        for farmer in affected_farmers:
            await sms_gateway.send({
                'to': farmer.phone,
                'message': f"⚠️ {alert['message']} - KrishiAI Alert",
                'priority': 'HIGH'
            })
```

**Water Advisory Algorithm**:
```python
# FAO-56 Penman-Monteith equation implementation
def calculate_reference_et(weather_data):
    """Calculate reference evapotranspiration (ET0) using FAO-56 Penman-Monteith"""
    # Constants
    SOLAR_CONSTANT = 0.082  # MJ m-2 min-1
    
    # Extract weather parameters
    temp_max = weather_data['temp_max']
    temp_min = weather_data['temp_min']
    temp_mean = (temp_max + temp_min) / 2
    humidity = weather_data['humidity']
    wind_speed = weather_data['wind_speed']  # m/s at 2m height
    solar_radiation = weather_data['solar_radiation']  # MJ m-2 day-1
    
    # Saturation vapor pressure
    es = (0.6108 * math.exp(17.27 * temp_max / (temp_max + 237.3)) +
          0.6108 * math.exp(17.27 * temp_min / (temp_min + 237.3))) / 2
    
    # Actual vapor pressure
    ea = es * (humidity / 100)
    
    # Slope of saturation vapor pressure curve
    delta = 4098 * es / ((temp_mean + 237.3) ** 2)
    
    # Psychrometric constant
    gamma = 0.665 * 10**-3 * 101.3  # kPa/°C at sea level
    
    # Net radiation (simplified)
    rn = solar_radiation * 0.77  # MJ m-2 day-1
    
    # Soil heat flux (negligible for daily calculations)
    g = 0
    
    # Reference ET0 (mm/day)
    numerator = 0.408 * delta * (rn - g) + gamma * (900 / (temp_mean + 273)) * wind_speed * (es - ea)
    denominator = delta + gamma * (1 + 0.34 * wind_speed)
    
    et0 = numerator / denominator
    return et0

# Crop coefficients by growth stage
CROP_COEFFICIENTS = {
    'rice': {'initial': 1.05, 'mid': 1.20, 'late': 0.90},
    'wheat': {'initial': 0.40, 'mid': 1.15, 'late': 0.40},
    'cotton': {'initial': 0.35, 'mid': 1.15, 'late': 0.70},
    'tomato': {'initial': 0.60, 'mid': 1.15, 'late': 0.80},
    'onion': {'initial': 0.70, 'mid': 1.05, 'late': 0.85},
    'sugarcane': {'initial': 0.40, 'mid': 1.25, 'late': 0.75}
}

def calculate_irrigation_need(crop, growth_stage, soil_moisture, weather, recent_rainfall):
    """Calculate daily irrigation recommendation"""
    # Calculate reference ET
    et0 = calculate_reference_et(weather)
    
    # Get crop coefficient
    kc = CROP_COEFFICIENTS.get(crop.name.lower(), {}).get(growth_stage, 1.0)
    
    # Calculate crop evapotranspiration (ETc)
    etc = et0 * kc
    
    # Effective rainfall (80% of actual rainfall is effective)
    effective_rainfall = recent_rainfall * 0.8
    
    # Soil moisture contribution (estimated from soil type and moisture level)
    soil_contribution = soil_moisture * 0.5  # mm
    
    # Calculate water deficit
    water_deficit = etc - effective_rainfall - soil_contribution
    
    # Irrigation threshold (irrigate if deficit > 5mm)
    threshold = 5.0
    
    if water_deficit > threshold:
        # Calculate water saved compared to traditional fixed schedule
        traditional_amount = 50  # mm (typical fixed irrigation)
        optimized_amount = water_deficit
        water_saved = max(0, traditional_amount - optimized_amount)
        
        return {
            'irrigate': True,
            'amount_mm': round(water_deficit, 2),
            'timing': 'morning' if weather['temp_max'] < 30 else 'evening',
            'reason': f'Crop water deficit: {round(water_deficit, 2)}mm',
            'water_saved_mm': round(water_saved, 2),
            'etc': round(etc, 2),
            'effective_rainfall': round(effective_rainfall, 2)
        }
    else:
        return {
            'irrigate': False,
            'reason': 'Sufficient soil moisture and recent rainfall',
            'water_saved_mm': 50,  # Full traditional irrigation amount saved
            'etc': round(etc, 2),
            'effective_rainfall': round(effective_rainfall, 2)
        }

def track_water_savings(farm_id, recommendations):
    """Track cumulative water savings over time"""
    total_saved = sum(r['water_saved_mm'] for r in recommendations)
    total_traditional = len(recommendations) * 50  # Traditional fixed schedule
    total_optimized = sum(r['amount_mm'] for r in recommendations if r['irrigate'])
    
    savings_percentage = (total_saved / total_traditional) * 100 if total_traditional > 0 else 0
    
    return {
        'total_water_saved_mm': round(total_saved, 2),
        'traditional_usage_mm': total_traditional,
        'optimized_usage_mm': round(total_optimized, 2),
        'savings_percentage': round(savings_percentage, 2)
    }
```

#### 2.2.5 Government Scheme Service
**Responsibility**: Government scheme discovery, eligibility filtering, notifications

**Technology**: Node.js + Express

**Endpoints**:
- `GET /api/v1/schemes/search` - Search schemes with filters
- `GET /api/v1/schemes/:id` - Get scheme details
- `GET /api/v1/schemes/eligible` - Get schemes eligible for user
- `POST /api/v1/schemes/alerts/subscribe` - Subscribe to deadline alerts

**Database Schema**:
```sql
CREATE TABLE government_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_name VARCHAR(200) NOT NULL,
    scheme_name_hi VARCHAR(200),
    scheme_name_mr VARCHAR(200),
    description TEXT,
    description_hi TEXT,
    description_mr TEXT,
    benefits_amount DECIMAL(12,2),
    benefits_description TEXT,
    benefits_description_hi TEXT,
    benefits_description_mr TEXT,
    eligibility_criteria JSONB,
    required_documents JSONB,
    application_deadline DATE,
    application_link VARCHAR(500),
    scheme_type VARCHAR(50),
    state VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_updated TIMESTAMP DEFAULT NOW(),
    INDEX idx_scheme_type (scheme_type),
    INDEX idx_state (state),
    INDEX idx_deadline (application_deadline),
    INDEX idx_active (is_active)
);

CREATE TABLE scheme_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    scheme_id UUID REFERENCES government_schemes(id),
    subscribed_at TIMESTAMP DEFAULT NOW(),
    notification_sent BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, scheme_id),
    INDEX idx_user_scheme (user_id, scheme_id)
);
```

**Eligibility Filtering Logic**:
```javascript
const filterEligibleSchemes = async (farmer, schemes) => {
  const eligible = []
  
  for (const scheme of schemes) {
    const criteria = scheme.eligibility_criteria
    let isEligible = true
    
    // Check land size eligibility
    if (criteria.max_land_hectares && farmer.farm.size_hectares > criteria.max_land_hectares) {
      isEligible = false
    }
    
    if (criteria.min_land_hectares && farmer.farm.size_hectares < criteria.min_land_hectares) {
      isEligible = false
    }
    
    // Check crop type eligibility
    if (criteria.crop_types && criteria.crop_types.length > 0) {
      const farmerCrops = await farmer.getCurrentCrops()
      const hasCrop = farmerCrops.some(c => criteria.crop_types.includes(c.crop_name))
      if (!hasCrop) {
        isEligible = false
      }
    }
    
    // Check location eligibility
    if (criteria.states && !criteria.states.includes(farmer.state)) {
      isEligible = false
    }
    
    // Check farmer category
    if (criteria.farmer_categories && !criteria.farmer_categories.includes(farmer.category)) {
      isEligible = false
    }
    
    if (isEligible) {
      eligible.push(scheme)
    }
  }
  
  return eligible
}
```

**Weekly Scheme Update Process**:
```javascript
const cron = require('node-cron')

const updateGovernmentSchemes = async () => {
  const sources = [
    { name: 'PM-KISAN', url: 'https://pmkisan.gov.in/api/schemes' },
    { name: 'PMFBY', url: 'https://pmfby.gov.in/api/schemes' },
    { name: 'KCC', url: 'https://kcc.gov.in/api/schemes' },
    // State-specific sources
    { name: 'Maharashtra', url: 'https://krishi.maharashtra.gov.in/api/schemes' }
  ]
  
  for (const source of sources) {
    try {
      const schemes = await fetchSchemes(source.url)
      
      for (const scheme of schemes) {
        await upsertScheme({
          scheme_name: scheme.name,
          scheme_name_hi: scheme.name_hi,
          scheme_name_mr: scheme.name_mr,
          description: scheme.description,
          description_hi: scheme.description_hi,
          description_mr: scheme.description_mr,
          benefits_amount: scheme.benefits,
          eligibility_criteria: scheme.eligibility,
          required_documents: scheme.documents,
          application_deadline: scheme.deadline,
          application_link: scheme.apply_url,
          scheme_type: scheme.type,
          state: scheme.state,
          last_updated: new Date()
        })
      }
      
      logger.info(`Updated schemes from ${source.name}`)
    } catch (error) {
      logger.error(`Failed to update schemes from ${source.name}:`, error)
    }
  }
}

// Run weekly on Sunday at 2:00 AM
cron.schedule('0 2 * * 0', updateGovernmentSchemes)
```

**Deadline Notification System**:
```javascript
const sendDeadlineReminders = async () => {
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  
  // Find schemes with deadlines in 7 days
  const upcomingSchemes = await db.query(`
    SELECT s.*, sub.user_id, u.phone
    FROM government_schemes s
    JOIN scheme_subscriptions sub ON s.id = sub.scheme_id
    JOIN users u ON sub.user_id = u.id
    WHERE s.application_deadline <= $1
      AND s.application_deadline >= CURRENT_DATE
      AND sub.notification_sent = FALSE
      AND s.is_active = TRUE
  `, [sevenDaysFromNow])
  
  for (const scheme of upcomingSchemes) {
    await sms_gateway.send({
      to: scheme.phone,
      message: `⏰ Reminder: ${scheme.scheme_name} deadline is ${scheme.application_deadline}. Apply now: ${scheme.application_link} - KrishiAI`
    })
    
    // Mark notification as sent
    await db.query(`
      UPDATE scheme_subscriptions
      SET notification_sent = TRUE
      WHERE user_id = $1 AND scheme_id = $2
    `, [scheme.user_id, scheme.id])
  }
}

// Run daily at 9:00 AM
cron.schedule('0 9 * * *', sendDeadlineReminders)
```

#### 2.2.6 Chatbot Service
**Responsibility**: Voice and text-based conversational interface

**Technology**: Python + FastAPI + IndicBERT

**Endpoints**:
- `POST /api/v1/chatbot/query` - Process text query
- `POST /api/v1/chatbot/voice` - Process voice query
- `GET /api/v1/chatbot/history` - Get conversation history

**Database Schema**:
```sql
CREATE TABLE chatbot_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    query_text TEXT NOT NULL,
    query_language VARCHAR(5),
    intent VARCHAR(50),
    confidence DECIMAL(5,4),
    response_text TEXT,
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_time (user_id, created_at DESC)
);

CREATE TABLE chatbot_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intent_name VARCHAR(50) UNIQUE NOT NULL,
    intent_patterns JSONB,
    response_templates JSONB,
    requires_context BOOLEAN DEFAULT FALSE,
    INDEX idx_intent_name (intent_name)
);
```

**Intent Recognition System**:
```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

# Load IndicBERT model fine-tuned for farming intents
tokenizer = AutoTokenizer.from_pretrained("ai4bharat/indic-bert")
model = AutoModelForSequenceClassification.from_pretrained("./models/farming-intent-classifier")

# Supported intents (20+ farming-related intents)
INTENTS = [
    'weather_query', 'price_query', 'disease_identification',
    'crop_recommendation', 'irrigation_advice', 'scheme_information',
    'pest_control', 'fertilizer_advice', 'market_information',
    'sowing_time', 'harvest_time', 'soil_health',
    'organic_farming', 'loan_information', 'insurance_query',
    'subsidy_query', 'general_farming', 'equipment_advice',
    'storage_advice', 'transport_help'
]

def recognize_intent(query_text, language='hi'):
    """Recognize farming intent from user query with 85% accuracy target"""
    inputs = tokenizer(query_text, return_tensors="pt", padding=True, 
                      truncation=True, max_length=128)
    
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probabilities = torch.softmax(logits, dim=1)
        
    confidence, predicted_class = torch.max(probabilities, dim=1)
    intent = INTENTS[predicted_class.item()]
    
    return {
        'intent': intent,
        'confidence': confidence.item(),
        'language': language
    }

# Response templates by intent and language
RESPONSE_TEMPLATES = {
    'weather_query': {
        'hi': 'आपके क्षेत्र में आज का मौसम: {weather}। अगले 7 दिनों का पूर्वानुमान देखने के लिए मौसम अनुभाग देखें।',
        'mr': 'तुमच्या क्षेत्रात आजचे हवामान: {weather}. पुढील 7 दिवसांचा अंदाज पाहण्यासाठी हवामान विभाग पहा.'
    },
    'price_query': {
        'hi': '{crop} का आज का भाव: ₹{price}/किलो। नजदीकी मंडियों में कीमतें देखने के लिए बाजार अनुभाग देखें।',
        'mr': '{crop} चा आजचा भाव: ₹{price}/किलो. जवळच्या मंडींमधील किंमती पाहण्यासाठी बाजार विभाग पहा.'
    },
    'disease_identification': {
        'hi': 'रोग पहचान के लिए पौधे की तस्वीर लें। कैमरा आइकन पर क्लिक करें।',
        'mr': 'रोग ओळखण्यासाठी झाडाचा फोटो घ्या. कॅमेरा आयकॉनवर क्लिक करा.'
    },
    'scheme_information': {
        'hi': 'आपके लिए {count} योजनाएं उपलब्ध हैं। योजना अनुभाग में विवरण देखें।',
        'mr': 'तुमच्यासाठी {count} योजना उपलब्ध आहेत. योजना विभागात तपशील पहा.'
    }
}

# Fallback responses for low confidence (<85%)
FALLBACK_RESPONSES = {
    'hi': 'मुझे आपका सवाल समझ नहीं आया। कृपया दोबारा पूछें या सहायता अनुभाग देखें।',
    'mr': 'मला तुमचा प्रश्न समजला नाही. कृपया पुन्हा विचारा किंवा मदत विभाग पहा.'
}

async def generate_response(intent, context, language='hi'):
    """Generate contextual response based on intent - target <1s for cached"""
    template = RESPONSE_TEMPLATES.get(intent, {}).get(language, '')
    
    if intent == 'weather_query':
        weather = await get_current_weather(context['location'])
        return template.format(weather=weather['description'])
    
    elif intent == 'price_query':
        crop = extract_crop_name(context['query'])
        price = await get_current_price(crop, context['location'])
        return template.format(crop=crop, price=price)
    
    elif intent == 'scheme_information':
        schemes = await get_eligible_schemes(context['user_id'])
        return template.format(count=len(schemes))
    
    return template

async def process_query(query_text, user_id, language='hi'):
    """Process chatbot query and generate response"""
    start_time = time.time()
    
    # Recognize intent
    intent_result = recognize_intent(query_text, language)
    
    # Check confidence threshold (85%)
    if intent_result['confidence'] < 0.85:
        response = FALLBACK_RESPONSES[language]
        intent = 'fallback'
    else:
        context = {
            'user_id': user_id,
            'query': query_text,
            'location': await get_user_location(user_id)
        }
        response = await generate_response(intent_result['intent'], context, language)
        intent = intent_result['intent']
    
    response_time = int((time.time() - start_time) * 1000)
    
    # Store conversation history for offline access
    await db.execute("""
        INSERT INTO chatbot_conversations 
        (user_id, query_text, query_language, intent, confidence, response_text, response_time_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    """, user_id, query_text, language, intent, intent_result['confidence'], response, response_time)
    
    return {
        'response': response,
        'intent': intent,
        'confidence': intent_result['confidence'],
        'response_time_ms': response_time
    }
```

**Voice Processing Integration**:
```javascript
// Mobile app voice processing using on-device Google Speech-to-Text
const processVoiceQuery = async (language) => {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
  recognition.lang = language === 'hi' ? 'hi-IN' : 'mr-IN'
  recognition.continuous = false
  recognition.interimResults = false
  
  return new Promise((resolve, reject) => {
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript
      
      // Send to chatbot service
      const response = await api.post('/chatbot/query', {
        query: transcript,
        language: language
      })
      
      // Text-to-speech for response (on-device)
      const utterance = new SpeechSynthesisUtterance(response.data.response)
      utterance.lang = language === 'hi' ? 'hi-IN' : 'mr-IN'
      window.speechSynthesis.speak(utterance)
      
      resolve(response.data)
    }
    
    recognition.onerror = reject
    recognition.start()
  })
}
```

---

## 3. Data Flow Diagrams

### 3.1 User Registration Flow


```
User → Mobile App → API Gateway → Auth Service → SMS Gateway
                                        ↓
                                   Generate OTP
                                        ↓
                                  Store in Redis
                                        ↓
User ← SMS ← SMS Gateway ← Auth Service
                                        
User enters OTP → Mobile App → Auth Service → Verify OTP
                                        ↓
                                  Generate JWT
                                        ↓
                                 Store in PostgreSQL
                                        ↓
User ← JWT Token ← Mobile App ← Auth Service
```

### 3.2 Disease Detection Flow (Offline-First)

```
User captures image → Mobile App
                         ↓
                  Preprocess image
                         ↓
                  TFLite model inference (on-device)
                         ↓
                  Display result immediately
                         ↓
                  Add to sync queue
                         ↓
              [When internet available]
                         ↓
                  Upload to Cloud
                         ↓
                  Crop Service → Store in PostgreSQL
                         ↓
                  Update analytics
```

### 3.3 Crop Recommendation Flow

```
User requests recommendation → Mobile App
                                    ↓
                              Check cache (WatermelonDB)
                                    ↓
                         [If cached and fresh] → Return cached
                                    ↓
                         [If not cached] → API Gateway
                                    ↓
                              Crop Service
                                    ↓
                         Fetch farm data (PostgreSQL)
                                    ↓
                         Fetch weather data (Climate Service)
                                    ↓
                         Fetch price data (Market Service)
                                    ↓
                         ML model inference (<500ms)
                                    ↓
                         Return top 3 recommendations
                                    ↓
Mobile App ← Cache for 24h (WatermelonDB) ← API Gateway
     ↓
Display to user
```

### 3.4 Government Scheme Discovery Flow

```
User searches schemes → Mobile App
                            ↓
                    Check cached schemes (WatermelonDB)
                            ↓
                    [If cache valid] → Filter by eligibility
                            ↓
                    [If cache stale] → API Gateway
                            ↓
                    Government Scheme Service
                            ↓
                    Fetch all active schemes (PostgreSQL)
                            ↓
                    Apply eligibility filters:
                    - Land size
                    - Crop type
                    - Location
                    - Farmer category
                            ↓
                    Return filtered schemes
                            ↓
Mobile App ← Cache indefinitely ← API Gateway
     ↓
Display schemes in selected language (Hindi/Marathi)
     ↓
[User subscribes to deadline alerts]
     ↓
Store subscription → Sync Queue → Cloud
     ↓
Daily cron job checks deadlines
     ↓
Send SMS 7 days before deadline
```

### 3.5 Voice Chatbot Interaction Flow

```
User speaks query → Mobile App
                        ↓
                On-device Speech-to-Text (Google)
                        ↓
                Convert audio to text
                        ↓
                Check conversation history cache
                        ↓
                [If similar query cached] → Return cached response
                        ↓
                [If new query] → API Gateway
                        ↓
                Chatbot Service
                        ↓
                IndicBERT intent recognition
                        ↓
                [Confidence >= 85%] → Generate contextual response
                        ↓
                [Confidence < 85%] → Return fallback response
                        ↓
                Store in conversation history
                        ↓
Mobile App ← Response text ← API Gateway
     ↓
On-device Text-to-Speech
     ↓
Play audio response to user
     ↓
Cache conversation for offline access
```

### 3.6 Weather Alert Flow

```
IMD API → Climate Service (every 6 hours)
              ↓
        Fetch weather forecasts
              ↓
        Store in PostgreSQL (TimescaleDB)
              ↓
        Check critical thresholds:
        - Rainfall > 100mm/day
        - Temperature > 45°C
        - Frost < 5°C
              ↓
        [Threshold exceeded] → Identify affected farmers
              ↓
        Query farms by location (5km radius)
              ↓
        Send immediate SMS alerts
              ↓
        Log alert in database
              ↓
Mobile App ← Push notification ← Firebase Cloud Messaging
     ↓
Display alert banner
```

### 3.7 Irrigation Advisory Flow

```
Daily cron job (6:00 AM) → Climate Service
                               ↓
                    For each active farm:
                               ↓
                    Fetch weather forecast
                               ↓
                    Fetch crop details
                               ↓
                    Fetch soil moisture (if available)
                               ↓
                    Calculate ET0 (FAO-56 Penman-Monteith)
                               ↓
                    Calculate ETc (crop coefficient)
                               ↓
                    Calculate water deficit
                               ↓
                    [Deficit > 5mm] → Recommend irrigation
                               ↓
                    [Deficit <= 5mm] → Skip irrigation
                               ↓
                    Calculate water saved vs traditional
                               ↓
                    Store recommendation (PostgreSQL)
                               ↓
                    Update cumulative savings
                               ↓
Mobile App ← Sync recommendation ← API Gateway
     ↓
Display irrigation card:
- Should irrigate: Yes/No
- Amount: X mm
- Timing: Morning/Evening
- Water saved: Y mm
```

---

## 4. Database Design

### 4.1 Schema Overview


**PostgreSQL Tables**:
- `users` - User accounts and profiles
- `otp_codes` - OTP verification codes
- `farms` - Farm information
- `crops` - Crop planting records
- `disease_detections` - Disease detection history
- `market_prices` - Historical price data (TimescaleDB)
- `weather_forecasts` - Weather data (TimescaleDB)
- `government_schemes` - Scheme information
- `sync_queue` - Server-side sync queue

**Redis Cache**:
- OTP codes (5-minute TTL)
- JWT blacklist (for logout)
- API response cache (1-hour TTL)
- Rate limiting counters

### 4.2 Indexing Strategy

**Performance Indexes**:
```sql
-- User lookup by phone
CREATE INDEX idx_users_phone ON users(phone);

-- Farm lookup by user
CREATE INDEX idx_farms_user ON farms(user_id);

-- Geospatial queries
CREATE INDEX idx_farms_location ON farms USING GIST(location);

-- Time-series queries
CREATE INDEX idx_market_prices_time ON market_prices(time DESC);
CREATE INDEX idx_weather_time ON weather_forecasts(time DESC);

-- Disease detection history
CREATE INDEX idx_disease_crop ON disease_detections(crop_id);
CREATE INDEX idx_disease_time ON disease_detections(detected_at DESC);
```

### 4.3 Data Retention Policy

- **User data**: Retained indefinitely (GDPR: delete on request)
- **OTP codes**: Auto-delete after 24 hours
- **Market prices**: 5 years (compressed after 1 year)
- **Weather data**: 2 years (compressed after 6 months)
- **Disease detections**: 3 years
- **Logs**: 90 days

---

## 5. API Design

### 5.1 API Standards


**RESTful Conventions**:
- Base URL: `https://api.krishiai.in/v1`
- Versioning: URL-based (`/v1`, `/v2`)
- HTTP methods: GET (read), POST (create), PUT (update), DELETE (delete)
- Status codes: 200 (success), 201 (created), 400 (bad request), 401 (unauthorized), 404 (not found), 500 (server error)

**Request/Response Format**:
```json
// Request
{
  "data": { /* payload */ },
  "metadata": {
    "requestId": "uuid",
    "timestamp": "2026-01-16T10:30:00Z"
  }
}

// Success Response
{
  "success": true,
  "data": { /* response data */ },
  "metadata": {
    "requestId": "uuid",
    "timestamp": "2026-01-16T10:30:01Z",
    "processingTime": 120
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Phone number is required",
    "details": { "field": "phone" }
  },
  "metadata": {
    "requestId": "uuid",
    "timestamp": "2026-01-16T10:30:01Z"
  }
}
```

### 5.2 Authentication

**JWT Token Structure**:
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "uuid",
    "phone": "+919876543210",
    "role": "farmer",
    "iat": 1736913600,
    "exp": 1737518400
  }
}
```

**Authorization Header**:
```
Authorization: Bearer <jwt_token>
```

### 5.3 Rate Limiting

**Limits by Endpoint Type**:
- Authentication: 5 requests/hour per phone
- Read operations: 1000 requests/hour per user
- Write operations: 100 requests/hour per user
- ML inference: 50 requests/hour per user (free tier)

**Rate Limit Headers**:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1736917200
```

---

## 6. Offline Architecture

### 6.1 Local Database (WatermelonDB)


**Schema Definition**:
```javascript
// User model
class User extends Model {
  static table = 'users'
  static associations = {
    farms: { type: 'has_many', foreignKey: 'user_id' }
  }
  
  @field('phone') phone
  @field('name') name
  @field('language') language
  @date('last_synced_at') lastSyncedAt
}

// Farm model
class Farm extends Model {
  static table = 'farms'
  static associations = {
    user: { type: 'belongs_to', key: 'user_id' },
    crops: { type: 'has_many', foreignKey: 'farm_id' }
  }
  
  @field('user_id') userId
  @field('location') location  // JSON: {lat, lng}
  @field('size_hectares') sizeHectares
  @field('soil_type') soilType
  @field('irrigation_type') irrigationType
}

// Crop model
class Crop extends Model {
  static table = 'crops'
  static associations = {
    farm: { type: 'belongs_to', key: 'farm_id' }
  }
  
  @field('farm_id') farmId
  @field('crop_name') cropName
  @field('variety') variety
  @date('sowing_date') sowingDate
  @date('expected_harvest') expectedHarvest
  @field('status') status
}

// Cached weather data (7 days retention)
class CachedWeather extends Model {
  static table = 'cached_weather'
  @field('location') location  // JSON: {lat, lng}
  @json('forecast_data', sanitizeJson) forecastData
  @date('cached_at') cachedAt
  @date('expires_at') expiresAt
}

// Cached market prices (90 days retention)
class CachedPrice extends Model {
  static table = 'cached_prices'
  @field('crop_name') cropName
  @field('market_name') marketName
  @field('location') location
  @field('price_per_kg') pricePerKg
  @field('trend') trend  // 'up', 'down', 'stable'
  @date('price_date') priceDate
  @date('cached_at') cachedAt
}

// Cached government schemes (indefinite retention)
class CachedScheme extends Model {
  static table = 'cached_schemes'
  @field('scheme_id') schemeId
  @field('scheme_name') schemeName
  @field('scheme_name_local') schemeNameLocal
  @json('description', sanitizeJson) description
  @json('eligibility', sanitizeJson) eligibility
  @json('documents', sanitizeJson) documents
  @date('deadline') deadline
  @field('application_link') applicationLink
  @date('cached_at') cachedAt
}

// Disease detection history
class DiseaseDetection extends Model {
  static table = 'disease_detections'
  @field('crop_id') cropId
  @field('image_uri') imageUri
  @field('disease_name') diseaseName
  @field('disease_name_local') diseaseNameLocal
  @field('confidence') confidence
  @field('severity') severity
  @json('treatment', sanitizeJson) treatment
  @date('detected_at') detectedAt
  @field('synced') synced
}

// Chatbot conversation history
class ChatConversation extends Model {
  static table = 'chat_conversations'
  @field('query_text') queryText
  @field('response_text') responseText
  @field('intent') intent
  @field('language') language
  @date('created_at') createdAt
}

// Irrigation recommendations
class IrrigationRecommendation extends Model {
  static table = 'irrigation_recommendations'
  @field('farm_id') farmId
  @field('crop_id') cropId
  @field('should_irrigate') shouldIrrigate
  @field('water_amount_mm') waterAmountMm
  @field('timing') timing
  @field('water_saved_mm') waterSavedMm
  @date('recommendation_date') recommendationDate
  @date('cached_at') cachedAt
}
```

**Cache Expiration Strategy**:
```javascript
// Automatic cache cleanup
const cleanupExpiredCache = async () => {
  const now = new Date()
  
  // Remove weather forecasts older than 7 days
  await database.write(async () => {
    const expiredWeather = await database.collections
      .get('cached_weather')
      .query(Q.where('expires_at', Q.lt(now.getTime())))
      .fetch()
    
    await Promise.all(expiredWeather.map(w => w.markAsDeleted()))
  })
  
  // Remove market prices older than 90 days
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  await database.write(async () => {
    const expiredPrices = await database.collections
      .get('cached_prices')
      .query(Q.where('cached_at', Q.lt(ninetyDaysAgo.getTime())))
      .fetch()
    
    await Promise.all(expiredPrices.map(p => p.markAsDeleted()))
  })
}

// Run cleanup daily
setInterval(cleanupExpiredCache, 24 * 60 * 60 * 1000)
```

**Data Freshness Indicators**:
```javascript
const getDataFreshness = (cachedAt) => {
  const now = new Date()
  const ageMs = now - cachedAt
  const ageHours = ageMs / (1000 * 60 * 60)
  
  if (ageHours < 1) {
    return { status: 'fresh', label: 'Just now', color: 'green' }
  } else if (ageHours < 6) {
    return { status: 'recent', label: `${Math.floor(ageHours)}h ago`, color: 'green' }
  } else if (ageHours < 24) {
    return { status: 'stale', label: `${Math.floor(ageHours)}h ago`, color: 'orange' }
  } else {
    const ageDays = Math.floor(ageHours / 24)
    return { status: 'old', label: `${ageDays}d ago`, color: 'red' }
  }
}

// Display in UI
<View style={styles.dataCard}>
  <Text>{data.value}</Text>
  <View style={[styles.freshnessIndicator, { backgroundColor: freshness.color }]}>
    <Text style={styles.freshnessText}>Last updated: {freshness.label}</Text>
  </View>
</View>
```

### 6.2 Sync Queue Implementation

**Queue Structure**:
```javascript
class SyncQueueItem extends Model {
  static table = 'sync_queue'
  
  @field('action') action  // CREATE, UPDATE, DELETE
  @field('entity_type') entityType  // disease_detection, crop, farm, etc.
  @json('payload', sanitizeJson) payload
  @field('priority') priority  // CRITICAL, HIGH, MEDIUM, LOW
  @field('status') status  // PENDING, SYNCING, COMPLETED, FAILED
  @field('retry_count') retryCount
  @field('error_message') errorMessage
  @date('created_at') createdAt
  @date('synced_at') syncedAt
}
```

**Priority Levels**:
```javascript
const SYNC_PRIORITIES = {
  CRITICAL: 1,  // Authentication, user profile
  HIGH: 2,      // Disease detections, crop updates
  MEDIUM: 3,    // Farm profile updates, scheme subscriptions
  LOW: 4        // Analytics, usage logs
}

const getPriority = (entityType) => {
  const priorityMap = {
    'auth': SYNC_PRIORITIES.CRITICAL,
    'user_profile': SYNC_PRIORITIES.CRITICAL,
    'disease_detection': SYNC_PRIORITIES.HIGH,
    'crop': SYNC_PRIORITIES.HIGH,
    'farm': SYNC_PRIORITIES.MEDIUM,
    'scheme_subscription': SYNC_PRIORITIES.MEDIUM,
    'analytics': SYNC_PRIORITIES.LOW
  }
  return priorityMap[entityType] || SYNC_PRIORITIES.LOW
}
```

**Sync Strategy with Exponential Backoff**:
```javascript
const syncQueue = async () => {
  // Check network connectivity
  const netInfo = await NetInfo.fetch()
  if (!netInfo.isConnected) {
    console.log('No network connection, skipping sync')
    return
  }
  
  // Fetch pending items ordered by priority and creation time
  const items = await database.collections
    .get('sync_queue')
    .query(
      Q.where('status', Q.oneOf(['PENDING', 'FAILED'])),
      Q.where('retry_count', Q.lt(3)),  // Max 3 retries
      Q.sortBy('priority', Q.asc),
      Q.sortBy('created_at', Q.asc)
    )
    .fetch()
  
  console.log(`Syncing ${items.length} items`)
  
  for (const item of items) {
    try {
      // Update status to SYNCING
      await database.write(async () => {
        await item.update(i => {
          i.status = 'SYNCING'
        })
      })
      
      // Perform sync based on entity type
      await syncItem(item)
      
      // Mark as completed
      await database.write(async () => {
        await item.update(i => {
          i.status = 'COMPLETED'
          i.syncedAt = new Date()
        })
      })
      
      console.log(`Synced ${item.entityType} successfully`)
      
    } catch (error) {
      console.error(`Failed to sync ${item.entityType}:`, error)
      
      // Calculate exponential backoff delay
      const backoffDelay = Math.pow(2, item.retryCount) * 1000  // 1s, 2s, 4s
      
      await database.write(async () => {
        await item.update(i => {
          i.retryCount += 1
          i.errorMessage = error.message
          
          // Mark as FAILED after 3 attempts
          if (i.retryCount >= 3) {
            i.status = 'FAILED'
          } else {
            i.status = 'PENDING'
          }
        })
      })
      
      // Wait before next retry
      if (item.retryCount < 3) {
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
      }
    }
  }
}

const syncItem = async (item) => {
  const { action, entityType, payload } = item
  
  switch (entityType) {
    case 'disease_detection':
      if (action === 'CREATE') {
        // Upload image first
        const imageUrl = await uploadImage(payload.imageUri)
        
        // Create detection record
        await api.post('/api/v1/crop/disease/detect', {
          ...payload,
          imageUrl
        })
      }
      break
      
    case 'crop':
      if (action === 'CREATE') {
        await api.post('/api/v1/crop', payload)
      } else if (action === 'UPDATE') {
        await api.put(`/api/v1/crop/${payload.id}`, payload)
      }
      break
      
    case 'farm':
      if (action === 'UPDATE') {
        await api.put(`/api/v1/farm/${payload.id}`, payload)
      }
      break
      
    case 'scheme_subscription':
      if (action === 'CREATE') {
        await api.post('/api/v1/schemes/alerts/subscribe', payload)
      }
      break
      
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}
```

**Auto-sync Triggers**:
```javascript
// 1. WiFi connectivity detected
NetInfo.addEventListener(state => {
  if (state.isConnected && state.type === 'wifi') {
    console.log('WiFi connected, starting auto-sync')
    syncQueue()
  }
})

// 2. App comes to foreground
AppState.addEventListener('change', nextAppState => {
  if (nextAppState === 'active') {
    console.log('App active, checking sync queue')
    syncQueue()
  }
})

// 3. Manual sync button
const handleManualSync = async () => {
  setIsSyncing(true)
  try {
    await syncQueue()
    Alert.alert('Success', 'Data synced successfully')
  } catch (error) {
    Alert.alert('Error', 'Failed to sync data')
  } finally {
    setIsSyncing(false)
  }
}

// 4. Periodic background sync (every 15 minutes when app is active)
useEffect(() => {
  const interval = setInterval(() => {
    syncQueue()
  }, 15 * 60 * 1000)
  
  return () => clearInterval(interval)
}, [])
```

**Sync Status UI Component**:
```javascript
const SyncStatusIndicator = () => {
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState(null)
  
  useEffect(() => {
    const subscription = database.collections
      .get('sync_queue')
      .query(Q.where('status', 'PENDING'))
      .observeCount()
      .subscribe(count => setPendingCount(count))
    
    return () => subscription.unsubscribe()
  }, [])
  
  return (
    <View style={styles.syncStatus}>
      {isSyncing ? (
        <ActivityIndicator size="small" color="#4CAF50" />
      ) : (
        <Icon name="cloud-done" size={20} color="#4CAF50" />
      )}
      
      <Text style={styles.syncText}>
        {pendingCount > 0 
          ? `${pendingCount} items pending sync`
          : 'All data synced'}
      </Text>
      
      {lastSyncTime && (
        <Text style={styles.lastSyncText}>
          Last synced: {formatRelativeTime(lastSyncTime)}
        </Text>
      )}
      
      <TouchableOpacity onPress={handleManualSync}>
        <Icon name="refresh" size={20} color="#2196F3" />
      </TouchableOpacity>
    </View>
  )
}
```

**Data Compression for Upload**:
```javascript
const compressPayload = async (payload) => {
  const jsonString = JSON.stringify(payload)
  
  // Use gzip compression
  const compressed = await gzip(jsonString)
  
  // Calculate compression ratio
  const originalSize = jsonString.length
  const compressedSize = compressed.length
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1)
  
  console.log(`Compressed ${originalSize} bytes to ${compressedSize} bytes (${ratio}% reduction)`)
  
  return compressed
}

const uploadCompressed = async (endpoint, payload) => {
  const compressed = await compressPayload(payload)
  
  return await api.post(endpoint, compressed, {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Encoding': 'gzip'
    }
  })
}
```

### 6.3 Conflict Resolution

**Last-Write-Wins Strategy**:
```javascript
const resolveConflict = (local, remote) => {
  if (local.updatedAt > remote.updatedAt) {
    // Local is newer, push to server
    return { action: 'PUSH', data: local }
  } else {
    // Remote is newer, pull from server
    return { action: 'PULL', data: remote }
  }
}
```

---

## 7. AI/ML Model Design

### 7.1 Disease Detection Model


**Model Architecture**:
```python
# MobileNetV3-Small for edge deployment
base_model = tf.keras.applications.MobileNetV3Small(
    input_shape=(224, 224, 3),
    include_top=False,
    weights='imagenet'
)

# Custom classification head
model = Sequential([
    base_model,
    GlobalAveragePooling2D(),
    Dense(256, activation='relu'),
    Dropout(0.3),
    Dense(120, activation='softmax')  # 120 disease classes
])

# Compile
model.compile(
    optimizer=Adam(learning_rate=0.001),
    loss='categorical_crossentropy',
    metrics=['accuracy', 'top_k_categorical_accuracy']
)
```

**Training Pipeline**:
```python
# Data augmentation
train_datagen = ImageDataGenerator(
    rotation_range=20,
    width_shift_range=0.2,
    height_shift_range=0.2,
    horizontal_flip=True,
    zoom_range=0.2,
    brightness_range=[0.8, 1.2]
)

# Training
history = model.fit(
    train_generator,
    epochs=50,
    validation_data=val_generator,
    callbacks=[
        EarlyStopping(patience=5),
        ModelCheckpoint('best_model.h5'),
        ReduceLROnPlateau(factor=0.5, patience=3)
    ]
)

# Convert to TFLite for mobile
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()
```

**Inference Pipeline**:
```javascript
// Mobile app inference
const detectDisease = async (imageUri) => {
  // Load TFLite model
  const model = await tf.loadLayersModel('disease_detector.tflite')
  
  // Preprocess image
  const image = await loadImage(imageUri)
  const tensor = tf.browser.fromPixels(image)
    .resizeBilinear([224, 224])
    .expandDims(0)
    .div(255.0)
  
  // Inference
  const predictions = await model.predict(tensor)
  const topK = await getTopK(predictions, 3)
  
  return {
    disease: topK[0].class,
    confidence: topK[0].score,
    alternatives: topK.slice(1)
  }
}
```

### 7.2 Crop Recommendation Model

**Feature Engineering**:
```python
features = {
    # Soil features
    'soil_nitrogen': StandardScaler(),
    'soil_phosphorus': StandardScaler(),
    'soil_potassium': StandardScaler(),
    'soil_ph': MinMaxScaler(),
    'organic_carbon': StandardScaler(),
    
    # Climate features
    'rainfall_avg_3m': StandardScaler(),
    'temperature_avg_3m': StandardScaler(),
    'humidity_avg_3m': StandardScaler(),
    
    # Farm features
    'farm_size': StandardScaler(),
    'irrigation_type': OneHotEncoder(),
    'previous_crop': LabelEncoder(),
    
    # Market features
    'price_trend_30d': StandardScaler(),
    'demand_forecast': StandardScaler()
}
```

**Model Training**:
```python
# XGBoost classifier
model = XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    objective='multi:softprob',
    num_class=50  # 50 crop types
)

# Train with cross-validation
cv_scores = cross_val_score(
    model, X_train, y_train,
    cv=5, scoring='accuracy'
)

# Feature importance
importance = model.feature_importances_
```

### 7.3 Price Forecasting Model

**ARIMA Component** (Short-term):
```python
from statsmodels.tsa.arima.model import ARIMA

# Fit ARIMA model
model = ARIMA(price_series, order=(5, 1, 2))
fitted = model.fit()

# 7-day forecast
forecast_7d = fitted.forecast(steps=7)
```

**LSTM Component** (Medium-term):
```python
# LSTM architecture
model = Sequential([
    LSTM(64, return_sequences=True, input_shape=(30, 5)),
    Dropout(0.2),
    LSTM(32, return_sequences=False),
    Dropout(0.2),
    Dense(16, activation='relu'),
    Dense(7)  # 7-day forecast
])

model.compile(
    optimizer='adam',
    loss='mse',
    metrics=['mae']
)
```

---

## 8. Security Design

### 8.1 Authentication & Authorization


**OTP Generation**:
```javascript
const generateOTP = () => {
  // Cryptographically secure random 6-digit code
  const otp = crypto.randomInt(100000, 999999).toString()
  
  // Hash for storage
  const hashedOTP = bcrypt.hashSync(otp, 10)
  
  // Store in Redis with 5-minute expiry
  await redis.setex(`otp:${phone}`, 300, hashedOTP)
  
  return otp
}
```

**JWT Implementation**:
```javascript
const generateJWT = (user) => {
  const payload = {
    userId: user.id,
    phone: user.phone,
    role: 'farmer',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)  // 7 days
  }
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256'
  })
}

// Middleware for protected routes
const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
```

### 8.2 Data Encryption

**At Rest**:
```javascript
// Encrypt sensitive fields in database
const encryptPII = (data) => {
  const algorithm = 'aes-256-gcm'
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  }
}
```

**In Transit**:
- TLS 1.3 for all API communications
- Certificate pinning in mobile app
- HTTPS only (HSTS enabled)

### 8.3 Input Validation

**Request Validation Middleware**:
```javascript
const { body, validationResult } = require('express-validator')

const validateRegistration = [
  body('phone')
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage('Invalid Indian phone number'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('language')
    .isIn(['hi', 'mr', 'en'])
    .withMessage('Unsupported language'),
  
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    next()
  }
]
```

### 8.4 Rate Limiting

**Implementation**:
```javascript
const rateLimit = require('express-rate-limit')

// OTP rate limiter
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,  // 5 requests per hour
  keyGenerator: (req) => req.body.phone,
  message: 'Too many OTP requests, please try again later'
})

// API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 1000,  // 1000 requests per hour
  keyGenerator: (req) => req.user.userId,
  message: 'Rate limit exceeded'
})
```

---

## 9. Performance Optimization

### 9.1 Caching Strategy


**Redis Cache Layers**:
```javascript
// L1: API response cache (1 hour)
const cacheMiddleware = async (req, res, next) => {
  const key = `cache:${req.path}:${JSON.stringify(req.query)}`
  const cached = await redis.get(key)
  
  if (cached) {
    return res.json(JSON.parse(cached))
  }
  
  // Store original send function
  const originalSend = res.json
  res.json = function(data) {
    redis.setex(key, 3600, JSON.stringify(data))
    originalSend.call(this, data)
  }
  
  next()
}

// L2: Database query cache
const getCachedPrices = async (crop, location) => {
  const key = `prices:${crop}:${location}`
  let prices = await redis.get(key)
  
  if (!prices) {
    prices = await db.query(
      'SELECT * FROM market_prices WHERE crop_name = $1 AND location = $2',
      [crop, location]
    )
    await redis.setex(key, 3600, JSON.stringify(prices))
  }
  
  return JSON.parse(prices)
}
```

**Mobile App Cache**:
```javascript
// Cache weather forecasts
const cacheWeather = async (location, forecast) => {
  await database.write(async () => {
    await database.collections.get('cached_weather').create(weather => {
      weather.location = location
      weather.forecastData = forecast
      weather.cachedAt = new Date()
    })
  })
}

// Retrieve with freshness check
const getWeather = async (location) => {
  const cached = await database.collections
    .get('cached_weather')
    .query(Q.where('location', location))
    .fetch()
  
  if (cached.length > 0) {
    const age = Date.now() - cached[0].cachedAt.getTime()
    if (age < 6 * 60 * 60 * 1000) {  // 6 hours
      return cached[0].forecastData
    }
  }
  
  // Fetch fresh data
  return await fetchWeatherFromAPI(location)
}
```

### 9.2 Database Optimization

**Connection Pooling**:
```javascript
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: 'krishiai',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,  // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
})
```

**Query Optimization**:
```sql
-- Use prepared statements
PREPARE get_farm_crops AS
  SELECT * FROM crops WHERE farm_id = $1 AND status = $2;

-- Use indexes for common queries
CREATE INDEX idx_crops_farm_status ON crops(farm_id, status);

-- Partition large tables
CREATE TABLE market_prices_2026 PARTITION OF market_prices
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

### 9.3 Image Optimization

**Compression Pipeline**:
```javascript
const sharp = require('sharp')

const optimizeImage = async (imageBuffer) => {
  return await sharp(imageBuffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
}

// Upload to S3 with optimized image
const uploadImage = async (imageBuffer) => {
  const optimized = await optimizeImage(imageBuffer)
  
  const params = {
    Bucket: 'krishiai-images',
    Key: `disease/${uuid()}.webp`,
    Body: optimized,
    ContentType: 'image/webp',
    CacheControl: 'max-age=31536000'
  }
  
  return await s3.upload(params).promise()
}
```

---

## 10. Monitoring & Observability

### 10.1 Metrics Collection


**Prometheus Metrics**:
```javascript
const promClient = require('prom-client')

// HTTP request metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
})

// ML model metrics
const modelInferenceLatency = new promClient.Histogram({
  name: 'model_inference_latency_seconds',
  help: 'ML model inference latency',
  labelNames: ['model_name']
})

const modelAccuracy = new promClient.Gauge({
  name: 'model_accuracy',
  help: 'ML model accuracy',
  labelNames: ['model_name']
})

// Business metrics
const activeUsers = new promClient.Gauge({
  name: 'active_users',
  help: 'Number of active users'
})

// Middleware to track metrics
app.use((req, res, next) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration)
  })
  
  next()
})
```

### 10.2 Logging Strategy

**Structured Logging**:
```javascript
const winston = require('winston')

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'crop-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})

// Log with context
logger.info('Disease detection completed', {
  userId: user.id,
  cropId: crop.id,
  disease: result.disease,
  confidence: result.confidence,
  latency: duration
})
```

### 10.3 Error Tracking

**Sentry Integration**:
```javascript
const Sentry = require('@sentry/node')

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1
})

// Error handler middleware
app.use(Sentry.Handlers.errorHandler())

// Custom error tracking
const trackError = (error, context) => {
  Sentry.captureException(error, {
    tags: {
      service: 'crop-service',
      endpoint: context.endpoint
    },
    user: {
      id: context.userId
    }
  })
}
```

---

## 11. Deployment Architecture

### 11.1 Kubernetes Configuration


**Service Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crop-service
  namespace: krishiai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: crop-service
  template:
    metadata:
      labels:
        app: crop-service
    spec:
      containers:
      - name: crop-service
        image: krishiai/crop-service:1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: host
        - name: REDIS_URL
          value: redis://redis-service:6379
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

**Horizontal Pod Autoscaler**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: crop-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crop-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 11.2 CI/CD Pipeline

**GitHub Actions Workflow**:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Run linter
        run: npm run lint
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build Docker image
        run: |
          docker build -t krishiai/crop-service:${{ github.sha }} .
          docker tag krishiai/crop-service:${{ github.sha }} krishiai/crop-service:latest
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push krishiai/crop-service:${{ github.sha }}
          docker push krishiai/crop-service:latest
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/crop-service \
            crop-service=krishiai/crop-service:${{ github.sha }}
          kubectl rollout status deployment/crop-service
```

---

## Testing Strategy

### Dual Testing Approach

The KrishiAI MVP employs a comprehensive testing strategy combining unit tests and property-based tests to ensure both specific correctness and universal behavior validation.

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Focus on concrete scenarios and boundary conditions
- Test integration points between components
- Validate error handling and edge cases
- Target: >80% code coverage

**Property-Based Tests**: Verify universal properties across all inputs
- Test properties that should hold for any valid input
- Use randomized input generation for comprehensive coverage
- Validate system behavior under diverse conditions
- Minimum 100 iterations per property test

### Property-Based Testing Configuration

**Testing Framework Selection**:
- **JavaScript/Node.js**: fast-check library for property-based testing
- **Python**: Hypothesis library for ML model testing
- **React Native**: fast-check with Jest for mobile app testing

**Property Test Structure**:
```javascript
// Example property test structure
describe('Feature: krishiai-mvp, Property 1: OTP Generation and Validation', () => {
  it('should generate valid 6-digit OTPs that expire in exactly 5 minutes', 
    fc.asyncProperty(
      fc.string({ minLength: 10, maxLength: 13 }).filter(isValidPhoneNumber),
      async (phoneNumber) => {
        const otp = await generateOTP(phoneNumber)
        
        // Property assertions
        expect(otp).toMatch(/^\d{6}$/) // 6-digit format
        
        const ttl = await redis.ttl(`otp:${phoneNumber}`)
        expect(ttl).toBeGreaterThan(290) // ~5 minutes
        expect(ttl).toBeLessThanOrEqual(300)
        
        // Verify single validation
        const result1 = await verifyOTP(phoneNumber, otp)
        const result2 = await verifyOTP(phoneNumber, otp)
        expect(result1.success).toBe(true)
        expect(result2.success).toBe(false) // Can't reuse
      }
    ), { numRuns: 100 }
  )
})
```

**Property Test Requirements**:
- Each property test must reference its design document property number
- Tag format: `Feature: krishiai-mvp, Property {number}: {property_title}`
- Minimum 100 iterations per property test due to randomization
- Properties must be universally quantified ("for any", "for all")
- Each correctness property must be implemented by exactly one property-based test

### Testing Categories

**Authentication Testing**:
- Unit tests: Specific OTP codes, JWT token formats, error conditions
- Property tests: OTP generation for any valid phone number, rate limiting behavior, JWT validation

**AI/ML Model Testing**:
- Unit tests: Specific disease images, known crop conditions, error handling
- Property tests: Model accuracy across validation dataset, inference time for any image, deterministic behavior

**API Testing**:
- Unit tests: Specific endpoint responses, error codes, authentication flows
- Property tests: Response time for any valid request, rate limiting for any user, data consistency

**Mobile App Testing**:
- Unit tests: Specific UI interactions, navigation flows, error states
- Property tests: Offline functionality for any cached data, sync behavior for any queued items

**Data Integrity Testing**:
- Unit tests: Specific data transformations, validation rules, error cases
- Property tests: Cache duration for any data type, conflict resolution for any conflicting updates

### Performance Testing Integration

**Load Testing with Properties**:
```javascript
// Property-based load testing
describe('Feature: krishiai-mvp, Property 30: API Response Time Consistency', () => {
  it('should maintain <500ms response time for 95% of requests under load',
    fc.asyncProperty(
      fc.record({
        endpoint: fc.constantFrom('/api/v1/crop/recommend', '/api/v1/market/prices'),
        payload: fc.object(),
        concurrentUsers: fc.integer({ min: 1, max: 1000 })
      }),
      async ({ endpoint, payload, concurrentUsers }) => {
        const responses = await Promise.all(
          Array(concurrentUsers).fill().map(() => 
            measureResponseTime(endpoint, payload)
          )
        )
        
        const p95 = percentile(responses, 95)
        expect(p95).toBeLessThan(500) // 500ms requirement
      }
    ), { numRuns: 50 }
  )
})
```

### Test Data Management

**Property Test Data Generation**:
- **Phone Numbers**: Generate valid Indian phone numbers (+91 format)
- **Farm Data**: Generate realistic soil parameters, GPS coordinates, land sizes
- **Images**: Use synthetic plant disease images for consistent testing
- **Weather Data**: Generate realistic weather patterns within valid ranges
- **Market Data**: Generate price data with realistic volatility patterns

**Test Environment Setup**:
- Isolated test database with known seed data
- Mock external APIs (IMD, Agmarknet) with predictable responses
- Containerized test environment for consistency
- Automated test data cleanup between runs

### Continuous Testing Pipeline

**CI/CD Integration**:
1. **Unit Tests**: Run on every commit (fast feedback)
2. **Property Tests**: Run on pull requests (comprehensive validation)
3. **Integration Tests**: Run on staging deployment
4. **Performance Tests**: Run nightly (resource intensive)
5. **E2E Tests**: Run before production deployment

**Test Reporting**:
- Property test results with failure examples
- Coverage reports combining unit and property tests
- Performance metrics trending over time
- ML model accuracy tracking across test runs

### Property Test Failure Analysis

**When Property Tests Fail**:
1. **Capture Failing Example**: Property testing libraries provide minimal failing cases
2. **Root Cause Analysis**: Determine if it's a genuine bug or test assumption issue
3. **Fix and Verify**: Address the underlying issue and verify fix with property test
4. **Regression Prevention**: Ensure the failing case is covered in future runs

**Example Failure Handling**:
```javascript
// If Property 8 fails with specific input
// fast-check will provide minimal failing case:
{
  soilParams: { nitrogen: 0, phosphorus: 0, potassium: 0, ph: 14 },
  weather: { rainfall: -10, temperature: 60 },
  market: { priceVolatility: 1000 }
}

// This reveals edge case: extreme values cause recommendation failure
// Fix: Add input validation and boundary checks
// Verify: Property test passes with fixed validation
```

This comprehensive testing strategy ensures that the KrishiAI MVP is thoroughly validated through both specific scenarios and universal behavioral properties, providing confidence in system correctness and reliability.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Authentication Properties

**Property 1: OTP Generation and Validation**
*For any* valid Indian phone number, when an OTP is requested, the system should generate a 6-digit code that expires exactly 5 minutes after generation and can be validated only once within that timeframe
**Validates: Requirements 1.1, 1.2, 1.4**

**Property 2: Rate Limiting Consistency**
*For any* phone number, the system should enforce exactly 5 OTP requests per hour and 30-second intervals between resend requests
**Validates: Requirements 1.3, 1.5**

**Property 3: JWT Token Validity**
*For any* valid OTP verification, the system should issue a JWT token that grants access to protected endpoints for exactly 7 days
**Validates: Requirements 1.4, 15.3**

### Multi-Language Support Properties

**Property 4: UI Translation Completeness**
*For any* language selection (Hindi or Marathi), all UI elements should immediately translate to the selected language and persist across app sessions
**Validates: Requirements 2.2, 2.4, 2.5**

**Property 5: Voice I/O Language Consistency**
*For any* selected language, voice input recognition and text-to-speech output should function in that language with consistent accuracy
**Validates: Requirements 2.3, 9.1, 9.4**

### Farm Profile Management Properties

**Property 6: Location Detection and Conversion**
*For any* farm location, GPS coordinates should be detected within 10-meter accuracy, and land size conversions between hectares and acres should be mathematically correct (1 acre = 0.4047 hectares)
**Validates: Requirements 3.1, 3.3**

**Property 7: Farm Data Persistence**
*For any* farm profile data entered, the information should be stored locally and added to the sync queue for cloud backup
**Validates: Requirements 3.6**

### AI Crop Intelligence Properties

**Property 8: Crop Recommendation Performance and Structure**
*For any* crop recommendation request, the system should return exactly 3 ranked recommendations within 500ms, each containing yield, investment, revenue, water requirements, sowing window, and risk level
**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

**Property 9: Crop Recommendation Accuracy**
*For any* set of soil, weather, and market conditions, crop recommendations should achieve minimum 85% accuracy when validated against historical yield data
**Validates: Requirements 4.6**

**Property 10: Disease Detection Performance and Accuracy**
*For any* plant image, on-device disease detection should complete within 2 seconds and achieve minimum 90% accuracy for the 120 most common diseases, returning disease name in both local and scientific names with confidence and severity assessment
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

**Property 11: Disease Detection Offline Functionality**
*For any* plant image, disease detection should function completely offline and add detection records to sync queue when internet becomes available
**Validates: Requirements 5.6, 5.7**

**Property 12: Treatment Recommendation Structure**
*For any* detected disease, the system should provide organic treatment as primary recommendation and chemical alternatives as secondary options
**Validates: Requirements 5.5**

### Market Intelligence Properties

**Property 13: Market Price Geospatial Query**
*For any* farm location, market price requests should return current prices from exactly the 5 nearest mandis within 50 kilometers, updated daily at 6:00 AM IST
**Validates: Requirements 6.1, 6.2**

**Property 14: Price Trend Calculation**
*For any* price data, trend indicators should display up arrow for >2% increase, down arrow for >2% decrease, and horizontal arrow for stable prices
**Validates: Requirements 6.3**

**Property 15: Price Forecasting Accuracy**
*For any* crop and location, 7-day, 30-day, and 90-day price forecasts should achieve 85% accuracy (MAPE < 15%) when validated against actual prices
**Validates: Requirements 6.4**

**Property 16: Price Alert Notification**
*For any* target price alert set by a farmer, SMS notification should be sent when the target price is reached in any of the monitored mandis
**Validates: Requirements 6.6**

### Climate Intelligence Properties

**Property 17: Weather Forecast Updates and Accuracy**
*For any* location, weather forecasts should be updated every 6 hours from IMD API and achieve hyperlocal accuracy within 5-kilometer grid resolution
**Validates: Requirements 7.1, 7.2**

**Property 18: Critical Weather Alerting**
*For any* weather conditions exceeding thresholds (rainfall >100mm/day, temperature >45°C, frost <5°C), immediate SMS alerts should be sent to affected farmers
**Validates: Requirements 7.3**

**Property 19: Irrigation Calculation Accuracy**
*For any* crop, soil, and weather conditions, daily irrigation recommendations should be calculated using FAO-56 Penman-Monteith equation with mathematically correct results
**Validates: Requirements 7.4, 7.5**

**Property 20: Water Savings Tracking**
*For any* irrigation decision, cumulative water savings compared to traditional methods should be accurately tracked and displayed
**Validates: Requirements 7.6**

### Government Services Properties

**Property 21: Scheme Filtering and Display**
*For any* farmer profile, scheme search should filter results based on eligibility criteria (land size, crop type, location, farmer category) and display all required information (benefits, documents, deadline, application link) in Hindi and Marathi
**Validates: Requirements 8.2, 8.3, 8.4**

**Property 22: Scheme Update and Notification**
*For any* government scheme, data should be updated weekly from official portals, and deadline reminder notifications should be sent 7 days before application deadlines
**Validates: Requirements 8.1, 8.6**

**Property 23: Chatbot Intent Recognition and Response**
*For any* voice or text query in Hindi or Marathi, the chatbot should recognize 20+ farming intents with 85% accuracy and respond within 1 second for cached responses
**Validates: Requirements 9.2, 9.3**

**Property 24: Chatbot Fallback Behavior**
*For any* unrecognized query, the chatbot should provide fallback responses directing to FAQ or human support
**Validates: Requirements 9.5**

### Offline-First Architecture Properties

**Property 25: Offline Functionality Completeness**
*For any* core feature (disease detection, cached weather, cached prices, cached schemes), functionality should work completely offline with clear "Last updated" timestamps
**Validates: Requirements 10.1, 10.2, 10.3**

**Property 26: Sync Queue Priority Processing**
*For any* mix of queued items, synchronization should process in priority order: CRITICAL, HIGH, MEDIUM, LOW, with FIFO within each priority level
**Validates: Requirements 11.1**

**Property 27: Sync Retry and Failure Handling**
*For any* failed synchronization, the system should retry with exponential backoff (1s, 2s, 4s) and mark as failed after 3 attempts
**Validates: Requirements 11.2**

**Property 28: Conflict Resolution Consistency**
*For any* data conflict between local and remote versions, the system should apply last-write-wins strategy based on timestamps without data loss
**Validates: Requirements 10.6, 11.6**

**Property 29: Network Resilience**
*For any* network interruption during sync, the system should pause gracefully and resume when connectivity returns, with accurate status indicators
**Validates: Requirements 11.5, 11.4**

### Performance Properties

**Property 30: API Response Time Consistency**
*For any* API read operation, 95% of requests should complete within 500 milliseconds under normal load conditions
**Validates: Requirements 12.1**

**Property 31: Mobile App Performance**
*For any* device with 2GB RAM, the mobile app should start from cold launch within 3 seconds and disease detection should complete within 2 seconds
**Validates: Requirements 12.2, 12.3**

**Property 32: System Scalability**
*For any* load up to 1,000 concurrent users and 100,000 database records, the system should maintain consistent performance without degradation
**Validates: Requirements 12.4, 12.5**

### Data Integrity Properties

**Property 33: Cache Duration Consistency**
*For any* cached data, retention periods should be enforced: weather forecasts (7 days), market prices (90 days), government schemes (indefinite), with automatic cleanup
**Validates: Requirements 10.2, 6.5, 8.5**

**Property 34: Data Compression and Transmission**
*For any* data upload, gzip compression should be applied to minimize bandwidth usage while maintaining data integrity
**Validates: Requirements 11.3**

**Property 35: ACID Transaction Compliance**
*For any* synchronized transaction, ACID properties (Atomicity, Consistency, Isolation, Durability) should be maintained
**Validates: Requirements 11.6, 13.5**

### Security Properties

**Property 36: Data Encryption Standards**
*For any* API communication, TLS 1.3 encryption should be enforced, and all personally identifiable information should be encrypted at rest using AES-256
**Validates: Requirements 15.1, 15.2**

**Property 37: Input Validation and Sanitization**
*For any* user input, the system should validate and sanitize to prevent SQL injection and XSS attacks
**Validates: Requirements 15.5**

**Property 38: Security Event Logging**
*For any* security event (failed login, rate limit exceeded, invalid token), the system should log the event without storing sensitive data
**Validates: Requirements 15.6**

### Compatibility and Usability Properties

**Property 39: Device Compatibility**
*For any* Android device with version 8.0+, 2GB RAM, and 16GB storage, the mobile app should install and function correctly
**Validates: Requirements 16.1, 16.2**

**Property 40: Network Adaptability**
*For any* network type (2G, 3G, 4G), the mobile app should operate with graceful degradation and consume less than 5MB data per month for typical usage
**Validates: Requirements 16.4, 16.5**

**Property 41: Accessibility Standards**
*For any* UI element, touch targets should be minimum 48x48dp, font size minimum 16sp, and navigation depth maximum 3 taps to any feature
**Validates: Requirements 14.1, 14.2, 14.5**

**Property 42: Voice Input Availability**
*For any* text input field, voice input should be available to support low-literacy users
**Validates: Requirements 14.3, 9.1**

### Data Management Properties

**Property 43: User Data Storage Accuracy**
*For any* user registration, phone number should be stored with +91 country code validation, and land size should be stored in hectares with accurate conversion from acres
**Validates: Requirements 17.1, 17.3**

**Property 44: External Data Integration Reliability**
*For any* external API failure (IMD, Agmarknet), the system should use cached data and display staleness indicators
**Validates: Requirements 18.5**

**Property 45: Data Validation Completeness**
*For any* external data fetched, the system should validate completeness and accuracy before storage
**Validates: Requirements 18.6**

### Compliance Properties

**Property 46: Privacy Compliance**
*For any* user data collection, the system should obtain consent and provide privacy policy in Hindi and Marathi, complying with DPDP Act 2023
**Validates: Requirements 20.1, 20.2**

**Property 47: Agricultural Safety Standards**
*For any* disease treatment recommendation, organic alternatives should be prioritized, and pesticide recommendations should comply with legal usage limits
**Validates: Requirements 20.4, 20.5**

### Success Metrics Properties

**Property 48: System Reliability**
*For any* 30-day period during pilot phase, the system should maintain 99% uptime (maximum 7.2 hours downtime per month)
**Validates: Requirements 13.1**

**Property 49: Error Recovery**
*For any* system error, the system should log the error and continue operation without data loss
**Validates: Requirements 13.4**

---

## 14. Scalability Considerations

### 14.1 Horizontal Scaling

**Stateless Services**:
- All services designed to be stateless
- Session state stored in Redis (shared)
- Can scale to N replicas without coordination

**Database Scaling**:
- Read replicas for read-heavy operations
- Connection pooling to limit connections
- Sharding strategy for future growth (by region)

### 14.2 Caching Strategy

**Multi-Level Cache**:
1. **L1 (Mobile)**: WatermelonDB, 50MB limit
2. **L2 (Redis)**: API responses, 1-hour TTL
3. **L3 (CDN)**: Static assets, images

**Cache Invalidation**:
- Time-based expiry (TTL)
- Event-based invalidation (on data update)
- Manual purge for critical updates

### 14.3 Load Balancing

**Strategy**: Round-robin with health checks
- Health check every 10 seconds
- Remove unhealthy instances from pool
- Gradual rollout for deployments (10% → 50% → 100%)

---

## 15. Disaster Recovery

### 15.1 Backup Strategy

**Database Backups**:
- Continuous backup (point-in-time recovery)
- Daily snapshots retained for 30 days
- Weekly full backups retained for 1 year
- Cross-region replication for disaster recovery

**Application State**:
- Infrastructure as Code (Terraform) in Git
- Configuration in environment variables
- Secrets in HashiCorp Vault

### 15.2 Recovery Procedures

**RTO (Recovery Time Objective)**: 1 hour
**RPO (Recovery Point Objective)**: 5 minutes

**Failover Process**:
1. Detect failure (monitoring alerts)
2. Assess impact (which services affected)
3. Failover to backup region (automated)
4. Verify services operational
5. Communicate to users (status page)

---

## 16. Future Enhancements

### 16.1 Phase 2 Features
- Marketplace transactions (buy/sell)
- Payment gateway integration (UPI)
- Advanced analytics dashboard
- Community features (forums, groups)
- FPO (Farmer Producer Organization) management tools

### 16.2 Technical Improvements
- GraphQL subscriptions for real-time updates
- WebSocket support for chat
- Progressive Web App (PWA) for web access
- IoT sensor integration for automated monitoring
- Blockchain-based supply chain tracking

### 16.3 AI/ML Enhancements
- Federated learning for privacy-preserving model training
- Multi-modal models (image + text + sensor data)
- Explainable AI (SHAP, LIME) for model interpretability
- AutoML for continuous model improvement
- Drone integration for aerial crop monitoring

---

## 17. Design Summary

### 17.1 Architecture Highlights

The KrishiAI MVP design implements a robust, scalable, offline-first platform that addresses the unique challenges of rural Indian agriculture:

**Core Architectural Decisions**:
1. **Microservices Architecture**: Six independent services (Auth, Crop, Market, Climate, Government Scheme, Chatbot) enable independent scaling and deployment
2. **Offline-First Mobile App**: WatermelonDB provides local storage with intelligent sync queue for seamless offline operation
3. **On-Device AI**: TensorFlow Lite models (15MB disease detector, 8MB pest identifier) enable instant inference without network dependency
4. **Multi-Language Support**: Hindi and Marathi throughout the stack, from UI to voice I/O to database content
5. **Edge Computing**: Critical features (disease detection, voice recognition) run entirely on-device for performance and reliability

**Technology Stack Alignment**:
- **Mobile**: React Native with Redux for state management, Material Design for sunlight-readable UI
- **Backend**: Node.js (Express) for services, Python (FastAPI) for ML inference
- **Database**: PostgreSQL with TimescaleDB for time-series data, Redis for caching
- **AI/ML**: MobileNetV3 for disease detection, XGBoost for crop recommendations, IndicBERT for chatbot, ARIMA+LSTM for price forecasting
- **Infrastructure**: Kubernetes on AWS/GCP with auto-scaling, Prometheus/Grafana monitoring

### 17.2 Requirements Coverage

All 23 functional requirements and 3 non-functional requirement categories are fully addressed:

**Authentication & User Management** (Req 1-2): OTP-based phone authentication with JWT tokens, multi-language UI with voice support

**Farm Management** (Req 3): GPS-based location detection, soil/irrigation type selection, local storage with cloud sync

**AI Crop Intelligence** (Req 4-5): Sub-500ms crop recommendations with 85% accuracy, on-device disease detection with 90% accuracy for 120 diseases

**Market Intelligence** (Req 6): Real-time prices from 5 nearest mandis, 7/30/90-day forecasts with 85% accuracy, SMS price alerts

**Climate Intelligence** (Req 7): 6-hourly weather updates with 5km resolution, FAO-56 irrigation calculations, critical weather SMS alerts

**Government Services** (Req 8-9): Weekly scheme updates with eligibility filtering, 20+ intent chatbot with 85% accuracy, voice I/O in Hindi/Marathi

**Offline Architecture** (Req 10-11): Complete offline functionality for core features, priority-based sync queue with exponential backoff, last-write-wins conflict resolution

**Performance** (Req 12): <500ms API responses, <2s disease detection, <3s app launch on 2GB RAM devices

**Reliability** (Req 13): 99% uptime, automatic backups, graceful error handling

**Usability** (Req 14): Max 3-tap navigation, 16sp fonts, 48dp touch targets, voice input for all text fields

**Security** (Req 15): TLS 1.3, AES-256 encryption, JWT with 7-day expiry, input validation, DPDP Act 2023 compliance

**Compatibility** (Req 16): Android 8.0+, 2GB RAM, 2G/3G/4G networks, <5MB monthly data usage

**Data Management** (Req 17-18): Structured user/farm/crop data, daily external API integration with fallback caching

**Integration** (Req 19): IMD Weather API, SMS gateway (Twilio/MSG91), Google Speech-to-Text

**Compliance** (Req 20): DPDP Act 2023, agronomist-reviewed treatments, organic-first recommendations

### 17.3 Correctness Properties

49 universally quantified properties ensure system correctness across all valid inputs:

- **Authentication** (3 properties): OTP generation/validation, rate limiting, JWT validity
- **Multi-Language** (2 properties): UI translation, voice I/O consistency
- **Farm Management** (2 properties): Location detection, data persistence
- **AI Crop Intelligence** (5 properties): Recommendation performance/accuracy, disease detection, treatment structure
- **Market Intelligence** (4 properties): Geospatial queries, trend calculation, forecasting, alerts
- **Climate Intelligence** (4 properties): Weather updates, critical alerts, irrigation calculations, water savings
- **Government Services** (4 properties): Scheme filtering, updates, chatbot intent recognition, fallback behavior
- **Offline Architecture** (5 properties): Offline functionality, sync priority, retry handling, conflict resolution, network resilience
- **Performance** (3 properties): API response time, mobile app performance, scalability
- **Data Integrity** (3 properties): Cache duration, compression, ACID compliance
- **Security** (3 properties): Encryption standards, input validation, security logging
- **Compatibility & Usability** (4 properties): Device compatibility, network adaptability, accessibility, voice input
- **Data Management** (3 properties): Storage accuracy, external integration reliability, validation
- **Compliance** (2 properties): Privacy compliance, agricultural safety
- **Success Metrics** (2 properties): System reliability, error recovery

Each property is testable through property-based testing with minimum 100 iterations, ensuring comprehensive validation.

### 17.4 Implementation Readiness

The design document provides complete specifications for implementation:

**Database Schemas**: 15+ tables with indexes, constraints, and relationships defined
**API Endpoints**: 30+ RESTful endpoints with request/response formats
**ML Models**: Architecture, training pipelines, and inference code for 4 models
**Data Flows**: 7 detailed flow diagrams covering all major user journeys
**Security**: Authentication, encryption, validation, and compliance measures
**Deployment**: Kubernetes configurations, CI/CD pipelines, monitoring setup
**Testing**: Dual strategy with unit tests and property-based tests

**Ready for Task Breakdown**: All components are sufficiently detailed to create discrete implementation tasks with clear acceptance criteria.

---

**Document Version**: 2.0  
**Created**: January 2026  
**Updated**: January 2026  
**Status**: Ready for Task Creation  
**Next Steps**: Review design document, then proceed to tasks.md creation
- Community features (forums, groups)

### 16.2 Technical Improvements
- GraphQL subscriptions for real-time updates
- WebSocket support for chat
- Progressive Web App (PWA) for web access
- IoT sensor integration

### 16.3 AI/ML Enhancements
- Federated learning for privacy-preserving model training
- Multi-modal models (image + text + sensor data)
- Explainable AI (SHAP, LIME) for model interpretability
- AutoML for continuous model improvement

---

**Document Version**: 1.0  
**Created**: January 2026  
**Status**: Ready for Implementation  
**Next Steps**: Create tasks.md for implementation breakdown
