const fs = require('fs');
const c = fs.readFileSync('lib/i18n.ts', 'utf8');
const keys = ['clearCacheTitle','clearCacheMessage','clearAction','cacheCleared','clearing','clearNotificationsTitle','clearNotificationsMessage','notificationsCleared','goodbyeTitle','logoutSubtitle','logoutInfo','stayConnected','loggingOut','deleteAccountTitle','deleteAccountSubtitle','deleteAccountWarning','typeDeleteConfirm','deleting','deletePermanently','adminMode','adminModePrompt','adminCodePlaceholder','activate','adminActivated','adminActivationFailed','incorrectCode','chooseLanguage','thanksTitle','ratingSoon','trophiesTitle','trophiesUpToDate'];
keys.forEach(k => {
  const found = c.includes(k);
  console.log((found ? 'OK' : 'MISSING') + ' : ' + k);
});
