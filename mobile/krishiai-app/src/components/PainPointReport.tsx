/**
 * Pain Point Report Component
 * 
 * Allows users to report usability issues and pain points
 * Categorizes issues by type and severity
 * 
 * Requirements: 21.5, 21.6
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store';
import { apiClient } from '../services/apiClient';

interface PainPointReportProps {
  visible: boolean;
  onClose: () => void;
  onSubmit?: () => void;
}

const CATEGORIES = [
  'performance',
  'usability',
  'accuracy',
  'connectivity',
  'language',
  'other',
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'];

export const PainPointReport: React.FC<PainPointReportProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { t, i18n } = useTranslation();
  const userId = useAppSelector((state) => state.auth.user?.id);
  
  const [category, setCategory] = useState<string>('');
  const [severity, setSeverity] = useState<string>('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert(
        t('painPoint.error'),
        t('painPoint.selectCategoryError')
      );
      return;
    }

    if (!description.trim()) {
      Alert.alert(
        t('painPoint.error'),
        t('painPoint.descriptionRequiredError')
      );
      return;
    }

    setSubmitting(true);

    try {
      await apiClient.post('/api/feedback/pain-point', {
        userId,
        category,
        description: description.trim(),
        severity,
        language: i18n.language,
      });

      Alert.alert(
        t('painPoint.thankYou'),
        t('painPoint.thankYouMessage'),
        [
          {
            text: t('common.ok'),
            onPress: () => {
              // Reset form
              setCategory('');
              setSeverity('medium');
              setDescription('');
              onSubmit?.();
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting pain point:', error);
      Alert.alert(
        t('painPoint.error'),
        t('painPoint.submitError')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical':
        return '#D32F2F';
      case 'high':
        return '#F57C00';
      case 'medium':
        return '#FBC02D';
      case 'low':
        return '#388E3C';
      default:
        return '#666';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{t('painPoint.title')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>{t('painPoint.subtitle')}</Text>

            {/* Category Selection */}
            <Text style={styles.label}>{t('painPoint.categoryLabel')}</Text>
            <View style={styles.categoriesContainer}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonSelected,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      category === cat && styles.categoryTextSelected,
                    ]}
                  >
                    {t(`painPoint.categories.${cat}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Severity Selection */}
            <Text style={styles.label}>{t('painPoint.severityLabel')}</Text>
            <View style={styles.severitiesContainer}>
              {SEVERITIES.map((sev) => (
                <TouchableOpacity
                  key={sev}
                  style={[
                    styles.severityButton,
                    severity === sev && {
                      borderColor: getSeverityColor(sev),
                      backgroundColor: `${getSeverityColor(sev)}15`,
                    },
                  ]}
                  onPress={() => setSeverity(sev)}
                >
                  <View
                    style={[
                      styles.severityIndicator,
                      { backgroundColor: getSeverityColor(sev) },
                    ]}
                  />
                  <Text style={styles.severityText}>
                    {t(`painPoint.severities.${sev}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description Input */}
            <Text style={styles.label}>{t('painPoint.descriptionLabel')}</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder={t('painPoint.descriptionPlaceholder')}
              placeholderTextColor="#999"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!category || !description.trim() || submitting) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!category || !description.trim() || submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? t('painPoint.submitting') : t('painPoint.submit')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 28,
    color: '#666',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  categoryButtonSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTextSelected: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  severitiesContainer: {
    marginBottom: 24,
  },
  severityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  severityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  severityText: {
    fontSize: 14,
    color: '#333',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 120,
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
