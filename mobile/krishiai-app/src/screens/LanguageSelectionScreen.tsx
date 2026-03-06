/**
 * Language Selection Screen
 * Full-screen language selection with native script display
 * Validates: Requirements 2.3, 9.1, 9.4
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {LanguageSelectionScreenProps} from '../types/navigation';

const LanguageSelectionScreen: React.FC<LanguageSelectionScreenProps> = ({navigation}) => {
  const {t, i18n} = useTranslation();
  const [isChanging, setIsChanging] = useState(false);

  const selectLanguage = async (lang: string) => {
    setIsChanging(true);
    try {
      await i18n.changeLanguage(lang);
      // Navigate to farm profile after language selection
      navigation.navigate('FarmProfile');
    } catch (error) {
      console.error('Error changing language:', error);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />
      <View style={styles.content}>
        {/* App Logo/Title */}
        <View style={styles.header}>
          <Text style={styles.appName}>कृषि AI</Text>
          <Text style={styles.appNameEnglish}>KrishiAI</Text>
          <Text style={styles.tagline}>
            AI-Powered Agricultural Intelligence
          </Text>
        </View>

        {/* Language Selection Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{t('language.chooseYourLanguage')}</Text>
          <Text style={styles.subtitle}>Choose Your Language</Text>
        </View>

        {/* Language Buttons */}
        <View style={styles.languageContainer}>
          {/* Hindi Button */}
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => selectLanguage('hi')}
            disabled={isChanging}
            activeOpacity={0.7}>
            <View style={styles.languageContent}>
              <Text style={styles.languageNative}>हिंदी</Text>
              <Text style={styles.languageEnglish}>Hindi</Text>
            </View>
            {isChanging && i18n.language === 'hi' && (
              <ActivityIndicator size="small" color="#FFFFFF" />
            )}
          </TouchableOpacity>

          {/* Marathi Button */}
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => selectLanguage('mr')}
            disabled={isChanging}
            activeOpacity={0.7}>
            <View style={styles.languageContent}>
              <Text style={styles.languageNative}>मराठी</Text>
              <Text style={styles.languageEnglish}>Marathi</Text>
            </View>
            {isChanging && i18n.language === 'mr' && (
              <ActivityIndicator size="small" color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Voice input and output available in selected language
          </Text>
          <Text style={styles.footerTextNative}>
            चयनित भाषा में आवाज इनपुट और आउटपुट उपलब्ध
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B5E20',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  appNameEnglish: {
    fontSize: 24,
    fontWeight: '600',
    color: '#A5D6A7',
    marginBottom: 10,
  },
  tagline: {
    fontSize: 14,
    color: '#C8E6C9',
    textAlign: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#C8E6C9',
    textAlign: 'center',
  },
  languageContainer: {
    gap: 20,
  },
  languageButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 16,
    paddingVertical: 30,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 2,
    borderColor: '#4CAF50',
    minHeight: 100,
  },
  languageContent: {
    flex: 1,
    alignItems: 'center',
  },
  languageNative: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  languageEnglish: {
    fontSize: 18,
    color: '#C8E6C9',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#C8E6C9',
    textAlign: 'center',
    marginBottom: 5,
  },
  footerTextNative: {
    fontSize: 12,
    color: '#A5D6A7',
    textAlign: 'center',
  },
});

export default LanguageSelectionScreen;
