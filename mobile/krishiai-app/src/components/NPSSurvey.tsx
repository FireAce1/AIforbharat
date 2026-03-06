/**
 * NPS Survey Component
 * 
 * In-app NPS survey for collecting user feedback
 * Displays after 7 days of usage or after key feature usage
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

interface NPSSurveyProps {
  visible: boolean;
  onClose: () => void;
  onSubmit?: () => void;
}

export const NPSSurvey: React.FC<NPSSurveyProps> = ({ visible, onClose, onSubmit }) => {
  const { t, i18n } = useTranslation();
  const userId = useAppSelector((state) => state.auth.user?.id);
  
  const [score, setScore] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleScoreSelect = (selectedScore: number) => {
    setScore(selectedScore);
  };

  const handleSubmit = async () => {
    if (score === null) {
      Alert.alert(
        t('nps.error'),
        t('nps.selectScoreError')
      );
      return;
    }

    setSubmitting(true);

    try {
      await apiClient.post('/api/feedback/nps', {
        userId,
        score,
        reason: reason.trim() || undefined,
        language: i18n.language,
      });

      Alert.alert(
        t('nps.thankYou'),
        t('nps.thankYouMessage'),
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
      console.error('Error submitting NPS survey:', error);
      Alert.alert(
        t('nps.error'),
        t('nps.submitError')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      t('nps.skipConfirm'),
      t('nps.skipMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('nps.skip'),
          onPress: onClose,
        },
      ]
    );
  };

  const getScoreLabel = () => {
    if (score === null) return '';
    if (score >= 9) return t('nps.veryLikely');
    if (score >= 7) return t('nps.likely');
    return t('nps.unlikely');
  };

  const getFollowUpQuestion = () => {
    if (score === null) return '';
    if (score >= 9) return t('nps.promoterQuestion');
    if (score >= 7) return t('nps.passiveQuestion');
    return t('nps.detractorQuestion');
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
              <Text style={styles.title}>{t('nps.title')}</Text>
              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>{t('nps.skip')}</Text>
              </TouchableOpacity>
            </View>

            {/* Question */}
            <Text style={styles.question}>{t('nps.question')}</Text>

            {/* Score Selection */}
            <View style={styles.scoresContainer}>
              <View style={styles.scoresRow}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.scoreButton,
                      score === num && styles.scoreButtonSelected,
                    ]}
                    onPress={() => handleScoreSelect(num)}
                  >
                    <Text
                      style={[
                        styles.scoreText,
                        score === num && styles.scoreTextSelected,
                      ]}
                    >
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.scoresLabels}>
                <Text style={styles.scoreLabelText}>{t('nps.notLikely')}</Text>
                <Text style={styles.scoreLabelText}>{t('nps.veryLikely')}</Text>
              </View>
            </View>

            {/* Selected Score Label */}
            {score !== null && (
              <Text style={styles.scoreLabel}>{getScoreLabel()}</Text>
            )}

            {/* Follow-up Question */}
            {score !== null && (
              <View style={styles.followUpContainer}>
                <Text style={styles.followUpQuestion}>{getFollowUpQuestion()}</Text>
                <TextInput
                  style={styles.reasonInput}
                  placeholder={t('nps.reasonPlaceholder')}
                  placeholderTextColor="#999"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (score === null || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={score === null || submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? t('nps.submitting') : t('nps.submit')}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#666',
  },
  question: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    lineHeight: 24,
  },
  scoresContainer: {
    marginBottom: 20,
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scoreButton: {
    width: 32,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  scoreButtonSelected: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  scoreTextSelected: {
    color: '#fff',
  },
  scoresLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreLabelText: {
    fontSize: 12,
    color: '#666',
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 20,
  },
  followUpContainer: {
    marginBottom: 20,
  },
  followUpQuestion: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    lineHeight: 20,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
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
