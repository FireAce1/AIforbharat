/**
 * Language Selector Component
 * Allows users to switch between Hindi and Marathi
 * Updated with native script display
 */

import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';

const LanguageSelector: React.FC = () => {
  const {t, i18n} = useTranslation();

  const changeLanguage = async (lang: string) => {
    try {
      await i18n.changeLanguage(lang);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const currentLanguage = i18n.language;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('language.selectLanguage')}</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            currentLanguage === 'hi' && styles.activeButton,
          ]}
          onPress={() => changeLanguage('hi')}>
          <Text style={styles.nativeText}>हिंदी</Text>
          <Text
            style={[
              styles.buttonText,
              currentLanguage === 'hi' && styles.activeButtonText,
            ]}>
            Hindi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            currentLanguage === 'mr' && styles.activeButton,
          ]}
          onPress={() => changeLanguage('mr')}>
          <Text style={styles.nativeText}>मराठी</Text>
          <Text
            style={[
              styles.buttonText,
              currentLanguage === 'mr' && styles.activeButtonText,
            ]}>
            Marathi
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginVertical: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 15,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2E7D32',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#2E7D32',
  },
  nativeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    textAlign: 'center',
  },
  activeButtonText: {
    color: '#FFFFFF',
  },
});

export default LanguageSelector;
