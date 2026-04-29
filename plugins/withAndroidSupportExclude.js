const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Exclut l'ancienne lib com.android.support qui entre en conflit avec AndroidX.
 * Causé par react-native-maps qui tire encore support-compat:25.3.1
 */
const withAndroidSupportExclude = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const content = config.modResults.contents;
      const exclusionBlock = `
    configurations.all {
        exclude group: 'com.android.support', module: 'support-compat'
        exclude group: 'com.android.support', module: 'support-media-compat'
        exclude group: 'com.android.support', module: 'support-fragment'
        exclude group: 'com.android.support', module: 'support-core-utils'
        exclude group: 'com.android.support', module: 'support-core-ui'
        exclude group: 'com.android.support', module: 'support-annotations'
        exclude group: 'com.android.support', module: 'support-v4'
        exclude group: 'com.android.support', module: 'design'
    }
`;
      if (!content.includes('exclude group: \'com.android.support\'')) {
        config.modResults.contents = content.replace(
          /android\s*\{/,
          `android {${exclusionBlock}`
        );
      }
    }
    return config;
  });
};

module.exports = withAndroidSupportExclude;
