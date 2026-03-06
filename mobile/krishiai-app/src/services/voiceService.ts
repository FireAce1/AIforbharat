/**
 * Voice Service
 * Handles speech-to-text and text-to-speech functionality
 * Supports Hindi and Marathi languages
 * Validates: Requirements 2.3, 9.1, 9.4
 */

import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
  SpeechStartEvent,
  SpeechEndEvent,
} from '@react-native-voice/voice';
import Tts from 'react-native-tts';

export type VoiceLanguage = 'hi-IN' | 'mr-IN';

export interface VoiceServiceConfig {
  language: VoiceLanguage;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onSpeechResults?: (results: string[]) => void;
  onSpeechError?: (error: string) => void;
}

class VoiceService {
  private isInitialized = false;
  private currentLanguage: VoiceLanguage = 'hi-IN';

  /**
   * Initialize voice service with language
   */
  async initialize(language: VoiceLanguage = 'hi-IN'): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.currentLanguage = language;

      // Initialize TTS
      await Tts.setDefaultLanguage(language);
      await Tts.setDefaultRate(0.5); // Slower rate for better comprehension
      await Tts.setDefaultPitch(1.0);

      // Check if TTS is available
      const voices = await Tts.voices();
      const hasLanguage = voices.some(v => v.language.startsWith(language.split('-')[0]));
      
      if (!hasLanguage) {
        console.warn(`TTS voice not available for ${language}`);
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing voice service:', error);
      throw error;
    }
  }

  /**
   * Start listening for speech input
   */
  async startListening(config: VoiceServiceConfig): Promise<void> {
    try {
      // Set up event handlers
      Voice.onSpeechStart = (e: SpeechStartEvent) => {
        console.log('Speech started', e);
        config.onSpeechStart?.();
      };

      Voice.onSpeechEnd = (e: SpeechEndEvent) => {
        console.log('Speech ended', e);
        config.onSpeechEnd?.();
      };

      Voice.onSpeechResults = (e: SpeechResultsEvent) => {
        console.log('Speech results', e);
        if (e.value) {
          config.onSpeechResults?.(e.value);
        }
      };

      Voice.onSpeechError = (e: SpeechErrorEvent) => {
        console.error('Speech error', e);
        config.onSpeechError?.(e.error?.message || 'Unknown error');
      };

      // Start recognition
      await Voice.start(config.language);
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      throw error;
    }
  }

  /**
   * Stop listening for speech input
   */
  async stopListening(): Promise<void> {
    try {
      await Voice.stop();
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
      throw error;
    }
  }

  /**
   * Cancel voice recognition
   */
  async cancelListening(): Promise<void> {
    try {
      await Voice.cancel();
    } catch (error) {
      console.error('Error canceling voice recognition:', error);
      throw error;
    }
  }

  /**
   * Destroy voice recognition
   */
  async destroy(): Promise<void> {
    try {
      await Voice.destroy();
      Voice.removeAllListeners();
    } catch (error) {
      console.error('Error destroying voice recognition:', error);
      throw error;
    }
  }

  /**
   * Check if voice recognition is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const available = await Voice.isAvailable();
      return available === 1;
    } catch (error) {
      console.error('Error checking voice availability:', error);
      return false;
    }
  }

  /**
   * Speak text using TTS
   */
  async speak(text: string, language?: VoiceLanguage): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize(language || this.currentLanguage);
      }

      // Set language if different from current
      if (language && language !== this.currentLanguage) {
        await Tts.setDefaultLanguage(language);
        this.currentLanguage = language;
      }

      // Stop any ongoing speech
      await Tts.stop();

      // Speak the text
      await Tts.speak(text);
    } catch (error) {
      console.error('Error speaking text:', error);
      throw error;
    }
  }

  /**
   * Stop TTS
   */
  async stopSpeaking(): Promise<void> {
    try {
      await Tts.stop();
    } catch (error) {
      console.error('Error stopping TTS:', error);
      throw error;
    }
  }

  /**
   * Check if TTS is speaking
   */
  async isSpeaking(): Promise<boolean> {
    try {
      return await Tts.isSpeaking();
    } catch (error) {
      console.error('Error checking TTS status:', error);
      return false;
    }
  }

  /**
   * Get available TTS voices
   */
  async getAvailableVoices(): Promise<any[]> {
    try {
      return await Tts.voices();
    } catch (error) {
      console.error('Error getting available voices:', error);
      return [];
    }
  }

  /**
   * Convert language code from i18n format to voice format
   */
  getVoiceLanguage(i18nLanguage: string): VoiceLanguage {
    switch (i18nLanguage) {
      case 'hi':
        return 'hi-IN';
      case 'mr':
        return 'mr-IN';
      default:
        return 'hi-IN';
    }
  }
}

// Export singleton instance
export const voiceService = new VoiceService();
export default voiceService;
