import { I18n } from 'i18n-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

const translations = {
  fr: {
    common: { loading: 'Chargement...', error: 'Erreur', success: 'Succès', cancel: 'Annuler', confirm: 'Confirmer', save: 'Enregistrer', delete: 'Supprimer', edit: 'Modifier', search: 'Rechercher', filter: 'Filtrer', refresh: 'Actualiser', back: 'Retour', next: 'Suivant', close: 'Fermer', yes: 'Oui', no: 'Non', ok: 'OK', seeAll: 'Voir tout', noResults: 'Aucun résultat', retry: 'Réessayer' },
    auth: { login: 'Connexion', register: 'Inscription', logout: 'Déconnexion', email: 'Email', password: 'Mot de passe', confirmPassword: 'Confirmer le mot de passe', username: "Nom d'utilisateur", fullName: 'Nom complet', phone: 'Téléphone', forgotPassword: 'Mot de passe oublié?', resetPassword: 'Réinitialiser le mot de passe', createAccount: 'Créer un compte', alreadyHaveAccount: 'Déjà un compte?', noAccount: "Pas encore de compte?", loginWithGoogle: 'Continuer avec Google', loginWithFacebook: 'Continuer avec Facebook', verificationCode: 'Code de vérification', sendCode: 'Envoyer le code', invalidCredentials: 'Email ou mot de passe incorrect', emailRequired: 'Email requis', passwordRequired: 'Mot de passe requis', passwordTooShort: 'Le mot de passe doit contenir au moins 6 caractères' },
    tabs: { home: 'Accueil', matches: 'Matchs', teams: 'Équipes', chat: 'Messages', profile: 'Profil' },
    home: { welcome: 'Bienvenue', upcomingMatches: 'Matchs à venir', myTeams: 'Mes équipes', findMatch: 'Trouver un match', createTeam: 'Créer une équipe', noUpcomingMatches: 'Aucun match à venir', nearbyMatches: 'Matchs à proximité' },
    matches: { createMatch: 'Créer un match', joinMatch: 'Rejoindre', leaveMatch: 'Quitter', matchDetails: 'Détails du match', players: 'Joueurs', date: 'Date', time: 'Heure', venue: 'Terrain', level: 'Niveau', format: 'Format', type: 'Type', price: 'Prix', prize: 'Récompense', needsPlayers: 'Cherche joueurs', full: 'Complet', open: 'Ouvert', confirmed: 'Confirmé', completed: 'Terminé', cancelled: 'Annulé', friendly: 'Amical', ranked: 'Classé', tournament: 'Tournoi' },
    teams: { createTeam: "Créer une équipe", joinTeam: 'Rejoindre', leaveTeam: 'Quitter', teamDetails: "Détails de l'équipe", members: 'Membres', captain: 'Capitaine', coCaptain: 'Co-Capitaine', recruiting: 'Recrute', sendRequest: 'Envoyer une demande', requestSent: 'Demande envoyée', requestPending: 'En attente', requestAccepted: 'Acceptée', requestRejected: 'Refusée', manageRequests: 'Gérer les demandes', noMembers: 'Aucun membre' },
    chat: { newMessage: 'Nouveau message', typeMessage: 'Tapez votre message...', send: 'Envoyer', noMessages: 'Aucun message', startConversation: 'Commencer une conversation' },
    profile: { editProfile: 'Modifier le profil', settings: 'Paramètres', statistics: 'Statistiques', trophies: 'Trophées', followers: 'Abonnés', following: 'Abonnements', matchesPlayed: 'Matchs joués', wins: 'Victoires', losses: 'Défaites', draws: 'Nuls', goals: 'Buts', assists: 'Passes décisives', mvpAwards: 'Prix MVP', reputation: 'Réputation', verified: 'Vérifié', premium: 'Premium' },
    settings: { language: 'Langue', notifications: 'Notifications', privacy: 'Confidentialité', help: 'Aide', about: 'À propos', termsOfService: "Conditions d'utilisation", privacyPolicy: 'Politique de confidentialité', contactUs: 'Nous contacter', deleteAccount: 'Supprimer le compte', darkMode: 'Mode sombre', pushNotifications: 'Notifications push', emailNotifications: 'Notifications email' },
    sports: { football: 'Football', basketball: 'Basketball', volleyball: 'Volleyball', tennis: 'Tennis', handball: 'Handball', rugby: 'Rugby', badminton: 'Badminton', tabletennis: 'Tennis de table', cricket: 'Cricket', baseball: 'Baseball', hockey: 'Hockey', golf: 'Golf', swimming: 'Natation', athletics: 'Athlétisme', boxing: 'Boxe', mma: 'MMA', wrestling: 'Lutte', judo: 'Judo', karate: 'Karaté', taekwondo: 'Taekwondo', cycling: 'Cyclisme', skateboarding: 'Skateboard', surfing: 'Surf', climbing: 'Escalade', gymnastics: 'Gymnastique', esports: 'Esports', futsal: 'Futsal', beachvolleyball: 'Beach-volley', padel: 'Padel', squash: 'Squash' },
    levels: { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé', expert: 'Expert' },
    referral: { referralCode: 'Code de parrainage', inviteFriends: 'Inviter des amis', myReferrals: 'Mes filleuls', totalRewards: 'Récompenses totales', shareCode: 'Partager le code', applyCode: 'Appliquer un code', codeApplied: 'Code appliqué!', invalidCode: 'Code invalide' },
    offline: { offlineMode: 'Mode hors ligne', syncPending: 'Synchronisation en attente', lastSync: 'Dernière sync', syncNow: 'Synchroniser maintenant' },
  },
  en: {
    common: { loading: 'Loading...', error: 'Error', success: 'Success', cancel: 'Cancel', confirm: 'Confirm', save: 'Save', delete: 'Delete', edit: 'Edit', search: 'Search', filter: 'Filter', refresh: 'Refresh', back: 'Back', next: 'Next', close: 'Close', yes: 'Yes', no: 'No', ok: 'OK', seeAll: 'See all', noResults: 'No results', retry: 'Retry' },
    auth: { login: 'Login', register: 'Sign Up', logout: 'Logout', email: 'Email', password: 'Password', confirmPassword: 'Confirm Password', username: 'Username', fullName: 'Full Name', phone: 'Phone', forgotPassword: 'Forgot Password?', resetPassword: 'Reset Password', createAccount: 'Create Account', alreadyHaveAccount: 'Already have an account?', noAccount: "Don't have an account?", loginWithGoogle: 'Continue with Google', loginWithFacebook: 'Continue with Facebook', verificationCode: 'Verification Code', sendCode: 'Send Code', invalidCredentials: 'Invalid email or password', emailRequired: 'Email required', passwordRequired: 'Password required', passwordTooShort: 'Password must be at least 6 characters' },
    tabs: { home: 'Home', matches: 'Matches', teams: 'Teams', chat: 'Messages', profile: 'Profile' },
    home: { welcome: 'Welcome', upcomingMatches: 'Upcoming Matches', myTeams: 'My Teams', findMatch: 'Find Match', createTeam: 'Create Team', noUpcomingMatches: 'No upcoming matches', nearbyMatches: 'Nearby Matches' },
    matches: { createMatch: 'Create Match', joinMatch: 'Join', leaveMatch: 'Leave', matchDetails: 'Match Details', players: 'Players', date: 'Date', time: 'Time', venue: 'Venue', level: 'Level', format: 'Format', type: 'Type', price: 'Price', prize: 'Prize', needsPlayers: 'Needs Players', full: 'Full', open: 'Open', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', friendly: 'Friendly', ranked: 'Ranked', tournament: 'Tournament' },
    teams: { createTeam: 'Create Team', joinTeam: 'Join', leaveTeam: 'Leave', teamDetails: 'Team Details', members: 'Members', captain: 'Captain', coCaptain: 'Co-Captain', recruiting: 'Recruiting', sendRequest: 'Send Request', requestSent: 'Request Sent', requestPending: 'Pending', requestAccepted: 'Accepted', requestRejected: 'Rejected', manageRequests: 'Manage Requests', noMembers: 'No members' },
    chat: { newMessage: 'New Message', typeMessage: 'Type your message...', send: 'Send', noMessages: 'No messages', startConversation: 'Start a conversation' },
    profile: { editProfile: 'Edit Profile', settings: 'Settings', statistics: 'Statistics', trophies: 'Trophies', followers: 'Followers', following: 'Following', matchesPlayed: 'Matches Played', wins: 'Wins', losses: 'Losses', draws: 'Draws', goals: 'Goals', assists: 'Assists', mvpAwards: 'MVP Awards', reputation: 'Reputation', verified: 'Verified', premium: 'Premium' },
    settings: { language: 'Language', notifications: 'Notifications', privacy: 'Privacy', help: 'Help', about: 'About', termsOfService: 'Terms of Service', privacyPolicy: 'Privacy Policy', contactUs: 'Contact Us', deleteAccount: 'Delete Account', darkMode: 'Dark Mode', pushNotifications: 'Push Notifications', emailNotifications: 'Email Notifications' },
    sports: { football: 'Football', basketball: 'Basketball', volleyball: 'Volleyball', tennis: 'Tennis', handball: 'Handball', rugby: 'Rugby', badminton: 'Badminton', tabletennis: 'Table Tennis', cricket: 'Cricket', baseball: 'Baseball', hockey: 'Hockey', golf: 'Golf', swimming: 'Swimming', athletics: 'Athletics', boxing: 'Boxing', mma: 'MMA', wrestling: 'Wrestling', judo: 'Judo', karate: 'Karate', taekwondo: 'Taekwondo', cycling: 'Cycling', skateboarding: 'Skateboarding', surfing: 'Surfing', climbing: 'Climbing', gymnastics: 'Gymnastics', esports: 'Esports', futsal: 'Futsal', beachvolleyball: 'Beach Volleyball', padel: 'Padel', squash: 'Squash' },
    levels: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', expert: 'Expert' },
    referral: { referralCode: 'Referral Code', inviteFriends: 'Invite Friends', myReferrals: 'My Referrals', totalRewards: 'Total Rewards', shareCode: 'Share Code', applyCode: 'Apply Code', codeApplied: 'Code Applied!', invalidCode: 'Invalid Code' },
    offline: { offlineMode: 'Offline Mode', syncPending: 'Sync Pending', lastSync: 'Last Sync', syncNow: 'Sync Now' },
  },
};

const i18n = new I18n(translations);
i18n.defaultLocale = 'fr';
i18n.locale = 'fr';
i18n.enableFallback = true;

export const getDeviceLocale = (): string => {
  try {
    if (Platform.OS === 'ios') {
      return NativeModules.SettingsManager?.settings?.AppleLocale?.substring(0, 2) || 
             NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]?.substring(0, 2) || 'fr';
    } else if (Platform.OS === 'android') {
      return NativeModules.I18nManager?.localeIdentifier?.substring(0, 2) || 'fr';
    }
  } catch (e) { console.log('[i18n] Error getting device locale:', e); }
  return 'fr';
};

export const initI18n = async () => {
  try {
    const savedLocale = await AsyncStorage.getItem('vs_locale');
    if (savedLocale && (savedLocale === 'fr' || savedLocale === 'en')) {
      i18n.locale = savedLocale;
    } else {
      const deviceLocale = getDeviceLocale();
      i18n.locale = deviceLocale === 'en' ? 'en' : 'fr';
    }
  } catch (e) { console.log('[i18n] Error initializing:', e); }
};

export const setLocale = async (locale: 'fr' | 'en') => {
  i18n.locale = locale;
  await AsyncStorage.setItem('vs_locale', locale);
};

export const t = (key: string, options?: object): string => i18n.t(key, options);
export const getCurrentLocale = () => i18n.locale;
export const getAvailableLocales = () => ['fr', 'en'] as const;

export default i18n;
