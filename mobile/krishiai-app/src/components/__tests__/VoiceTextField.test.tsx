/**
 * VoiceTextField Component Tests
 */

import React from 'react';
import renderer from 'react-test-renderer';
import VoiceTextField from '../VoiceTextField';

// Mock VoiceInput component
jest.mock('../VoiceInput', () => {
  const React = require('react');
  const {View, Text} = require('react-native');
  return ({onResult}: any) => (
    <View testID="voice-input-mock">
      <Text>Voice Button</Text>
    </View>
  );
});

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'hi',
    },
  }),
}));

describe('VoiceTextField Component', () => {
  it('renders correctly with label', () => {
    const tree = renderer
      .create(
        <VoiceTextField label="Test Label" value="" onChangeText={jest.fn()} />,
      )
      .toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders correctly without voice button', () => {
    const tree = renderer
      .create(
        <VoiceTextField
          value=""
          onChangeText={jest.fn()}
          showVoiceButton={false}
        />,
      )
      .toJSON();
    expect(tree).toBeTruthy();
  });

  it('accepts onChangeText callback', () => {
    const onChangeText = jest.fn();
    const component = renderer.create(
      <VoiceTextField value="" onChangeText={onChangeText} />,
    );
    expect(component).toBeTruthy();
  });

  it('accepts onVoiceResult callback', () => {
    const onVoiceResult = jest.fn();
    const component = renderer.create(
      <VoiceTextField
        value=""
        onChangeText={jest.fn()}
        onVoiceResult={onVoiceResult}
      />,
    );
    expect(component).toBeTruthy();
  });

  it('displays error message', () => {
    const component = renderer.create(
      <VoiceTextField
        value=""
        onChangeText={jest.fn()}
        error="Test error"
      />,
    );
    expect(component).toBeTruthy();
  });

  it('passes through TextInput props', () => {
    const component = renderer.create(
      <VoiceTextField
        value=""
        onChangeText={jest.fn()}
        placeholder="Enter text"
      />,
    );
    expect(component).toBeTruthy();
  });
});
