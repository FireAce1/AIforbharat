/**
 * Placeholder Screen
 * Temporary screen for features not yet implemented
 */

import React from 'react';
import {View, Text, StyleSheet, SafeAreaView} from 'react-native';
import {useTranslation} from 'react-i18next';

const PlaceholderScreen: React.FC = () => {
  const {t} = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🚧</Text>
        <Text style={styles.title}>{t('common.comingSoon')}</Text>
        <Text style={styles.subtitle}>{t('common.featureInDevelopment')}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default PlaceholderScreen;
