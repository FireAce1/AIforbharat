/**
 * Prepared Statements Registry
 * 
 * Centralized registry of prepared statements for all services
 * to improve query performance and prevent SQL injection
 */

export const PreparedStatements = {
  // ============================================
  // Auth Service Statements
  // ============================================
  AUTH: {
    GET_USER_BY_PHONE: {
      name: 'get_user_by_phone',
      text: 'SELECT * FROM users WHERE phone = $1',
    },
    GET_USER_BY_ID: {
      name: 'get_user_by_id',
      text: 'SELECT * FROM users WHERE id = $1',
    },
    UPDATE_USER_ACTIVITY: {
      name: 'update_user_activity',
      text: 'UPDATE users SET last_active = NOW() WHERE phone = $1',
    },
    CREATE_USER: {
      name: 'create_user',
      text: `INSERT INTO users (phone, language, created_at, last_active) 
             VALUES ($1, $2, NOW(), NOW()) 
             RETURNING *`,
    },
    GET_VALID_OTP: {
      name: 'get_valid_otp',
      text: `SELECT * FROM otp_codes 
             WHERE phone = $1 
             AND verified = FALSE 
             AND expires_at > NOW() 
             ORDER BY created_at DESC 
             LIMIT 1`,
    },
    MARK_OTP_VERIFIED: {
      name: 'mark_otp_verified',
      text: 'UPDATE otp_codes SET verified = TRUE WHERE id = $1',
    },
    COUNT_RECENT_OTPS: {
      name: 'count_recent_otps',
      text: `SELECT COUNT(*) as count 
             FROM otp_codes 
             WHERE phone = $1 
             AND created_at > NOW() - INTERVAL '1 hour'`,
    },
  },

  // ============================================
  // Farm Service Statements
  // ============================================
  FARM: {
    GET_USER_FARMS: {
      name: 'get_user_farms',
      text: `SELECT * FROM farms 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
    },
    GET_FARM_BY_ID: {
      name: 'get_farm_by_id',
      text: 'SELECT * FROM farms WHERE id = $1',
    },
    GET_FARM_WITH_CROPS: {
      name: 'get_farm_with_crops',
      text: `SELECT 
               f.*,
               json_agg(
                 json_build_object(
                   'id', c.id,
                   'crop_name', c.crop_name,
                   'variety', c.variety,
                   'sowing_date', c.sowing_date,
                   'expected_harvest', c.expected_harvest,
                   'status', c.status
                 )
               ) FILTER (WHERE c.id IS NOT NULL) as crops
             FROM farms f
             LEFT JOIN crops c ON f.id = c.farm_id
             WHERE f.id = $1
             GROUP BY f.id`,
    },
    GET_NEARBY_FARMS: {
      name: 'get_nearby_farms',
      text: `SELECT 
               id,
               user_id,
               latitude,
               longitude,
               size_hectares,
               soil_type,
               irrigation_type,
               SQRT(
                 POW(69.1 * (latitude - $1), 2) + 
                 POW(69.1 * ($2 - longitude) * COS(latitude / 57.3), 2)
               ) AS distance_km
             FROM farms
             WHERE latitude BETWEEN $1 - ($3 / 69.1) AND $1 + ($3 / 69.1)
             AND longitude BETWEEN $2 - ($3 / 69.1) AND $2 + ($3 / 69.1)
             ORDER BY distance_km ASC
             LIMIT $4`,
    },
  },

  // ============================================
  // Crop Service Statements
  // ============================================
  CROP: {
    GET_FARM_CROPS: {
      name: 'get_farm_crops',
      text: `SELECT * FROM crops 
             WHERE farm_id = $1 
             ORDER BY sowing_date DESC NULLS LAST`,
    },
    GET_ACTIVE_CROPS: {
      name: 'get_active_crops',
      text: `SELECT * FROM crops 
             WHERE farm_id = $1 
             AND status = 'active' 
             ORDER BY sowing_date DESC`,
    },
    GET_CROP_WITH_DETECTIONS: {
      name: 'get_crop_with_detections',
      text: `SELECT 
               c.*,
               json_agg(
                 json_build_object(
                   'id', d.id,
                   'disease_name', d.disease_name,
                   'confidence', d.confidence,
                   'severity', d.severity,
                   'detected_at', d.detected_at
                 )
                 ORDER BY d.detected_at DESC
               ) FILTER (WHERE d.id IS NOT NULL) as detections
             FROM crops c
             LEFT JOIN disease_detections d ON c.id = d.crop_id
             WHERE c.id = $1
             GROUP BY c.id`,
    },
  },

  // ============================================
  // Disease Detection Statements
  // ============================================
  DISEASE: {
    CREATE_DETECTION: {
      name: 'create_detection',
      text: `INSERT INTO disease_detections 
             (crop_id, image_url, disease_name, confidence, severity, detected_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING *`,
    },
    GET_CROP_DETECTIONS: {
      name: 'get_crop_detections',
      text: `SELECT * FROM disease_detections 
             WHERE crop_id = $1 
             ORDER BY detected_at DESC 
             LIMIT $2`,
    },
    GET_RECENT_DETECTIONS: {
      name: 'get_recent_detections',
      text: `SELECT d.*, c.crop_name, f.user_id
             FROM disease_detections d
             JOIN crops c ON d.crop_id = c.id
             JOIN farms f ON c.farm_id = f.id
             WHERE f.user_id = $1
             AND d.detected_at >= NOW() - INTERVAL '30 days'
             ORDER BY d.detected_at DESC
             LIMIT $2`,
    },
  },

  // ============================================
  // Market Price Statements
  // ============================================
  MARKET: {
    GET_RECENT_PRICES: {
      name: 'get_recent_prices',
      text: `SELECT 
               time,
               crop_name,
               market_name,
               ST_Y(location::geometry) as latitude,
               ST_X(location::geometry) as longitude,
               price_per_kg,
               quantity_traded
             FROM market_prices
             WHERE crop_name = $1
             AND time >= NOW() - INTERVAL '7 days'
             ORDER BY time DESC
             LIMIT $2`,
    },
    GET_PRICE_HISTORY: {
      name: 'get_price_history',
      text: `SELECT 
               time_bucket('1 day', time) as day,
               crop_name,
               market_name,
               AVG(price_per_kg) as avg_price,
               MIN(price_per_kg) as min_price,
               MAX(price_per_kg) as max_price
             FROM market_prices
             WHERE crop_name = $1
             AND market_name = $2
             AND time >= NOW() - INTERVAL '$3 days'
             GROUP BY day, crop_name, market_name
             ORDER BY day DESC`,
    },
  },

  // ============================================
  // Weather Forecast Statements
  // ============================================
  WEATHER: {
    GET_FORECAST: {
      name: 'get_forecast',
      text: `SELECT 
               time,
               ST_X(location::geometry) as lng,
               ST_Y(location::geometry) as lat,
               temperature,
               rainfall,
               humidity,
               wind_speed,
               source
             FROM weather_forecasts
             WHERE ST_DWithin(
               location,
               ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
               5000
             )
             AND time >= NOW()
             AND time <= NOW() + INTERVAL '$3 days'
             ORDER BY time ASC`,
    },
    GET_CRITICAL_WEATHER: {
      name: 'get_critical_weather',
      text: `SELECT 
               time,
               ST_X(location::geometry) as lng,
               ST_Y(location::geometry) as lat,
               temperature,
               rainfall,
               wind_speed
             FROM weather_forecasts
             WHERE time >= NOW()
             AND time <= NOW() + INTERVAL '24 hours'
             AND (
               temperature > 45 
               OR temperature < 5 
               OR rainfall > 100 
               OR wind_speed > 60
             )
             ORDER BY time ASC`,
    },
  },

  // ============================================
  // Government Schemes Statements
  // ============================================
  SCHEMES: {
    GET_ACTIVE_SCHEMES: {
      name: 'get_active_schemes',
      text: `SELECT * FROM government_schemes 
             WHERE is_active = TRUE 
             ORDER BY application_deadline ASC NULLS LAST, last_updated DESC 
             LIMIT $1`,
    },
    GET_SCHEME_BY_ID: {
      name: 'get_scheme_by_id',
      text: `SELECT * FROM government_schemes 
             WHERE id = $1 AND is_active = TRUE`,
    },
    SEARCH_SCHEMES: {
      name: 'search_schemes',
      text: `SELECT * FROM government_schemes 
             WHERE is_active = TRUE
             AND (
               scheme_name ILIKE $1 
               OR scheme_name_hi ILIKE $1 
               OR scheme_name_mr ILIKE $1
               OR description ILIKE $1
             )
             ORDER BY application_deadline ASC NULLS LAST
             LIMIT $2`,
    },
    GET_SCHEMES_BY_STATE: {
      name: 'get_schemes_by_state',
      text: `SELECT * FROM government_schemes 
             WHERE is_active = TRUE
             AND (state = $1 OR state = 'National' OR state = 'all')
             ORDER BY application_deadline ASC NULLS LAST
             LIMIT $2`,
    },
    GET_UPCOMING_DEADLINES: {
      name: 'get_upcoming_deadlines',
      text: `SELECT s.*, sub.user_id
             FROM government_schemes s
             JOIN scheme_subscriptions sub ON s.id = sub.scheme_id
             WHERE s.application_deadline >= CURRENT_DATE
             AND s.application_deadline <= CURRENT_DATE + INTERVAL '$1 days'
             AND sub.notification_sent = FALSE
             AND s.is_active = TRUE`,
    },
  },

  // ============================================
  // Irrigation Recommendations Statements
  // ============================================
  IRRIGATION: {
    GET_FARM_RECOMMENDATIONS: {
      name: 'get_farm_recommendations',
      text: `SELECT * FROM irrigation_recommendations 
             WHERE farm_id = $1 
             ORDER BY recommendation_date DESC 
             LIMIT $2`,
    },
    GET_RECENT_RECOMMENDATION: {
      name: 'get_recent_recommendation',
      text: `SELECT * FROM irrigation_recommendations 
             WHERE farm_id = $1 
             AND recommendation_date = CURRENT_DATE 
             LIMIT 1`,
    },
    GET_WATER_SAVINGS: {
      name: 'get_water_savings',
      text: `SELECT * FROM water_savings_tracking 
             WHERE farm_id = $1 
             ORDER BY period_end DESC 
             LIMIT $2`,
    },
  },

  // ============================================
  // Chatbot Conversations Statements
  // ============================================
  CHATBOT: {
    GET_USER_HISTORY: {
      name: 'get_user_history',
      text: `SELECT * FROM chatbot_conversations 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2`,
    },
    CREATE_CONVERSATION: {
      name: 'create_conversation',
      text: `INSERT INTO chatbot_conversations 
             (user_id, query_text, query_language, intent, confidence, response_text, response_time_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
    },
  },
};

/**
 * Helper function to get prepared statement by service and name
 */
export function getPreparedStatement(
  service: keyof typeof PreparedStatements,
  statementName: string
): { name: string; text: string } | undefined {
  const serviceStatements = PreparedStatements[service];
  if (!serviceStatements) {
    return undefined;
  }
  
  return (serviceStatements as any)[statementName];
}
