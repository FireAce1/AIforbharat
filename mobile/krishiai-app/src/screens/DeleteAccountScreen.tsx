/**
 * Delete Account Screen
 * 
 * Implements DPDP Act 2023 Right to be Forgotten
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import apiClient from '../services/apiClient';
import { logout } from '../store/slices/authSlice';
import { RootState } from '../store/store';

const DeleteAccountScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  
  const userPhone = useSelector((state: RootState) => state.auth.user?.phone);
  
  const [confirmPhone, setConfirmPhone] = useState('');
  const [reason, setReason] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    // Validation
    if (!confirmPhone) {
      Alert.alert(t('error'), t('privacy.enterPhoneToConfirm'));
      return;
    }

    if (confirmPhone !== userPhone) {
      Alert.alert(t('error'), t('privacy.phoneNumberMismatch'));
      return;
    }

    if (!understood) {
      Alert.alert(t('error'), t('privacy.mustUnderstandConsequences'));
      return;
    }

    // Final confirmation
    Alert.alert(
      t('privacy.deleteAccountTitle'),
      t('privacy.deleteAccountFinalWarning'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('privacy.deleteAccountPermanently'),
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              
              const response = await apiClient.post('/api/v1/compliance/delete', {
                confirmPhone,
                reason: reason || undefined
              });

              if (response.data.success) {
                Alert.alert(
                  t('privacy.accountDeleted'),
                  t('privacy.accountDeletedMessage'),
                  [
                    {
                      text: t('ok'),
                      onPress: () => {
                        // Logout and clear all local data
                        dispatch(logout());
                        navigation.reset({
                          index: 0,
                          routes: [{ name: 'PhoneInput' as never }]
                        });
                      }
                    }
                  ],
                  { cancelable: false }
                );
              }
            } catch (error: any) {
              console.error('Failed to delete account:', error);
              Alert.alert(
                t('error'),
                error.response?.data?.error || t('privacy.deleteAccountFailed')
              );
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>⚠️ {t('privacy.warning')}</Text>
        <Text style={styles.warningText}>
          {t('privacy.deleteAccountWarning')}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('privacy.whatWillBeDeleted')}</Text>
        <View style={styles.listItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{t('privacy.deleteItem1')}</Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{t('privacy.deleteItem2')}</Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{t('privacy.deleteItem3')}</Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{t('privacy.deleteItem4')}</Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{t('privacy.deleteItem5')}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t('privacy.reasonOptional')}</Text>
        <TextInput
          style={styles.textArea}
          value={reason}
          onChangeText={setReason}
          placeholder={t('privacy.reasonPlaceholder')}
          multiline
          numberOfLines={4}
          maxLength={500}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>
          {t('privacy.confirmPhoneNumber')} ({userPhone})
        </Text>
        <TextInput
          style={styles.input}
          value={confirmPhone}
          onChangeText={setConfirmPhone}
          placeholder={t('privacy.enterPhoneNumber')}
          keyboardType="phone-pad"
          maxLength={15}
        />
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setUnderstood(!understood)}
        >
          <View style={[styles.checkbox, understood && styles.checkboxChecked]}>
            {understood && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            {t('privacy.understandConsequences')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={deleting}
        >
          <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.deleteButton,
            (!understood || !confirmPhone || deleting) && styles.deleteButtonDisabled
          ]}
          onPress={handleDeleteAccount}
          disabled={!understood || !confirmPhone || deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.deleteButtonText}>
              {t('privacy.deleteAccountPermanently')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          {t('privacy.deleteAccountInfo')}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107'
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8
  },
  bullet: {
    fontSize: 16,
    color: '#666',
    marginRight: 8
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff'
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    minHeight: 100,
    textAlignVertical: 'top'
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50'
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666'
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#f44336',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  deleteButtonDisabled: {
    backgroundColor: '#ccc'
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff'
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3'
  },
  infoText: {
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18
  }
});

export default DeleteAccountScreen;
