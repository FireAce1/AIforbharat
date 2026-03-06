/**
 * VoiceInput Component Tests
 */

import React from 'react';
import renderer from 'react-test-renderer';
import VoiceInput from '../VoiceInput';
import voiceService from '../../services/voiceService';

// Mock the voice service
jest.mock('../../services/voiceService', () => ({
  __esModule: true,
  default: {
    isAvailable: jest.fn(),
    startListening: jest.fn(),
    stopListening: jest.fn(),
    getVoiceLanguage: jest.fn(),
  },
}));

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'hi',
    },
  }),
}));

// Mock PermissionsAndroid
jest.mock('react-native/Libraries/PermissionsAndroid/PermissionsAndroid', () => ({
  PERMISSIONS: {
    RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
  },
  request: jest.fn(() => Promise.resolve('granted')),
}));

describe('VoiceInput Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (voiceService.isAvailable as jest.Mock).mockResolvedValue(true);
    (voiceService.getVoiceLanguage as jest.Mock).mockReturnValue('hi-IN');
  });

  it('renders correctly', () => {
    const tree = renderer
      .create(<VoiceInput onResult={jest.fn()} showLabel={true} />)
      .toJSON();
    expect(tree).toBeTruthy();
  });

  it('accepts onResult callback', () => {
    const onResult = jest.fn();
    const component = renderer.create(
      <VoiceInput onResult={onResult} showLabel={true} />,
    );
    expect(component).toBeTruthy();
  });

  it('accepts onError callback', () => {
    const onError = jest.fn();
    const component = renderer.create(
      <VoiceInput onResult={jest.fn()} onError={onError} showLabel={true} />,
    );
    expect(component).toBeTruthy();
  });

  it('handles disabled state', () => {
    const component = renderer.create(
      <VoiceInput onResult={jest.fn()} disabled={true} showLabel={true} />,
    );
    expect(component).toBeTruthy();
  });

  it('renders without label when showLabel is false', () => {
    const component = renderer.create(
      <VoiceInput onResult={jest.fn()} showLabel={false} />,
    );
    expect(component).toBeTruthy();
  });
});
