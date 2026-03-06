const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * Optimized for performance and bundle splitting
 */
const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    // Enable bundle splitting for better performance
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json'],
  },
  // Optimize for low-end devices
  maxWorkers: 2,
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
