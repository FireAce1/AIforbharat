import logger from '../utils/logger';

/**
 * FAO-56 Penman-Monteith Water Advisory Service
 * Implements scientific irrigation recommendations based on crop water requirements
 */

// Crop coefficients (Kc) by growth stage for major crops
// Source: FAO Irrigation and Drainage Paper 56
export const CROP_COEFFICIENTS = {
  rice: { initial: 1.05, mid: 1.20, late: 0.90 },
  wheat: { initial: 0.40, mid: 1.15, late: 0.40 },
  cotton: { initial: 0.35, mid: 1.15, late: 0.70 },
  tomato: { initial: 0.60, mid: 1.15, late: 0.80 },
  onion: { initial: 0.70, mid: 1.05, late: 0.85 },
  sugarcane: { initial: 0.40, mid: 1.25, late: 0.75 },
};

export type CropType = keyof typeof CROP_COEFFICIENTS;
export type GrowthStage = 'initial' | 'mid' | 'late';

export interface WeatherData {
  temp_max: number;        // Maximum temperature (°C)
  temp_min: number;        // Minimum temperature (°C)
  humidity: number;        // Relative humidity (%)
  wind_speed: number;      // Wind speed at 2m height (m/s)
  solar_radiation: number; // Solar radiation (MJ m-2 day-1)
}

export interface IrrigationRecommendation {
  irrigate: boolean;
  amount_mm: number;
  timing: 'morning' | 'evening';
  reason: string;
  water_saved_mm: number;
  etc: number;
  effective_rainfall: number;
  calculation_method: string;
}

export interface WaterSavingsTracking {
  total_water_saved_mm: number;
  traditional_usage_mm: number;
  optimized_usage_mm: number;
  savings_percentage: number;
}

/**
 * Calculate reference evapotranspiration (ET0) using FAO-56 Penman-Monteith equation
 * @param weather Weather data including temperature, humidity, wind speed, and solar radiation
 * @returns Reference evapotranspiration in mm/day
 */
export function calculateReferenceET(weather: WeatherData): number {
  const { temp_max, temp_min, humidity, wind_speed, solar_radiation } = weather;

  // Calculate mean temperature
  const temp_mean = (temp_max + temp_min) / 2;

  // Saturation vapor pressure (es) in kPa
  const es_max = 0.6108 * Math.exp((17.27 * temp_max) / (temp_max + 237.3));
  const es_min = 0.6108 * Math.exp((17.27 * temp_min) / (temp_min + 237.3));
  const es = (es_max + es_min) / 2;

  // Actual vapor pressure (ea) in kPa
  const ea = es * (humidity / 100);

  // Slope of saturation vapor pressure curve (delta) in kPa/°C
  const delta = (4098 * es) / Math.pow(temp_mean + 237.3, 2);

  // Psychrometric constant (gamma) in kPa/°C at sea level
  const gamma = 0.665 * 0.001 * 101.3;

  // Net radiation (Rn) in MJ m-2 day-1 (simplified)
  const rn = solar_radiation * 0.77;

  // Soil heat flux (G) - negligible for daily calculations
  const g = 0;

  // FAO-56 Penman-Monteith equation
  const numerator =
    0.408 * delta * (rn - g) +
    (gamma * (900 / (temp_mean + 273)) * wind_speed * (es - ea));
  const denominator = delta + gamma * (1 + 0.34 * wind_speed);

  const et0 = numerator / denominator;

  logger.debug('Calculated ET0', {
    temp_mean,
    es,
    ea,
    delta,
    gamma,
    rn,
    et0,
  });

  return Math.max(0, et0); // ET0 cannot be negative
}

/**
 * Get crop coefficient (Kc) for a specific crop and growth stage
 * @param cropName Name of the crop
 * @param growthStage Current growth stage
 * @returns Crop coefficient value
 */
export function getCropCoefficient(
  cropName: string,
  growthStage: GrowthStage
): number {
  const cropLower = cropName.toLowerCase() as CropType;
  const coefficients = CROP_COEFFICIENTS[cropLower];

  if (!coefficients) {
    logger.warn(`Crop coefficient not found for ${cropName}, using default 1.0`);
    return 1.0;
  }

  return coefficients[growthStage];
}

/**
 * Calculate crop evapotranspiration (ETc)
 * @param et0 Reference evapotranspiration (mm/day)
 * @param kc Crop coefficient
 * @returns Crop evapotranspiration in mm/day
 */
export function calculateCropET(et0: number, kc: number): number {
  return et0 * kc;
}

/**
 * Calculate irrigation need and water savings
 * @param cropName Name of the crop
 * @param growthStage Current growth stage
 * @param soilMoisture Current soil moisture level (mm)
 * @param weather Weather data
 * @param recentRainfall Recent rainfall amount (mm)
 * @returns Irrigation recommendation with water savings
 */
export function calculateIrrigationNeed(
  cropName: string,
  growthStage: GrowthStage,
  soilMoisture: number,
  weather: WeatherData,
  recentRainfall: number
): IrrigationRecommendation {
  // Calculate reference ET
  const et0 = calculateReferenceET(weather);

  // Get crop coefficient
  const kc = getCropCoefficient(cropName, growthStage);

  // Calculate crop evapotranspiration (ETc)
  const etc = calculateCropET(et0, kc);

  // Effective rainfall (80% of actual rainfall is effective)
  const effective_rainfall = recentRainfall * 0.8;

  // Soil moisture contribution (estimated from soil type and moisture level)
  // Reduced contribution factor for more realistic irrigation needs
  const soil_contribution = soilMoisture * 0.2;

  // Calculate water deficit
  const water_deficit = etc - effective_rainfall - soil_contribution;

  // Irrigation threshold (irrigate if deficit > 5mm)
  const threshold = 5.0;

  // Traditional fixed irrigation schedule baseline
  const traditional_amount = 50; // mm (typical fixed irrigation)

  if (water_deficit > threshold) {
    // Calculate water saved compared to traditional fixed schedule
    const optimized_amount = water_deficit;
    const water_saved = Math.max(0, traditional_amount - optimized_amount);

    // Determine optimal irrigation timing based on temperature
    const timing = weather.temp_max < 30 ? 'morning' : 'evening';

    return {
      irrigate: true,
      amount_mm: Math.round(water_deficit * 100) / 100,
      timing,
      reason: `Crop water deficit: ${Math.round(water_deficit * 100) / 100}mm`,
      water_saved_mm: Math.round(water_saved * 100) / 100,
      etc: Math.round(etc * 100) / 100,
      effective_rainfall: Math.round(effective_rainfall * 100) / 100,
      calculation_method: 'FAO-56',
    };
  } else {
    return {
      irrigate: false,
      amount_mm: 0,
      timing: 'morning',
      reason: 'Sufficient soil moisture and recent rainfall',
      water_saved_mm: traditional_amount, // Full traditional irrigation amount saved
      etc: Math.round(etc * 100) / 100,
      effective_rainfall: Math.round(effective_rainfall * 100) / 100,
      calculation_method: 'FAO-56',
    };
  }
}

/**
 * Track cumulative water savings over time
 * @param recommendations Array of irrigation recommendations
 * @returns Water savings tracking summary
 */
export function trackWaterSavings(
  recommendations: IrrigationRecommendation[]
): WaterSavingsTracking {
  const total_saved = recommendations.reduce(
    (sum, r) => sum + r.water_saved_mm,
    0
  );

  // Traditional fixed schedule: 50mm per irrigation event
  const total_traditional = recommendations.length * 50;

  // Optimized usage: sum of actual irrigation amounts
  const total_optimized = recommendations.reduce(
    (sum, r) => sum + (r.irrigate ? r.amount_mm : 0),
    0
  );

  const savings_percentage =
    total_traditional > 0 ? (total_saved / total_traditional) * 100 : 0;

  return {
    total_water_saved_mm: Math.round(total_saved * 100) / 100,
    traditional_usage_mm: total_traditional,
    optimized_usage_mm: Math.round(total_optimized * 100) / 100,
    savings_percentage: Math.round(savings_percentage * 100) / 100,
  };
}
