import {
  calculateReferenceET,
  getCropCoefficient,
  calculateCropET,
  calculateIrrigationNeed,
  trackWaterSavings,
  CROP_COEFFICIENTS,
  WeatherData,
  IrrigationRecommendation,
} from '../services/waterAdvisoryService';

describe('Water Advisory Service', () => {
  describe('calculateReferenceET', () => {
    it('should calculate ET0 using FAO-56 Penman-Monteith equation', () => {
      const weather: WeatherData = {
        temp_max: 35,
        temp_min: 20,
        humidity: 60,
        wind_speed: 2.5,
        solar_radiation: 22,
      };

      const et0 = calculateReferenceET(weather);

      expect(et0).toBeGreaterThan(0);
      expect(et0).toBeLessThan(20); // Reasonable range for daily ET0
      expect(typeof et0).toBe('number');
    });

    it('should handle extreme weather conditions', () => {
      const extremeWeather: WeatherData = {
        temp_max: 45,
        temp_min: 30,
        humidity: 20,
        wind_speed: 5,
        solar_radiation: 30,
      };

      const et0 = calculateReferenceET(extremeWeather);

      expect(et0).toBeGreaterThan(0);
      expect(et0).toBeGreaterThan(5); // High ET0 for extreme conditions
    });

    it('should return non-negative ET0', () => {
      const weather: WeatherData = {
        temp_max: 10,
        temp_min: 5,
        humidity: 90,
        wind_speed: 0.5,
        solar_radiation: 5,
      };

      const et0 = calculateReferenceET(weather);

      expect(et0).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCropCoefficient', () => {
    it('should return correct Kc for rice at different growth stages', () => {
      expect(getCropCoefficient('rice', 'initial')).toBe(1.05);
      expect(getCropCoefficient('rice', 'mid')).toBe(1.20);
      expect(getCropCoefficient('rice', 'late')).toBe(0.90);
    });

    it('should return correct Kc for wheat at different growth stages', () => {
      expect(getCropCoefficient('wheat', 'initial')).toBe(0.40);
      expect(getCropCoefficient('wheat', 'mid')).toBe(1.15);
      expect(getCropCoefficient('wheat', 'late')).toBe(0.40);
    });

    it('should handle case-insensitive crop names', () => {
      expect(getCropCoefficient('RICE', 'mid')).toBe(1.20);
      expect(getCropCoefficient('Rice', 'mid')).toBe(1.20);
      expect(getCropCoefficient('rice', 'mid')).toBe(1.20);
    });

    it('should return default Kc for unknown crops', () => {
      expect(getCropCoefficient('unknown_crop', 'mid')).toBe(1.0);
    });

    it('should have coefficients for all major crops', () => {
      const crops = ['rice', 'wheat', 'cotton', 'tomato', 'onion', 'sugarcane'];
      crops.forEach((crop) => {
        expect(CROP_COEFFICIENTS[crop as keyof typeof CROP_COEFFICIENTS]).toBeDefined();
        expect(CROP_COEFFICIENTS[crop as keyof typeof CROP_COEFFICIENTS].initial).toBeGreaterThan(0);
        expect(CROP_COEFFICIENTS[crop as keyof typeof CROP_COEFFICIENTS].mid).toBeGreaterThan(0);
        expect(CROP_COEFFICIENTS[crop as keyof typeof CROP_COEFFICIENTS].late).toBeGreaterThan(0);
      });
    });
  });

  describe('calculateCropET', () => {
    it('should calculate ETc correctly', () => {
      const et0 = 5.0;
      const kc = 1.2;

      const etc = calculateCropET(et0, kc);

      expect(etc).toBe(6.0);
    });

    it('should handle zero ET0', () => {
      const etc = calculateCropET(0, 1.2);
      expect(etc).toBe(0);
    });

    it('should handle Kc less than 1', () => {
      const etc = calculateCropET(5.0, 0.4);
      expect(etc).toBe(2.0);
    });
  });

  describe('calculateIrrigationNeed', () => {
    const baseWeather: WeatherData = {
      temp_max: 32,
      temp_min: 22,
      humidity: 65,
      wind_speed: 2.0,
      solar_radiation: 20,
    };

    it('should recommend irrigation when water deficit exceeds threshold', () => {
      const recommendation = calculateIrrigationNeed(
        'rice',
        'mid',
        5, // Very low soil moisture
        baseWeather,
        0 // No recent rainfall
      );

      expect(recommendation.irrigate).toBe(true);
      expect(recommendation.amount_mm).toBeGreaterThan(5);
      expect(recommendation.timing).toMatch(/morning|evening/);
      expect(recommendation.calculation_method).toBe('FAO-56');
    });

    it('should skip irrigation when soil moisture is sufficient', () => {
      const recommendation = calculateIrrigationNeed(
        'rice',
        'mid',
        50, // High soil moisture
        baseWeather,
        30 // Recent rainfall
      );

      expect(recommendation.irrigate).toBe(false);
      expect(recommendation.amount_mm).toBe(0);
      expect(recommendation.water_saved_mm).toBe(50); // Full traditional amount saved
    });

    it('should recommend morning irrigation for cooler temperatures', () => {
      const coolWeather: WeatherData = {
        ...baseWeather,
        temp_max: 28,
      };

      const recommendation = calculateIrrigationNeed(
        'wheat',
        'mid',
        10,
        coolWeather,
        0
      );

      if (recommendation.irrigate) {
        expect(recommendation.timing).toBe('morning');
      }
    });

    it('should recommend evening irrigation for hot temperatures', () => {
      const hotWeather: WeatherData = {
        ...baseWeather,
        temp_max: 38,
      };

      const recommendation = calculateIrrigationNeed(
        'cotton',
        'mid',
        10,
        hotWeather,
        0
      );

      if (recommendation.irrigate) {
        expect(recommendation.timing).toBe('evening');
      }
    });

    it('should calculate water savings vs traditional method', () => {
      const recommendation = calculateIrrigationNeed(
        'tomato',
        'mid',
        15,
        baseWeather,
        5
      );

      expect(recommendation.water_saved_mm).toBeGreaterThanOrEqual(0);
      expect(recommendation.water_saved_mm).toBeLessThanOrEqual(50);
    });

    it('should include ETc and effective rainfall in response', () => {
      const recommendation = calculateIrrigationNeed(
        'onion',
        'mid',
        20,
        baseWeather,
        10
      );

      expect(recommendation.etc).toBeGreaterThan(0);
      expect(recommendation.effective_rainfall).toBe(8); // 80% of 10mm
    });

    it('should handle different growth stages correctly', () => {
      const initialStage = calculateIrrigationNeed('wheat', 'initial', 20, baseWeather, 5);
      const midStage = calculateIrrigationNeed('wheat', 'mid', 20, baseWeather, 5);
      const lateStage = calculateIrrigationNeed('wheat', 'late', 20, baseWeather, 5);

      // Mid stage should have highest water requirement for wheat
      expect(midStage.etc).toBeGreaterThan(initialStage.etc);
      expect(midStage.etc).toBeGreaterThan(lateStage.etc);
    });

    it('should provide clear reason for recommendation', () => {
      const recommendation = calculateIrrigationNeed(
        'sugarcane',
        'mid',
        10,
        baseWeather,
        0
      );

      expect(recommendation.reason).toBeDefined();
      expect(typeof recommendation.reason).toBe('string');
      expect(recommendation.reason.length).toBeGreaterThan(0);
    });
  });

  describe('trackWaterSavings', () => {
    it('should calculate cumulative water savings correctly', () => {
      const recommendations: IrrigationRecommendation[] = [
        {
          irrigate: true,
          amount_mm: 30,
          timing: 'morning',
          reason: 'Water deficit',
          water_saved_mm: 20,
          etc: 35,
          effective_rainfall: 5,
          calculation_method: 'FAO-56',
        },
        {
          irrigate: false,
          amount_mm: 0,
          timing: 'morning',
          reason: 'Sufficient moisture',
          water_saved_mm: 50,
          etc: 25,
          effective_rainfall: 20,
          calculation_method: 'FAO-56',
        },
        {
          irrigate: true,
          amount_mm: 25,
          timing: 'evening',
          reason: 'Water deficit',
          water_saved_mm: 25,
          etc: 30,
          effective_rainfall: 5,
          calculation_method: 'FAO-56',
        },
      ];

      const savings = trackWaterSavings(recommendations);

      expect(savings.total_water_saved_mm).toBe(95); // 20 + 50 + 25
      expect(savings.traditional_usage_mm).toBe(150); // 3 * 50
      expect(savings.optimized_usage_mm).toBe(55); // 30 + 0 + 25
      expect(savings.savings_percentage).toBeCloseTo(63.33, 1);
    });

    it('should handle empty recommendations array', () => {
      const savings = trackWaterSavings([]);

      expect(savings.total_water_saved_mm).toBe(0);
      expect(savings.traditional_usage_mm).toBe(0);
      expect(savings.optimized_usage_mm).toBe(0);
      expect(savings.savings_percentage).toBe(0);
    });

    it('should handle all irrigation events', () => {
      const recommendations: IrrigationRecommendation[] = [
        {
          irrigate: true,
          amount_mm: 50,
          timing: 'morning',
          reason: 'Water deficit',
          water_saved_mm: 0,
          etc: 50,
          effective_rainfall: 0,
          calculation_method: 'FAO-56',
        },
        {
          irrigate: true,
          amount_mm: 50,
          timing: 'morning',
          reason: 'Water deficit',
          water_saved_mm: 0,
          etc: 50,
          effective_rainfall: 0,
          calculation_method: 'FAO-56',
        },
      ];

      const savings = trackWaterSavings(recommendations);

      expect(savings.total_water_saved_mm).toBe(0);
      expect(savings.savings_percentage).toBe(0);
    });

    it('should handle all skip irrigation events', () => {
      const recommendations: IrrigationRecommendation[] = [
        {
          irrigate: false,
          amount_mm: 0,
          timing: 'morning',
          reason: 'Sufficient moisture',
          water_saved_mm: 50,
          etc: 20,
          effective_rainfall: 25,
          calculation_method: 'FAO-56',
        },
        {
          irrigate: false,
          amount_mm: 0,
          timing: 'morning',
          reason: 'Sufficient moisture',
          water_saved_mm: 50,
          etc: 20,
          effective_rainfall: 25,
          calculation_method: 'FAO-56',
        },
      ];

      const savings = trackWaterSavings(recommendations);

      expect(savings.total_water_saved_mm).toBe(100);
      expect(savings.optimized_usage_mm).toBe(0);
      expect(savings.savings_percentage).toBe(100);
    });

    it('should round values to 2 decimal places', () => {
      const recommendations: IrrigationRecommendation[] = [
        {
          irrigate: true,
          amount_mm: 33.333,
          timing: 'morning',
          reason: 'Water deficit',
          water_saved_mm: 16.667,
          etc: 35,
          effective_rainfall: 5,
          calculation_method: 'FAO-56',
        },
      ];

      const savings = trackWaterSavings(recommendations);

      expect(savings.total_water_saved_mm).toBe(16.67);
      expect(savings.optimized_usage_mm).toBe(33.33);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete irrigation cycle for rice crop', () => {
      const weather: WeatherData = {
        temp_max: 34,
        temp_min: 24,
        humidity: 70,
        wind_speed: 1.5,
        solar_radiation: 22,
      };

      // Initial stage - low water requirement
      const initial = calculateIrrigationNeed('rice', 'initial', 30, weather, 10);
      
      // Mid stage - high water requirement
      const mid = calculateIrrigationNeed('rice', 'mid', 30, weather, 10);
      
      // Late stage - moderate water requirement
      const late = calculateIrrigationNeed('rice', 'late', 30, weather, 10);

      // Mid stage should have highest ETc
      expect(mid.etc).toBeGreaterThan(initial.etc);
      expect(mid.etc).toBeGreaterThan(late.etc);

      // Track savings across all stages
      const savings = trackWaterSavings([initial, mid, late]);
      expect(savings.total_water_saved_mm).toBeGreaterThanOrEqual(0);
    });

    it('should adapt recommendations based on rainfall', () => {
      const weather: WeatherData = {
        temp_max: 32,
        temp_min: 22,
        humidity: 65,
        wind_speed: 2.0,
        solar_radiation: 20,
      };

      // No rainfall and low soil moisture - should recommend irrigation
      const noRain = calculateIrrigationNeed('wheat', 'mid', 5, weather, 0);
      
      // Heavy rainfall - should skip irrigation
      const heavyRain = calculateIrrigationNeed('wheat', 'mid', 20, weather, 50);

      expect(noRain.irrigate).toBe(true);
      expect(heavyRain.irrigate).toBe(false);
      expect(heavyRain.water_saved_mm).toBeGreaterThan(noRain.water_saved_mm);
    });
  });
});
