/**
 * Voice-Enabled Text Field Component
 * Text input with integrated voice input button
 * Validates: Requirements 2.3, 9.1, 9.4
 */

import React, {useState} from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import VoiceInput from './VoiceInput';

interface VoiceTextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  onVoiceResult?: (text: string) => void;
  showVoiceButton?: boolean;
  containerStyle?: any;
}

const VoiceTextField: React.FC<VoiceTextFieldProps> = ({
  label,
  error,
  onVoiceResult,
  showVoiceButton = true,
  containerStyle,
  value,
  onChangeText,
  ...textInputProps
}) => {
  const {t} = useTranslation();
  const [isFocused, setIsFocused] = useState(false);

  const handleVoiceResult = (text: string) => {
    if (onChangeText) {
      onChangeText(text);
    }
    if (onVoiceResult) {
      onVoiceResult(text);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
        ]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor="#999"
          {...textInputProps}
        />
        
        {showVoiceButton && (
          <View style={styles.voiceButtonContainer}>
            <VoiceInput
              onResult={handleVoiceResult}
              onError={(err) => console.error('Voice error:', err)}
              iconSize={20}
              showLabel={false}
              style={styles.voiceButton}
            />
          </View>
        )}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
    minHeight: 56,
  },
  inputContainerFocused: {
    borderColor: '#2E7D32',
  },
  inputContainerError: {
    borderColor: '#D32F2F',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
  },
  voiceButtonContainer: {
    marginLeft: 8,
  },
  voiceButton: {
    // Voice button styles are handled in VoiceInput component
  },
  errorText: {
    fontSize: 12,
    color: '#D32F2F',
    marginTop: 4,
    marginLeft: 4,
  },
});

export default VoiceTextField;
