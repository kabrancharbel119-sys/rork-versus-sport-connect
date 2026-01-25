import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Switch, Alert, Modal, Share, Platform, AccessibilityInfo, TextInput } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Lock, Moon, MapPin, Shield, HelpCircle, FileText, Mail, Trash2, ChevronRight, LogOut, CheckCircle, Trophy, Search, Users, Star, Share2, Volume2, Vibrate, Eye, Database, RefreshCw, Gift, Wifi, WifiOff, Languages, Accessibility, AlertTriangle, UserX } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTrophies } from '@/contexts/TrophiesContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setLocale, getCurrentLocale } from '@/lib/i18n';
import { offlineManager } from '@/lib/offline';
import { setNotificationsEnabled, getNotificationsEnabled } from '@/lib/notifications';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, deleteAccount, isAdmin, makeAdmin, isDeleteLoading } = useAuth();
  const { getUnlockedCount, getTotalXP, checkAndUnlockTrophies } = useTrophies();
  const { clearAll: clearNotifications, getUnreadCount } = useNotifications();
  
  const [notifications, setNotifications] = useState(true);
  const [matchAlerts, setMatchAlerts] = useState(true);
  const [teamAlerts, setTeamAlerts] = useState(true);
  const [chatAlerts, setChatAlerts] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [profileVisible, setProfileVisible] = useState(true);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<'fr' | 'en'>('fr');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [versionTaps, setVersionTaps] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const unlockedTrophies = user ? getUnlockedCount(user.id) : 0;
  const totalXP = user ? getTotalXP(user.id) : 0;
  const unreadNotifs = getUnreadCount();

  useEffect(() => {
    loadSettings();
    setCurrentLanguage(getCurrentLocale() as 'fr' | 'en');
    setIsOnline(offlineManager.getIsOnline());
    offlineManager.getPendingCount().then(setPendingSync);
    const unsubscribe = offlineManager.subscribe(setIsOnline);
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    return unsubscribe;
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('vs_settings');
      const notifsEnabled = await getNotificationsEnabled();
      setNotifications(notifsEnabled);
      if (settings) {
        const parsed = JSON.parse(settings);
        setMatchAlerts(parsed.matchAlerts ?? true);
        setTeamAlerts(parsed.teamAlerts ?? true);
        setChatAlerts(parsed.chatAlerts ?? true);
        setSoundEnabled(parsed.soundEnabled ?? true);
        setVibrationEnabled(parsed.vibrationEnabled ?? true);
        setDarkMode(parsed.darkMode ?? true);
        setLocationEnabled(parsed.locationEnabled ?? true);
        setProfileVisible(parsed.profileVisible ?? true);
      }
    } catch (e) { console.log('[Settings] Error loading:', e); }
  };

  const saveSettings = async (key: string, value: boolean) => {
    try {
      const settings = await AsyncStorage.getItem('vs_settings');
      const parsed = settings ? JSON.parse(settings) : {};
      parsed[key] = value;
      await AsyncStorage.setItem('vs_settings', JSON.stringify(parsed));
    } catch (e) { console.log('[Settings] Error saving:', e); }
  };

  const handleToggle = (key: string, setter: (v: boolean) => void) => (value: boolean) => {
    setter(value);
    saveSettings(key, value);
  };

  const handleNotificationsToggle = async (value: boolean) => {
    setNotifications(value);
    await setNotificationsEnabled(value);
  };

  const handleLanguageChange = async (lang: 'fr' | 'en') => {
    await setLocale(lang);
    setCurrentLanguage(lang);
    setShowLanguageModal(false);
    Alert.alert(lang === 'fr' ? 'Langue modifiée' : 'Language changed', lang === 'fr' ? 'L\'application est maintenant en français.' : 'The app is now in English.');
  };

  const handleShareReferral = async () => {
    const code = user ? `VS${user.id.slice(-6).toUpperCase()}` : 'VS000000';
    const message = `🏆 Rejoins VS - L'app qui révolutionne le sport amateur!\n\nUtilise mon code: ${code}\n\nTélécharge l'app et gagne 50 FCFA de bonus!`;
    try {
      if (Platform.OS === 'web') { if (navigator.share) await navigator.share({ title: 'VS', text: message }); else await navigator.clipboard.writeText(message); }
      else await Share.share({ message, title: 'Rejoins VS!' });
    } catch (e) { console.log('[Settings] Share error:', e); }
  };

  const handleSyncNow = async () => {
    await offlineManager.processQueue();
    const count = await offlineManager.getPendingCount();
    setPendingSync(count);
    Alert.alert('Synchronisation', count === 0 ? 'Tout est à jour!' : `${count} actions en attente.`);
  };

  const handleLogout = () => setShowLogoutModal(true);
  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setShowLogoutModal(false);
      router.replace('/auth/welcome');
    } catch (e) {
      console.log('[Settings] Logout error:', e);
    } finally {
      setIsLoggingOut(false);
    }
  };
  const handleDeleteAccount = () => setShowDeleteModal(true);
  const confirmDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') {
      Alert.alert('Erreur', 'Veuillez taper SUPPRIMER pour confirmer.');
      return;
    }
    try {
      await deleteAccount(deleteConfirmText);
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      router.replace('/auth/welcome');
    } catch (e) {
      console.log('[Settings] Delete account error:', e);
      Alert.alert('Erreur', 'Impossible de supprimer le compte. Veuillez réessayer.');
    }
  };
  const handleClearCache = () => Alert.alert('Vider le cache', 'Cela supprimera les données temporaires.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Vider', onPress: async () => { await offlineManager.clearCache(); Alert.alert('Succès', 'Cache vidé.'); } }]);
  const handleClearNotifications = () => Alert.alert('Effacer les notifications', 'Supprimer toutes vos notifications ?', [{ text: 'Annuler', style: 'cancel' }, { text: 'Effacer', style: 'destructive', onPress: async () => { await clearNotifications(); Alert.alert('Succès', 'Notifications supprimées.'); } }]);
  const handleRefreshTrophies = async () => { if (!user) return; const unlocked = await checkAndUnlockTrophies(user.id, { matchesPlayed: user.stats.matchesPlayed, wins: user.stats.wins, goalsScored: user.stats.goalsScored, assists: user.stats.assists, mvpAwards: user.stats.mvpAwards, tournamentWins: user.stats.tournamentWins, followers: user.followers, isVerified: user.isVerified, isPremium: user.isPremium, isCaptain: false, fairPlayScore: user.stats.fairPlayScore, hasTeam: (user.teams?.length || 0) > 0, profileComplete: !!(user.fullName && user.city && user.sports?.length > 0) }); if (unlocked.length === 0) Alert.alert('Trophées', 'Vos trophées sont à jour!'); };

  const SettingRow = ({ icon, title, value, onPress, toggle, toggleValue, onToggle, danger, badge }: { icon: React.ReactNode; title: string; value?: string; onPress?: () => void; toggle?: boolean; toggleValue?: boolean; onToggle?: (v: boolean) => void; danger?: boolean; badge?: string | number }) => (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} disabled={toggle} activeOpacity={toggle ? 1 : 0.7} accessibilityRole={toggle ? 'switch' : 'button'} accessibilityLabel={title} accessibilityValue={toggle ? { text: toggleValue ? 'activé' : 'désactivé' } : value ? { text: value } : undefined}>
      <View style={[styles.settingIcon, danger && styles.dangerIcon]}>{icon}</View>
      <View style={styles.settingContent}><Text style={[styles.settingTitle, danger && styles.dangerText]}>{title}</Text>{value && <Text style={styles.settingValue}>{value}</Text>}</View>
      {badge !== undefined && <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>}
      {toggle ? <Switch value={toggleValue} onValueChange={onToggle} trackColor={{ false: Colors.background.cardLight, true: Colors.primary.blue }} thumbColor="#FFFFFF" /> : <ChevronRight size={20} color={Colors.text.muted} />}
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Retour"><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle} accessibilityRole="header">Réglages</Text>
            <View style={styles.statusIndicator}>{isOnline ? <Wifi size={20} color={Colors.status.success} /> : <WifiOff size={20} color={Colors.status.error} />}</View>
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {!isOnline && (
              <Card style={styles.offlineBanner}><WifiOff size={20} color={Colors.status.warning} /><View style={styles.offlineText}><Text style={styles.offlineTitle}>Mode hors ligne</Text><Text style={styles.offlineSub}>{pendingSync} action(s) en attente</Text></View><TouchableOpacity style={styles.syncButton} onPress={handleSyncNow}><RefreshCw size={16} color="#FFF" /></TouchableOpacity></Card>
            )}

            {isAdmin && (<><Text style={styles.sectionTitle}>Administration</Text><Card style={styles.section}><SettingRow icon={<Shield size={20} color={Colors.primary.orange} />} title="Panneau admin" value="Gérer l'application" onPress={() => router.push('/admin')} /></Card></>)}

            <Text style={styles.sectionTitle}>Compte</Text>
            <Card style={styles.section}>
              <SettingRow icon={<Users size={20} color={Colors.text.secondary} />} title="Modifier le profil" onPress={() => router.push('/edit-profile')} />
              <SettingRow icon={<CheckCircle size={20} color={user?.isVerified ? Colors.primary.blue : Colors.text.secondary} />} title="Vérification" value={user?.isVerified ? 'Compte vérifié ✓' : 'Demander la vérification'} onPress={() => router.push('/verification')} />
              <SettingRow icon={<Trophy size={20} color={Colors.primary.orange} />} title="Trophées & Récompenses" value={`${unlockedTrophies} débloqués • ${totalXP} XP`} onPress={() => router.push('/trophies')} />
              <SettingRow icon={<RefreshCw size={20} color={Colors.text.secondary} />} title="Actualiser les trophées" onPress={handleRefreshTrophies} />
              <SettingRow icon={<Search size={20} color={Colors.text.secondary} />} title="Rechercher" onPress={() => router.push('/search')} />
              <SettingRow icon={<Trash2 size={20} color={Colors.status.error} />} title="Supprimer mon compte" onPress={handleDeleteAccount} danger />
            </Card>

            <Text style={styles.sectionTitle}>Notifications</Text>
            <Card style={styles.section}>
              <SettingRow icon={<Bell size={20} color={Colors.text.secondary} />} title="Notifications push" toggle toggleValue={notifications} onToggle={handleNotificationsToggle} />
              <SettingRow icon={<Bell size={20} color={Colors.text.secondary} />} title="Alertes matchs" toggle toggleValue={matchAlerts} onToggle={handleToggle('matchAlerts', setMatchAlerts)} />
              <SettingRow icon={<Bell size={20} color={Colors.text.secondary} />} title="Alertes équipes" toggle toggleValue={teamAlerts} onToggle={handleToggle('teamAlerts', setTeamAlerts)} />
              <SettingRow icon={<Bell size={20} color={Colors.text.secondary} />} title="Alertes chat" toggle toggleValue={chatAlerts} onToggle={handleToggle('chatAlerts', setChatAlerts)} />
              <SettingRow icon={<Volume2 size={20} color={Colors.text.secondary} />} title="Sons" toggle toggleValue={soundEnabled} onToggle={handleToggle('soundEnabled', setSoundEnabled)} />
              <SettingRow icon={<Vibrate size={20} color={Colors.text.secondary} />} title="Vibrations" toggle toggleValue={vibrationEnabled} onToggle={handleToggle('vibrationEnabled', setVibrationEnabled)} />
              {unreadNotifs > 0 && <SettingRow icon={<Trash2 size={20} color={Colors.text.secondary} />} title="Effacer les notifications" value={`${unreadNotifs} non lues`} onPress={handleClearNotifications} />}
            </Card>

            <Text style={styles.sectionTitle}>Confidentialité & Sécurité</Text>
            <Card style={styles.section}>
              <SettingRow icon={<MapPin size={20} color={Colors.text.secondary} />} title="Localisation" toggle toggleValue={locationEnabled} onToggle={handleToggle('locationEnabled', setLocationEnabled)} />
              <SettingRow icon={<Eye size={20} color={Colors.text.secondary} />} title="Profil visible" toggle toggleValue={profileVisible} onToggle={handleToggle('profileVisible', setProfileVisible)} />
              <SettingRow icon={<Lock size={20} color={Colors.text.secondary} />} title="Changer le mot de passe" onPress={() => router.push('/forgot-password')} />
            </Card>

            <Text style={styles.sectionTitle}>Apparence & Langue</Text>
            <Card style={styles.section}>
              <SettingRow icon={<Moon size={20} color={Colors.text.secondary} />} title="Mode sombre" toggle toggleValue={darkMode} onToggle={(v) => { setDarkMode(v); saveSettings('darkMode', v); }} />
              <SettingRow icon={<Languages size={20} color={Colors.text.secondary} />} title="Langue" value={currentLanguage === 'fr' ? 'Français' : 'English'} onPress={() => setShowLanguageModal(true)} />
            </Card>

            <Text style={styles.sectionTitle}>Accessibilité</Text>
            <Card style={styles.section}>
              <SettingRow icon={<Accessibility size={20} color={Colors.text.secondary} />} title="Lecteur d'écran" value={screenReader ? 'Activé' : 'Désactivé'} onPress={() => Alert.alert('Accessibilité', 'Activez le lecteur d\'écran dans les paramètres de votre appareil.')} />
              <SettingRow icon={<Eye size={20} color={Colors.text.secondary} />} title="Réduire les mouvements" value={reduceMotion ? 'Activé' : 'Désactivé'} onPress={() => Alert.alert('Accessibilité', 'Activez cette option dans les paramètres de votre appareil.')} />
            </Card>

            <Text style={styles.sectionTitle}>Parrainage</Text>
            <Card style={styles.section}>
              <SettingRow icon={<Gift size={20} color={Colors.primary.orange} />} title="Mon code parrain" value={user ? `VS${user.id.slice(-6).toUpperCase()}` : ''} onPress={handleShareReferral} />
              <SettingRow icon={<Share2 size={20} color={Colors.text.secondary} />} title="Inviter des amis" value="Gagnez 100 FCFA par filleul" onPress={handleShareReferral} />
            </Card>

            <Text style={styles.sectionTitle}>Données & Stockage</Text>
            <Card style={styles.section}>
              <SettingRow icon={<Database size={20} color={Colors.text.secondary} />} title="Vider le cache" onPress={handleClearCache} />
              {pendingSync > 0 && <SettingRow icon={<RefreshCw size={20} color={Colors.text.secondary} />} title="Synchroniser" value={`${pendingSync} en attente`} onPress={handleSyncNow} />}
            </Card>

            <Text style={styles.sectionTitle}>Support & Aide</Text>
            <Card style={styles.section}>
              <SettingRow icon={<HelpCircle size={20} color={Colors.text.secondary} />} title="Centre d'aide" onPress={() => Alert.alert('Centre d\'aide', 'FAQ disponible:\n\n• Comment créer une équipe?\n• Comment rejoindre un match?\n• Comment participer à un tournoi?')} />
              <SettingRow icon={<Mail size={20} color={Colors.text.secondary} />} title="Nous contacter" onPress={() => router.push('/contact')} />
              <SettingRow icon={<Star size={20} color={Colors.text.secondary} />} title="Noter l'application" onPress={() => Alert.alert('Merci!', 'La notation sera disponible sur les stores.')} />
            </Card>

            <Text style={styles.sectionTitle}>Légal</Text>
            <Card style={styles.section}>
              <SettingRow icon={<FileText size={20} color={Colors.text.secondary} />} title="Conditions d'utilisation" onPress={() => router.push('/terms')} />
              <SettingRow icon={<FileText size={20} color={Colors.text.secondary} />} title="Politique de confidentialité" onPress={() => router.push('/privacy')} />
            </Card>

            <Card style={[styles.section, { marginTop: 24 }]}>
              <SettingRow icon={<LogOut size={20} color={Colors.text.secondary} />} title="Se déconnecter" onPress={handleLogout} />
            </Card>

            

            <TouchableOpacity onPress={() => {
              const newTaps = versionTaps + 1;
              setVersionTaps(newTaps);
              if (newTaps >= 5) {
                setShowAdminModal(true);
                setVersionTaps(0);
              }
            }} activeOpacity={0.9}>
              <Text style={styles.versionText}>VS Versus v1.0.0{'\n'}© 2026 Versus. Tous droits réservés.</Text>
            </TouchableOpacity>
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>

        <Modal visible={showLogoutModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.logoutModal}>
              <LinearGradient
                colors={['rgba(255, 107, 0, 0.15)', 'rgba(255, 107, 0, 0.05)', 'transparent']}
                style={styles.logoutGradientBg}
              />
              <View style={styles.logoutIconWrapper}>
                <LinearGradient
                  colors={[Colors.primary.orange, Colors.primary.orangeDark]}
                  style={styles.logoutIconGradient}
                >
                  <LogOut size={32} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <Text style={styles.logoutTitle}>À bientôt !</Text>
              <Text style={styles.logoutSubtitle}>
                Tu es sur le point de te déconnecter de ton compte VS.
              </Text>
              <View style={styles.logoutInfoBox}>
                <Shield size={16} color={Colors.text.secondary} />
                <Text style={styles.logoutInfoText}>
                  Tes données et ta progression seront sauvegardées
                </Text>
              </View>
              <View style={styles.logoutActions}>
                <TouchableOpacity
                  style={styles.logoutCancelButton}
                  onPress={() => setShowLogoutModal(false)}
                  disabled={isLoggingOut}
                  activeOpacity={0.7}
                >
                  <Text style={styles.logoutCancelText}>Rester connecté</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.logoutConfirmButton, isLoggingOut && styles.logoutConfirmButtonDisabled]}
                  onPress={confirmLogout}
                  disabled={isLoggingOut}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[Colors.primary.orange, Colors.primary.orangeDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.logoutConfirmGradient}
                  >
                    <LogOut size={18} color="#FFFFFF" />
                    <Text style={styles.logoutConfirmText}>
                      {isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showAdminModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.languageModal}>
              <Shield size={40} color={Colors.primary.orange} style={{ alignSelf: 'center', marginBottom: 16 }} />
              <Text style={styles.modalTitle}>Mode Administrateur</Text>
              <Text style={[styles.settingValue, { textAlign: 'center', marginBottom: 16 }]}>Entrez le code secret pour activer l{"'"}accès admin</Text>
              <TextInput
                style={styles.adminCodeInput}
                placeholder="Code admin"
                placeholderTextColor={Colors.text.muted}
                value={adminCode}
                onChangeText={setAdminCode}
                secureTextEntry
                autoCapitalize="none"
              />
              <Button
                title="Activer"
                onPress={async () => {
                  if (adminCode === 'VS2026ADMIN') {
                    try {
                      await makeAdmin();
                      Alert.alert('Succès', 'Mode admin activé!');
                    } catch (e) {
                      console.log('[Settings] Admin activation error:', e);
                      Alert.alert('Erreur', 'Impossible d\'activer le mode admin');
                    }
                    setShowAdminModal(false);
                    setAdminCode('');
                  } else {
                    Alert.alert('Erreur', 'Code incorrect');
                  }
                }}
                style={{ marginTop: 8 }}
              />
              <Button title="Annuler" onPress={() => { setShowAdminModal(false); setAdminCode(''); }} variant="outline" style={styles.closeButton} />
            </View>
          </View>
        </Modal>

        <Modal visible={showLanguageModal} transparent animationType="fade">
          <View style={styles.modalOverlay}><View style={styles.languageModal}>
            <Text style={styles.modalTitle}>Choisir la langue</Text>
            {[{ code: 'fr' as const, label: 'Français', flag: '🇫🇷' }, { code: 'en' as const, label: 'English', flag: '🇬🇧' }].map(lang => (
              <TouchableOpacity key={lang.code} style={[styles.languageOption, currentLanguage === lang.code && styles.languageOptionActive]} onPress={() => handleLanguageChange(lang.code)}>
                <Text style={styles.languageFlag}>{lang.flag}</Text><Text style={[styles.languageLabel, currentLanguage === lang.code && styles.languageLabelActive]}>{lang.label}</Text>
                {currentLanguage === lang.code && <CheckCircle size={20} color={Colors.primary.blue} />}
              </TouchableOpacity>
            ))}
            <Button title="Fermer" onPress={() => setShowLanguageModal(false)} variant="outline" style={styles.closeButton} />
          </View></View>
        </Modal>

        <Modal visible={showDeleteModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.deleteModal}>
              <LinearGradient
                colors={['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.05)', 'transparent']}
                style={styles.deleteGradientBg}
              />
              <View style={styles.deleteIconWrapper}>
                <View style={styles.deleteIconCircle}>
                  <UserX size={32} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.deleteTitle}>Supprimer le compte</Text>
              <Text style={styles.deleteSubtitle}>
                Cette action est définitive et irréversible. Toutes vos données seront supprimées.
              </Text>
              <View style={styles.deleteWarningBox}>
                <AlertTriangle size={16} color={Colors.status.error} />
                <Text style={styles.deleteWarningText}>
                  Matchs, équipes, statistiques et messages seront perdus
                </Text>
              </View>
              <Text style={styles.deleteConfirmLabel}>Tapez SUPPRIMER pour confirmer</Text>
              <TextInput
                style={styles.deleteConfirmInput}
                placeholder="SUPPRIMER"
                placeholderTextColor={Colors.text.muted}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                autoCapitalize="characters"
              />
              <View style={styles.deleteActions}>
                <TouchableOpacity
                  style={styles.deleteCancelButton}
                  onPress={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                  disabled={isDeleteLoading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.deleteConfirmButton,
                    deleteConfirmText !== 'SUPPRIMER' && styles.deleteConfirmButtonDisabled
                  ]}
                  onPress={confirmDeleteAccount}
                  disabled={isDeleteLoading || deleteConfirmText !== 'SUPPRIMER'}
                  activeOpacity={0.8}
                >
                  <View style={styles.deleteConfirmInner}>
                    <Trash2 size={18} color="#FFFFFF" />
                    <Text style={styles.deleteConfirmText}>
                      {isDeleteLoading ? 'Suppression...' : 'Supprimer définitivement'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  statusIndicator: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 16, backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  offlineText: { flex: 1, marginLeft: 12 },
  offlineTitle: { color: Colors.status.warning, fontSize: 14, fontWeight: '600' as const },
  offlineSub: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  syncButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const, marginTop: 24, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { padding: 0, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  settingIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  dangerIcon: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  settingContent: { flex: 1 },
  settingTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  settingValue: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  dangerText: { color: Colors.status.error },
  badge: { backgroundColor: Colors.primary.orange, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 8 },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' as const },
  versionText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center', marginTop: 32, lineHeight: 20 },
  bottomSpacer: { height: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  languageModal: { backgroundColor: Colors.background.dark, borderRadius: 20, padding: 24, width: '100%', maxWidth: 320 },
  modalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, textAlign: 'center', marginBottom: 20 },
  languageOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8, backgroundColor: Colors.background.card },
  languageOptionActive: { backgroundColor: `${Colors.primary.blue}20`, borderWidth: 1, borderColor: Colors.primary.blue },
  languageFlag: { fontSize: 24, marginRight: 12 },
  languageLabel: { flex: 1, color: Colors.text.primary, fontSize: 16 },
  languageLabelActive: { fontWeight: '600' as const },
  closeButton: { marginTop: 16 },
  adminCodeInput: { backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 16, color: Colors.text.primary, fontSize: 16, borderWidth: 1, borderColor: Colors.border.light, width: '100%' },
  logoutModal: { backgroundColor: Colors.background.dark, borderRadius: 28, padding: 0, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.medium, overflow: 'hidden' },
  logoutGradientBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 150, borderRadius: 28 },
  logoutIconWrapper: { marginTop: 32, marginBottom: 20 },
  logoutIconGradient: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.primary.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  logoutTitle: { color: Colors.text.primary, fontSize: 26, fontWeight: '700' as const, marginBottom: 8, letterSpacing: -0.5 },
  logoutSubtitle: { color: Colors.text.secondary, fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 24, marginBottom: 16 },
  logoutInfoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.background.cardLight, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginHorizontal: 24, marginBottom: 28 },
  logoutInfoText: { color: Colors.text.secondary, fontSize: 13, flex: 1 },
  logoutActions: { flexDirection: 'column', gap: 10, width: '100%', paddingHorizontal: 24, paddingBottom: 28 },
  logoutCancelButton: { paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.background.cardLight, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.light },
  logoutCancelText: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  logoutConfirmButton: { borderRadius: 14, overflow: 'hidden' },
  logoutConfirmButtonDisabled: { opacity: 0.7 },
  logoutConfirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  logoutConfirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' as const },
  deleteModal: { backgroundColor: Colors.background.dark, borderRadius: 28, padding: 0, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', overflow: 'hidden' },
  deleteGradientBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 150, borderRadius: 28 },
  deleteIconWrapper: { marginTop: 32, marginBottom: 20 },
  deleteIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.status.error, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.status.error, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  deleteTitle: { color: Colors.text.primary, fontSize: 26, fontWeight: '700' as const, marginBottom: 8, letterSpacing: -0.5 },
  deleteSubtitle: { color: Colors.text.secondary, fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 24, marginBottom: 16 },
  deleteWarningBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginHorizontal: 24, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  deleteWarningText: { color: Colors.status.error, fontSize: 13, flex: 1 },
  deleteConfirmLabel: { color: Colors.text.muted, fontSize: 13, marginBottom: 8 },
  deleteConfirmInput: { backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 16, color: Colors.text.primary, fontSize: 16, borderWidth: 1, borderColor: Colors.border.light, width: '85%', textAlign: 'center', letterSpacing: 2, fontWeight: '600' as const },
  deleteActions: { flexDirection: 'column', gap: 10, width: '100%', paddingHorizontal: 24, paddingVertical: 24 },
  deleteCancelButton: { paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.background.cardLight, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.light },
  deleteCancelText: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  deleteConfirmButton: { borderRadius: 14, backgroundColor: Colors.status.error, overflow: 'hidden' },
  deleteConfirmButtonDisabled: { opacity: 0.4 },
  deleteConfirmInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  deleteConfirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' as const },
});
