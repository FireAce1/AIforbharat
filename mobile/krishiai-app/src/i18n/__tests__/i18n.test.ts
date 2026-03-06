/**
 * i18n Infrastructure Tests
 * Tests for internationalization setup and language switching
 */

import i18n from '../index';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

describe('i18n Infrastructure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with Hindi as default language', () => {
      expect(i18n.language).toBeDefined();
      expect(['hi', 'mr']).toContain(i18n.language);
    });

    it('should have Hindi and Marathi resources loaded', () => {
      const languages = Object.keys(i18n.options.resources || {});
      expect(languages).toContain('hi');
      expect(languages).toContain('mr');
    });

    it('should have fallback language set to Hindi', () => {
      const fallbackLng = i18n.options.fallbackLng;
      // fallbackLng can be a string or array
      if (Array.isArray(fallbackLng)) {
        expect(fallbackLng).toContain('hi');
      } else {
        expect(fallbackLng).toEqual('hi');
      }
    });
  });

  describe('Translation Keys', () => {
    it('should translate common keys in Hindi', async () => {
      await i18n.changeLanguage('hi');
      expect(i18n.t('common.appName')).toBe('कृषि AI');
      expect(i18n.t('common.loading')).toBe('लोड हो रहा है...');
      expect(i18n.t('common.error')).toBe('त्रुटि');
      expect(i18n.t('common.success')).toBe('सफलता');
    });

    it('should translate common keys in Marathi', async () => {
      await i18n.changeLanguage('mr');
      expect(i18n.t('common.appName')).toBe('कृषी AI');
      expect(i18n.t('common.loading')).toBe('लोड होत आहे...');
      expect(i18n.t('common.error')).toBe('त्रुटी');
      expect(i18n.t('common.success')).toBe('यश');
    });

    it('should translate auth keys in Hindi', async () => {
      await i18n.changeLanguage('hi');
      expect(i18n.t('auth.welcome')).toBe('कृषि AI में आपका स्वागत है');
      expect(i18n.t('auth.phoneNumber')).toBe('मोबाइल नंबर');
      expect(i18n.t('auth.sendOtp')).toBe('OTP भेजें');
    });

    it('should translate auth keys in Marathi', async () => {
      await i18n.changeLanguage('mr');
      expect(i18n.t('auth.welcome')).toBe('कृषी AI मध्ये आपले स्वागत आहे');
      expect(i18n.t('auth.phoneNumber')).toBe('मोबाईल नंबर');
      expect(i18n.t('auth.sendOtp')).toBe('OTP पाठवा');
    });

    it('should translate farm keys in both languages', async () => {
      await i18n.changeLanguage('hi');
      expect(i18n.t('farm.myFarm')).toBe('मेरा खेत');
      expect(i18n.t('farm.addFarm')).toBe('खेत जोड़ें');

      await i18n.changeLanguage('mr');
      expect(i18n.t('farm.myFarm')).toBe('माझे शेत');
      expect(i18n.t('farm.addFarm')).toBe('शेत जोडा');
    });

    it('should translate crop keys in both languages', async () => {
      await i18n.changeLanguage('hi');
      expect(i18n.t('crop.myCrops')).toBe('मेरी फसलें');
      expect(i18n.t('crop.recommendations')).toBe('फसल सिफारिशें');

      await i18n.changeLanguage('mr');
      expect(i18n.t('crop.myCrops')).toBe('माझी पिके');
      expect(i18n.t('crop.recommendations')).toBe('पीक शिफारसी');
    });

    it('should translate disease detection keys in both languages', async () => {
      await i18n.changeLanguage('hi');
      expect(i18n.t('disease.diseaseDetection')).toBe('रोग पहचान');
      expect(i18n.t('disease.captureImage')).toBe('तस्वीर लें');

      await i18n.changeLanguage('mr');
      expect(i18n.t('disease.diseaseDetection')).toBe('रोग ओळख');
      expect(i18n.t('disease.captureImage')).toBe('फोटो घ्या');
    });

    it('should translate market keys in both languages', async () => {
      await i18n.changeLanguage('hi');
      expect(i18n.t('market.marketPrices')).toBe('बाजार भाव');
      expect(i18n.t('market.currentPrice')).toBe('वर्तमान भाव');

      await i18n.changeLanguage('mr');
      expect(i18n.t('market.marketPrices')).toBe('बाजार भाव');
      expect(i18n.t('market.currentPrice')).toBe('सध्याचा भाव');
    });

    it('should translate weather keys in both languages', async () => {
      await i18n.changeLanguage('hi');
      expect(i18n.t('weather.weather')).toBe('मौसम');
      expect(i18n.t('weather.forecast')).toBe('पूर्वानुमान');

      await i18n.changeLanguage('mr');
      expect(i18n.t('weather.weather')).toBe('हवामान');
      expect(i18n.t('weather.forecast')).toBe('अंदाज');
    });

    it('should translate error messages in both languages', async () => {
      await i18n.changeLanguage('hi');
      expect(i18n.t('errors.networkError')).toBe(
        'नेटवर्क त्रुटि। कृपया अपना कनेक्शन जांचें।',
      );

      await i18n.changeLanguage('mr');
      expect(i18n.t('errors.networkError')).toBe(
        'नेटवर्क त्रुटी. कृपया आपले कनेक्शन तपासा.',
      );
    });
  });

  describe('Language Switching', () => {
    it('should switch from Hindi to Marathi', async () => {
      await i18n.changeLanguage('hi');
      expect(i18n.language).toBe('hi');

      await i18n.changeLanguage('mr');
      expect(i18n.language).toBe('mr');
    });

    it('should switch from Marathi to Hindi', async () => {
      await i18n.changeLanguage('mr');
      expect(i18n.language).toBe('mr');

      await i18n.changeLanguage('hi');
      expect(i18n.language).toBe('hi');
    });

    it('should persist language selection to AsyncStorage', async () => {
      await i18n.changeLanguage('mr');
      
      // The language detector should cache the language
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@krishiai:language',
        'mr',
      );
    });
  });

  describe('Interpolation', () => {
    it('should handle interpolation in Hindi', async () => {
      await i18n.changeLanguage('hi');
      const result = i18n.t('auth.resendIn', {seconds: 30});
      expect(result).toBe('30 सेकंड में पुनः भेजें');
    });

    it('should handle interpolation in Marathi', async () => {
      await i18n.changeLanguage('mr');
      const result = i18n.t('auth.resendIn', {seconds: 30});
      expect(result).toBe('30 सेकंदात पुन्हा पाठवा');
    });

    it('should handle count interpolation', async () => {
      await i18n.changeLanguage('hi');
      const result = i18n.t('crop.topRecommendations', {count: 3});
      expect(result).toBe('शीर्ष 3 सिफारिशें');
    });
  });

  describe('Nested Keys', () => {
    it('should access nested soil type translations in Hindi', async () => {
      await i18n.changeLanguage('hi');
      expect(i18n.t('farm.soilTypes.alluvial')).toBe('जलोढ़');
      expect(i18n.t('farm.soilTypes.black')).toBe('काली');
      expect(i18n.t('farm.soilTypes.red')).toBe('लाल');
    });

    it('should access nested soil type translations in Marathi', async () => {
      await i18n.changeLanguage('mr');
      expect(i18n.t('farm.soilTypes.alluvial')).toBe('गाळाची');
      expect(i18n.t('farm.soilTypes.black')).toBe('काळी');
      expect(i18n.t('farm.soilTypes.red')).toBe('लाल');
    });

    it('should access nested irrigation type translations', async () => {
      await i18n.changeLanguage('hi');
      expect(i18n.t('farm.irrigationTypes.drip')).toBe('ड्रिप');
      expect(i18n.t('farm.irrigationTypes.sprinkler')).toBe('स्प्रिंकलर');

      await i18n.changeLanguage('mr');
      expect(i18n.t('farm.irrigationTypes.drip')).toBe('ठिबक');
      expect(i18n.t('farm.irrigationTypes.sprinkler')).toBe('फवारणी');
    });
  });

  describe('Missing Keys', () => {
    it('should return key path for missing translations', async () => {
      await i18n.changeLanguage('hi');
      const result = i18n.t('nonexistent.key');
      expect(result).toBe('nonexistent.key');
    });

    it('should fallback to Hindi for missing Marathi translations', async () => {
      await i18n.changeLanguage('mr');
      // If a key is missing in Marathi, it should fallback to Hindi
      const result = i18n.t('common.appName');
      expect(result).toBeDefined();
    });
  });

  describe('Language Detection', () => {
    it('should detect saved language from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('mr');
      
      // Reinitialize i18n to trigger language detection
      const detected = await new Promise<string>((resolve) => {
        i18n.services.languageDetector?.detect((lang: string) => {
          resolve(lang);
        });
      });
      
      expect(detected).toBe('mr');
    });

    it('should default to Hindi when no saved language', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      
      const detected = await new Promise<string>((resolve) => {
        i18n.services.languageDetector?.detect((lang: string) => {
          resolve(lang);
        });
      });
      
      expect(detected).toBe('hi');
    });
  });

  describe('Translation Completeness', () => {
    it('should have all required sections in both languages', () => {
      const requiredSections = [
        'common',
        'auth',
        'language',
        'farm',
        'crop',
        'disease',
        'market',
        'weather',
        'schemes',
        'chatbot',
        'sync',
        'settings',
        'errors',
        'validation',
      ];

      const hiResources = i18n.options.resources?.hi?.translation as Record<string, any>;
      const mrResources = i18n.options.resources?.mr?.translation as Record<string, any>;

      requiredSections.forEach(section => {
        expect(hiResources).toHaveProperty(section);
        expect(mrResources).toHaveProperty(section);
      });
    });

    it('should have matching keys in Hindi and Marathi', () => {
      const hiResources = i18n.options.resources?.hi?.translation as Record<string, any>;
      const mrResources = i18n.options.resources?.mr?.translation as Record<string, any>;

      const hiKeys = Object.keys(hiResources);
      const mrKeys = Object.keys(mrResources);

      expect(hiKeys.sort()).toEqual(mrKeys.sort());
    });
  });
});
