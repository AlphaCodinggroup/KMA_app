const path = require('path');

module.exports = {
  dependencies: {
    expo: {
      // Force Expo to resolve from its real pnpm package path so autolinking
      // can load the current react-native.config.js instead of falling back to
      // the legacy expo.core.ExpoModulesPackage import.
      root: path.dirname(require.resolve('expo/package.json')),
    },
  },
};
