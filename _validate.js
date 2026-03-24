const fs = require('fs');
const result = [];
try {
  const content = fs.readFileSync('lib/i18n.ts', 'utf8');
  
  // Extract the translations object
  const match = content.match(/const translations = (\{[\s\S]*?\n\});/);
  if (!match) {
    result.push('ERROR: Could not extract translations object');
  } else {
    try {
      // Try to eval the object (it's plain JS object literals)
      const obj = eval('(' + match[1] + ')');
      result.push('OK: translations parsed successfully');
      result.push('FR keys: ' + Object.keys(obj.fr).join(', '));
      result.push('EN keys: ' + Object.keys(obj.en).join(', '));
      
      // Check specific settings keys
      const frSettings = obj.fr.settings || {};
      const enSettings = obj.en.settings || {};
      const checkKeys = ['clearCacheTitle','clearCacheMessage','clearAction','cacheCleared','clearing',
        'clearNotificationsTitle','clearNotificationsMessage','notificationsCleared',
        'goodbyeTitle','logoutSubtitle','logoutInfo','stayConnected','loggingOut',
        'deleteAccountTitle','deleteAccountSubtitle','deleteAccountWarning','typeDeleteConfirm',
        'deleting','deletePermanently','adminMode','adminModePrompt','adminCodePlaceholder',
        'activate','adminActivated','adminActivationFailed','incorrectCode','chooseLanguage',
        'thanksTitle','ratingSoon','trophiesTitle','trophiesUpToDate'];
      
      checkKeys.forEach(k => {
        const frHas = k in frSettings;
        const enHas = k in enSettings;
        if (!frHas || !enHas) {
          result.push('MISSING: ' + k + ' (FR:' + frHas + ' EN:' + enHas + ')');
        }
      });
    } catch (e) {
      result.push('PARSE ERROR: ' + e.message);
    }
  }
} catch (e) {
  result.push('FILE ERROR: ' + e.message);
}

fs.writeFileSync('_validate_result.txt', result.join('\n'));
