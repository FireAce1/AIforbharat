import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNLocalize from 'react-native-localize';

import hi from './locales/hi.json';
import mr from './locales/mr.json';
import pa from './locales/pa.json';
import kn from './locales/kn.json';
import te from './locales/te.json';

const LANGUAGE_STORAGE_KEY = '@krishiai:language';

// Supported languages with their native names
export const SUPPORTED_LANGUAGES = [
  { code: 'hi', name: 'हिंदी', nativeName: 'Hindi' },
  { code: 'mr', name: 'मराठी', nativeName: 'Marathi' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', nativeName: 'Punjabi' },
  { code: 'kn', name: 'ಕನ್ನಡ', nativeName: 'Kannada' },
  { code: 'te', name: 'తెలుగు', nativeName: 'Telugu' },
];

// Voice recognition language codes for each supported language
export const VOICE_LANGUAGE_CODES = {
  hi: 'hi-IN',
  mr: 'mr-IN',
  pa: 'pa-IN',
  kn: 'kn-IN',
  te: 'te-IN',
};

const resources = {
  hi: { translation: hi },
  mr: { translation: mr },
  pa: { translation: pa },
  kn: { translation: kn },
  te: { translation: te },
};

// Detect device language and fallback to Hindi if not supported
const getDeviceLanguage = (): string => {
  const locales = RNLocalize.getLocales();
  
  if (locales && locales.length > 0) {
    const deviceLanguage = locales[0].languageCode;
    
    // Check if device language is supported
    if (SUPPORTED_LANGUAGES.some(lang => lang.code === deviceLanguage)) {
      return deviceLanguage;
    }
  }
  
  // Default to Hindi
  return 'hi';
};

// Initialize i18n
const initI18n = async () => {
  let savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  
  if (!savedLanguage) {
    savedLanguage = getDeviceLanguage();
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, savedLanguage);
  }

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: savedLanguage,
      fallbackLng: 'hi',
      compatibilityJSON: 'v3',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });

  return savedLanguage;
};

// Change language and persist
export const changeLanguage = async (languageCode: string): Promise<void> => {
  await i18n.changeLanguage(languageCode);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
};

// Get current language
export const getCurrentLanguage = (): string => {
  return i18n.language || 'hi';
};

// Get voice language code for current language
export const getVoiceLanguageCode = (): string => {
  const currentLang = getCurrentLanguage();
  return VOICE_LANGUAGE_CODES[currentLang as keyof typeof VOICE_LANGUAGE_CODES] || 'hi-IN';
};

export { initI18n };
export default i18n;
