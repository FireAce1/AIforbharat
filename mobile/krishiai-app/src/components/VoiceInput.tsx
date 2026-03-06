/**
 * Voice Input Component
 * Reusable component for voice input on text fields
 * Supports Hindi and Marathi
 * Validates: Requirements 2.3, 9.1, 9.4
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import voiceService from '../services/voiceService';

interface VoiceInputProps {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  style?: any;
  iconSize?: number;
  showLabel?: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({
  onResult,
  onError,
  disabled = false,
  style,
  iconSize = 24,
  showLabel = true,
}) => {
  const {t, i18n} = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    checkVoiceAvailability();
    checkMicrophonePermission();

    return () => {
      // Cleanup
      if (isListening) {
        voiceService.stopListening();
      }
    };
  }, []);

  const checkVoiceAvailability = async () => {
    try {
      const available = await voiceService.isAvailable();
      setIsAvailable(available);
    } catch (error) {
      console.error('Error checking voice availability:', error);
      setIsAvailable(false);
    }
  };

  const checkMicrophonePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: t('chatbot.microphonePermission'),
            message: t('chatbot.microphonePermission'),
            buttonNeutral: t('common.cancel'),
            buttonNegative: t('common.no'),
            buttonPositive: t('common.yes'),
          },
        );
        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } catch (error) {
        console.error('Error requesting microphone permission:', error);
        setHasPermission(false);
      }
    } else {
      // iOS permissions are handled differently
      setHasPermission(true);
    }
  };

  const startListening = async () => {
    if (!isAvailable) {
      onError?.(t('chatbot.voiceNotAvailable'));
      return;
    }

    if (!hasPermission) {
      await checkMicrophonePermission();
      if (!hasPermission) {
        onError?.(t('chatbot.microphonePermission'));
        return;
      }
    }

    try {
      setIsListening(true);
      const language = voiceService.getVoiceLanguage(i18n.language);

      await voiceService.startListening({
        language,
        onSpeechStart: () => {
          console.log('Speech started');
        },
        onSpeechEnd: () => {
          console.log('Speech ended');
          setIsListening(false);
        },
        onSpeechResults: (results: string[]) => {
          if (results && results.length > 0) {
            onResult(results[0]);
          }
          setIsListening(false);
        },
        onSpeechError: (error: string) => {
          console.error('Speech error:', error);
          onError?.(error);
          setIsListening(false);
        },
      });
    } catch (error) {
      console.error('Error starting voice input:', error);
      onError?.(String(error));
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    try {
      await voiceService.stopListening();
      setIsListening(false);
    } catch (error) {
      console.error('Error stopping voice input:', error);
      setIsListening(false);
    }
  };

  const handlePress = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isAvailable) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.button,
          isListening && styles.buttonListening,
          disabled && styles.buttonDisabled,
        ]}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}>
        {isListening ? (
          <View style={styles.listeningContainer}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            {showLabel && (
              <Text style={styles.listeningText}>{t('chatbot.listening')}</Text>
            )}
          </View>
        ) : (
          <View style={styles.micContainer}>
            {/* Microphone Icon (simplified) */}
            <View style={[styles.micIcon, {width: iconSize, height: iconSize}]}>
              <View style={styles.micBody} />
              <View style={styles.micStand} />
            </View>
            {showLabel && (
              <Text style={styles.buttonText}>{t('chatbot.tapToSpeak')}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#2E7D32',
    borderRadius: 50,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 60,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonListening: {
    backgroundColor: '#D32F2F',
  },
  buttonDisabled: {
    backgroundColor: '#BDBDBD',
    opacity: 0.6,
  },
  listeningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listeningText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  micContainer: {
    alignItems: 'center',
    gap: 4,
  },
  micIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBody: {
    width: 12,
    height: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    marginBottom: 2,
  },
  micStand: {
    width: 16,
    height: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default VoiceInput;
