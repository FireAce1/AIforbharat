/**
 * Privacy Settings Screen
 * 
 * Allows users to manage their privacy preferences and exercise DPDP Act 2023 rights
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../services/apiClient';

interface Consent {
  id: string;
  consentType: string;
  status: string;
  grantedAt?: string;
  withdrawnAt?: string;
}

const PrivacySettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  
  const [loading, setLoading] = useState(true);
  const [consents, setConsents] = useState<Record<string, boolean>>({
    data_collection: false,
    data_processing: false,
    data_sharing: false,
    marketing: false,
    analytics: false
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadConsents();
  }, []);

  const loadConsents = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/v1/compliance/consent');
      
      if (response.data.success) {
        const consentMap: Record<string, boolean> = {};
        response.data.consents.forEach((consent: Consent) => {
          consentMap[consent.consentType] = consent.status === 'granted';
        });
        setConsents(consentMap);
      }
    } catch (error) {
      console.error('Failed to load consents:', error);
      Alert.alert(
        t('error'),
        t('privacy.failedToLoadConsents')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConsentToggle = async (consentType: string, value: boolean) => {
    try {
      const response = await apiClient.post('/api/v1/compliance/consent', {
        consentType,
        status: value ? 'granted' : 'withdrawn'
      });

      if (response.data.success) {
        setConsents(prev => ({ ...prev, [consentType]: value }));
        
        Alert.alert(
          t('success'),
          value ? t('privacy.consentGranted') : t('privacy.consentWithdrawn')
        );
      }
    } catch (error) {
      console.error('Failed to update consent:', error);
      Alert.alert(
        t('error'),
        t('privacy.failedToUpdateConsent')
      );
    }
  };

  const handleExportData = async () => {
    Alert.alert(
      t('privacy.exportData'),
      t('privacy.exportDataConfirmation'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('export'),
          onPress: async () => {
            try {
              setExporting(true);
              const response = await apiClient.post('/api/v1/compliance/export');
              
              if (response.data.success) {
                // In production, this would download the file or send via email
                Alert.alert(
                  t('success'),
                  t('privacy.exportDataSuccess'),
                  [
                    {
                      text: t('ok'),
                      onPress: () => {
                        // Could navigate to a screen showing the export data
                        console.log('Export data:', response.data.export);
                      }
                    }
                  ]
                );
              }
            } catch (error) {
              console.error('Failed to export data:', error);
              Alert.alert(
                t('error'),
                t('privacy.exportDataFailed')
              );
            } finally {
              setExporting(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    navigation.navigate('DeleteAccount' as never);
  };

  const handleViewAuditLogs = () => {
    navigation.navigate('AuditLogs' as never);
  };

  const handleViewPrivacyPolicy = () => {
    navigation.navigate('PrivacyPolicy' as never);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('privacy.consentManagement')}</Text>
        <Text style={styles.sectionDescription}>
          {t('privacy.consentManagementDescription')}
        </Text>

        <View style={styles.consentItem}>
          <View style={styles.consentInfo}>
            <Text style={styles.consentTitle}>{t('privacy.dataCollection')}</Text>
            <Text style={styles.consentDescription}>
              {t('privacy.dataCollectionDescription')}
            </Text>
          </View>
          <Switch
            value={consents.data_collection}
            onValueChange={(value) => handleConsentToggle('data_collection', value)}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
          />
        </View>

        <View style={styles.consentItem}>
          <View style={styles.consentInfo}>
            <Text style={styles.consentTitle}>{t('privacy.dataProcessing')}</Text>
            <Text style={styles.consentDescription}>
              {t('privacy.dataProcessingDescription')}
            </Text>
          </View>
          <Switch
            value={consents.data_processing}
            onValueChange={(value) => handleConsentToggle('data_processing', value)}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
          />
        </View>

        <View style={styles.consentItem}>
          <View style={styles.consentInfo}>
            <Text style={styles.consentTitle}>{t('privacy.dataSharing')}</Text>
            <Text style={styles.consentDescription}>
              {t('privacy.dataSharingDescription')}
            </Text>
          </View>
          <Switch
            value={consents.data_sharing}
            onValueChange={(value) => handleConsentToggle('data_sharing', value)}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
          />
        </View>

        <View style={styles.consentItem}>
          <View style={styles.consentInfo}>
            <Text style={styles.consentTitle}>{t('privacy.marketing')}</Text>
            <Text style={styles.consentDescription}>
              {t('privacy.marketingDescription')}
            </Text>
          </View>
          <Switch
            value={consents.marketing}
            onValueChange={(value) => handleConsentToggle('marketing', value)}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
          />
        </View>

        <View style={styles.consentItem}>
          <View style={styles.consentInfo}>
            <Text style={styles.consentTitle}>{t('privacy.analytics')}</Text>
            <Text style={styles.consentDescription}>
              {t('privacy.analyticsDescription')}
            </Text>
          </View>
          <Switch
            value={consents.analytics}
            onValueChange={(value) => handleConsentToggle('analytics', value)}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('privacy.yourRights')}</Text>
        <Text style={styles.sectionDescription}>
          {t('privacy.yourRightsDescription')}
        </Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleViewAuditLogs}
        >
          <Text style={styles.actionButtonText}>{t('privacy.viewAuditLogs')}</Text>
          <Text style={styles.actionButtonDescription}>
            {t('privacy.viewAuditLogsDescription')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleExportData}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <>
              <Text style={styles.actionButtonText}>{t('privacy.exportData')}</Text>
              <Text style={styles.actionButtonDescription}>
                {t('privacy.exportDataDescription')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleDeleteAccount}
        >
          <Text style={[styles.actionButtonText, styles.dangerText]}>
            {t('privacy.deleteAccount')}
          </Text>
          <Text style={styles.actionButtonDescription}>
            {t('privacy.deleteAccountDescription')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={handleViewPrivacyPolicy}
        >
          <Text style={styles.linkButtonText}>{t('privacy.viewPrivacyPolicy')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666'
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 8,
    padding: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20
  },
  consentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  consentInfo: {
    flex: 1,
    marginRight: 16
  },
  consentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
  },
  consentDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18
  },
  actionButton: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
  },
  actionButtonDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18
  },
  dangerButton: {
    borderColor: '#f44336'
  },
  dangerText: {
    color: '#f44336'
  },
  linkButton: {
    padding: 12,
    alignItems: 'center'
  },
  linkButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    textDecorationLine: 'underline'
  }
});

export default PrivacySettingsScreen;
