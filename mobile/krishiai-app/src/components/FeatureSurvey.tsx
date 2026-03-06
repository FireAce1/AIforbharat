/**
 * Feature Satisfaction Survey Component
 * 
 * Collects feature-specific satisfaction ratings
 * Displayed after user completes a key feature action
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
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store';
import { apiClient } from '../services/apiClient';

interface FeatureSurveyProps {
  visible: boolean;
  feature: string;
  featureLabel: string;
  onClose: () => void;
  onSubmit?: () => void;
}

export const FeatureSurvey: React.FC<FeatureSurveyProps> = ({
  visible,
  feature,
  featureLabel,
  onClose,
  onSubmit,
}) => {
  const { t, i18n } = useTranslation();
  const userId = useAppSelector((state) => state.auth.user?.id);
  
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const satisfactionLevels = [
    { value: 1, emoji: '😞', label: t('featureSurvey.veryDissatisfied') },
    { value: 2, emoji: '😕', label: t('featureSurvey.dissatisfied') },
    { value: 3, emoji: '😐', label: t('featureSurvey.neutral') },
    { value: 4, emoji: '🙂', label: t('featureSurvey.satisfied') },
    { value: 5, emoji: '😄', label: t('featureSurvey.verySatisfied') },
  ];

  const handleSatisfactionSelect = (value: number) => {
    setSatisfaction(value);
  };

  const handleSubmit = async () => {
    if (satisfaction === null) {
      Alert.alert(
        t('featureSurvey.error'),
        t('featureSurvey.selectSatisfactionError')
      );
      return;
    }

    setSubmitting(true);

    try {
      await apiClient.post('/api/feedback/feature', {
        userId,
        feature,
        satisfaction,
        feedback: feedback.trim() || undefined,
        language: i18n.language,
      });

      Alert.alert(
        t('featureSurvey.thankYou'),
        t('featureSurvey.thankYouMessage'),
        [
          {
            text: t('common.ok'),
            onPress: () => {
              onSubmit?.();
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting feature survey:', error);
      Alert.alert(
        t('featureSurvey.error'),
        t('featureSurvey.submitError')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('featureSurvey.title')}</Text>
            <TouchableOpacity onPress={handleSkip} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Question */}
          <Text style={styles.question}>
            {t('featureSurvey.question', { feature: featureLabel })}
          </Text>

          {/* Satisfaction Levels */}
          <View style={styles.levelsContainer}>
            {satisfactionLevels.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.levelButton,
                  satisfaction === level.value && styles.levelButtonSelected,
                ]}
                onPress={() => handleSatisfactionSelect(level.value)}
              >
                <Text style={styles.levelEmoji}>{level.emoji}</Text>
                <Text style={styles.levelLabel}>{level.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Feedback Input */}
          {satisfaction !== null && (
            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackLabel}>
                {t('featureSurvey.feedbackLabel')}
              </Text>
              <TextInput
                style={styles.feedbackInput}
                placeholder={t('featureSurvey.feedbackPlaceholder')}
                placeholderTextColor="#999"
                value={feedback}
                onChangeText={setFeedback}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (satisfaction === null || submitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={satisfaction === null || submitting}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? t('featureSurvey.submitting') : t('featureSurvey.submit')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 24,
    color: '#666',
  },
  question: {
    fontSize: 15,
    color: '#333',
    marginBottom: 20,
    lineHeight: 22,
  },
  levelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  levelButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  levelButtonSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  levelEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  levelLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  feedbackContainer: {
    marginBottom: 20,
  },
  feedbackLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
