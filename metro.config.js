/* global __dirname */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Prevent ESM packages (e.g. zustand) from leaking `import.meta.env` into the
// Metro web bundle, which crashes because the script isn't loaded as a module.
// Prioritising 'require' over 'import' makes Metro pick the CJS build instead.
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16,
});
