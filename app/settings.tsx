import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Switch, Alert, Modal, Platform, TextInput, ToastAndroid } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Lock, MapPin, Shield, HelpCircle, FileText, Mail, Trash2, ChevronRight, LogOut, CheckCircle, Trophy, Search, Users, Star, Volume2, Vibrate, Eye, Database, RefreshCw, Wifi, WifiOff, Languages, AlertTriangle, UserX } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useTrophies } from '@/contexts/TrophiesContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineManager } from '@/lib/offline';
import { setNotificationsEnabled, getNotificationsEnabled } from '@/lib/notifications';

export default function SettingsScreen() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const { user, logout, deleteAccount, updateProfile, isAdmin, isVenueManager, upgradeToVenueManager, makeAdmin, isDeleteLoading } = useAuth();
  const { getUnlockedCount, getTotalXP, checkAndUnlockTrophies } = useTrophies();
  const { clearAll: clearNotifications, getUnreadCount } = useNotifications();
  
  const [notifications, setNotifications] = useState(true);
  const [matchAlerts, setMatchAlerts] = useState(true);
  const [teamAlerts, setTeamAlerts] = useState(true);
  const [chatAlerts, setChatAlerts] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [profileVisible, setProfileVisible] = useState(true);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<'fr' | 'en'>(locale);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [versionTaps, setVersionTaps] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const unlockedTrophies = user ? getUnlockedCount(user.id) : 0;
  const totalXP = user ? getTotalXP(user.id) : 0;
  const unreadNotifs = getUnreadCount();

  useEffect(() => {
    loadSettings();
    setCurrentLanguage(locale);
    setIsOnline(offlineManager.getIsOnline());
    offlineManager.getPendingCount().then(setPendingSync);
    const unsubscribe = offlineManager.subscribe(setIsOnline);
    return unsubscribe;
  }, [locale]);

  useEffect(() => {
    if (typeof user?.isProfileVisible === 'boolean') {
      setProfileVisible(user.isProfileVisible);
    }
  }, [user?.isProfileVisible]);

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

  const handleProfileVisibilityToggle = async (value: boolean) => {
    const prev = profileVisible;
    setProfileVisible(value);
    await saveSettings('profileVisible', value);

    try {
      await updateProfile({ isProfileVisible: value });
    } catch (e) {
      setProfileVisible(prev);
      await saveSettings('profileVisible', prev);
      Alert.alert(t('common.error'), t('settings.errorProfileVisibility'));
    }
  };

  const handleLanguageChange = async (lang: 'fr' | 'en') => {
    await setLocale(lang);
    setCurrentLanguage(lang);
    setShowLanguageModal(false);
    Alert.alert(
      lang === 'fr' ? t('settings.languageChangedTitle') : t('settings.languageChangedTitleEn'),
      lang === 'fr' ? t('settings.languageChangedMessageFr') : t('settings.languageChangedMessageEn')
    );
  };

  const handleSyncNow = async () => {
    await offlineManager.processQueue();
    const count = await offlineManager.getPendingCount();
    setPendingSync(count);
    Alert.alert(
      t('settings.syncTitle'),
      count === 0 ? t('settings.syncUpToDate') : t('settings.syncPending', { count })
    );
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
      Alert.alert(t('common.error'), t('settings.deleteConfirmInvalid'));
      return;
    }
    try {
      await deleteAccount(deleteConfirmText);
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      router.replace('/auth/welcome');
    } catch (e) {
      console.log('[Settings] Delete account error:', e);
      Alert.alert(t('common.error'), t('settings.deleteFailed'));
    }
  };
  const handleClearCache = () => setShowClearCacheModal(true);
  const confirmClearCache = async () => {
    setIsClearingCache(true);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const explicitCacheKeys = [
        'vs_tournaments',
        'vs_teams',
        'vs_matches',
        'vs_all_users',
        'vs_follows',
        'vs_chats',
        'vs_messages',
        'vs_referrals',
        'vs_support_tickets',
        'vs_verification_requests',
        'vs_user_trophies',
        'vs_offline_queue',
        'vs_last_sync',
      ];
      const toRemove = keys.filter(k =>
        k.startsWith('vs_cache_') ||
        k.startsWith('vs_notifications') ||
        explicitCacheKeys.includes(k)
      );
      if (toRemove.length > 0) {
        await AsyncStorage.multiRemove(toRemove);
      }
      await offlineManager.clearCache();
      setPendingSync(await offlineManager.getPendingCount());
      setShowClearCacheModal(false);
    } catch (e) {
      console.log('[Settings] Clear cache error:', e);
    } finally {
      setIsClearingCache(false);
    }
  };
  const handleClearNotifications = () => Alert.alert(t('settings.clearNotificationsTitle'), t('settings.clearNotificationsMessage'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('settings.clearAction'), style: 'destructive', onPress: async () => { await clearNotifications(); Alert.alert(t('common.success'), t('settings.notificationsCleared')); } }]);
  const handleRefreshTrophies = async () => { if (!user) return; const unlocked = await checkAndUnlockTrophies(user.id, { matchesPlayed: user.stats.matchesPlayed, wins: user.stats.wins, goalsScored: user.stats.goalsScored, assists: user.stats.assists, mvpAwards: user.stats.mvpAwards, tournamentWins: user.stats.tournamentWins, followers: user.followers, isVerified: user.isVerified || isAdmin, isPremium: user.isPremium || isAdmin, isCaptain: isAdmin, fairPlayScore: user.stats.fairPlayScore, hasTeam: (user.teams?.length || 0) > 0 || isAdmin, profileComplete: !!(user.fullName && user.city && user.sports?.length > 0) || isAdmin }); if (unlocked.length === 0) Alert.alert(t('settings.trophiesTitle'), t('settings.trophiesUpToDate')); };

  const SettingRow = ({ icon, title, value, onPress, toggle, toggleValue, onToggle, danger, badge, testID }: { icon: React.ReactNode; title: string; value?: string; onPress?: () => void; toggle?: boolean; toggleValue?: boolean; onToggle?: (v: boolean) => void; danger?: boolean; badge?: string | number; testID?: string }) => (
    <TouchableOpacity testID={testID} style={styles.settingRow} onPress={onPress} disabled={toggle} activeOpacity={toggle ? 1 : 0.7} accessibilityRole={toggle ? 'switch' : 'button'} accessibilityLabel={title} accessibilityValue={toggle ? { text: toggleValue ? 'activé' : 'désactivé' } : value ? { text: value } : undefined}>
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
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel={t('common.back')}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle} accessibilityRole="header">{t('settings.title')}</Text>
            <View style={styles.statusIndicator}>{isOnline ? <Wifi size={20} color={Colors.status.success} /> : <WifiOff size={20} color={Colors.status.error} />}</View>
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {!isOnline && (
              <Card style={styles.offlineBanner}><WifiOff size={20} color={Colors.status.warning} /><View style={styles.offlineText}><Text style={styles.offlineTitle}>{t('settings.offlineMode')}</Text><Text style={styles.offlineSub}>{t('settings.pendingSyncActions', { count: pendingSync })}</Text></View><TouchableOpacity style={styles.syncButton} onPress={handleSyncNow}><RefreshCw size={16} color="#FFF" /></TouchableOpacity></Card>
            )}

            {isAdmin && (<><Text style={styles.sectionTitle}>{t('settings.admin')}</Text><Card style={styles.section}><SettingRow icon={<Shield size={20} color={Colors.primary.orange} />} title={t('settings.adminPanel')} value={t('settings.manageApp')} onPress={() => router.push('/admin')} /></Card></>)}

            <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
            <Card style={styles.section}>
              <SettingRow icon={<Users size={20} color={Colors.text.secondary} />} title={t('settings.editProfile')} onPress={() => router.push('/edit-profile')} />
              <SettingRow icon={<CheckCircle size={20} color={user?.isVerified || isAdmin ? Colors.primary.blue : Colors.text.secondary} />} title={t('settings.verification')} value={isAdmin ? t('settings.adminAccount') : user?.isVerified ? t('settings.verifiedAccount') : t('settings.requestVerification')} onPress={() => router.push('/verification')} />
              <SettingRow icon={<Trophy size={20} color={Colors.primary.orange} />} title={t('settings.trophiesRewards')} value={t('settings.unlockedXp', { unlocked: unlockedTrophies, xp: totalXP })} onPress={() => router.push('/trophies')} />
              <SettingRow icon={<RefreshCw size={20} color={Colors.text.secondary} />} title={t('settings.refreshTrophies')} onPress={handleRefreshTrophies} />
              <SettingRow icon={<Search size={20} color={Colors.text.secondary} />} title={t('settings.searchLabel')} onPress={() => router.push('/search')} />
              <SettingRow icon={<Trash2 size={20} color={Colors.status.error} />} title={t('settings.deleteMyAccount')} onPress={handleDeleteAccount} danger />
            </Card>

            <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
            <Card style={styles.section}>
              <SettingRow icon={<Bell size={20} color={Colors.text.secondary} />} title={t('settings.pushNotifications')} toggle toggleValue={notifications} onToggle={handleNotificationsToggle} />
              <SettingRow icon={<Bell size={20} color={Colors.text.secondary} />} title={t('settings.matchAlerts')} toggle toggleValue={matchAlerts} onToggle={handleToggle('matchAlerts', setMatchAlerts)} />
              <SettingRow icon={<Bell size={20} color={Colors.text.secondary} />} title={t('settings.teamAlerts')} toggle toggleValue={teamAlerts} onToggle={handleToggle('teamAlerts', setTeamAlerts)} />
              <SettingRow icon={<Bell size={20} color={Colors.text.secondary} />} title={t('settings.chatAlerts')} toggle toggleValue={chatAlerts} onToggle={handleToggle('chatAlerts', setChatAlerts)} />
              <SettingRow icon={<Volume2 size={20} color={Colors.text.secondary} />} title={t('settings.sounds')} toggle toggleValue={soundEnabled} onToggle={handleToggle('soundEnabled', setSoundEnabled)} />
              <SettingRow icon={<Vibrate size={20} color={Colors.text.secondary} />} title={t('settings.vibrations')} toggle toggleValue={vibrationEnabled} onToggle={handleToggle('vibrationEnabled', setVibrationEnabled)} />
              {unreadNotifs > 0 && <SettingRow icon={<Trash2 size={20} color={Colors.text.secondary} />} title={t('settings.clearNotifications')} value={t('settings.unreadCount', { count: unreadNotifs })} onPress={handleClearNotifications} />}
            </Card>

            <Text style={styles.sectionTitle}>{t('settings.privacySecurity')}</Text>
            <Card style={styles.section}>
              <SettingRow icon={<MapPin size={20} color={Colors.text.secondary} />} title={t('settings.location')} toggle toggleValue={locationEnabled} onToggle={handleToggle('locationEnabled', setLocationEnabled)} />
              <SettingRow icon={<Eye size={20} color={Colors.text.secondary} />} title={t('settings.profileVisible')} toggle toggleValue={profileVisible} onToggle={handleProfileVisibilityToggle} />
              <SettingRow icon={<Lock size={20} color={Colors.text.secondary} />} title={t('settings.changePassword')} onPress={() => router.push('/forgot-password')} />
            </Card>

            <Text style={styles.sectionTitle}>{t('settings.appearanceLanguage')}</Text>
            <Card style={styles.section}>
              <SettingRow icon={<Languages size={20} color={Colors.text.secondary} />} title={t('settings.language')} value={currentLanguage === 'fr' ? 'Français' : 'English'} onPress={() => setShowLanguageModal(true)} />
            </Card>

            <Text style={styles.sectionTitle}>{t('settings.dataStorage')}</Text>
            <Card style={styles.section}>
              <SettingRow icon={<Database size={20} color={Colors.text.secondary} />} title={t('settings.clearCache')} onPress={handleClearCache} />
              {pendingSync > 0 && <SettingRow icon={<RefreshCw size={20} color={Colors.text.secondary} />} title={t('settings.sync')} value={t('settings.pendingActions', { count: pendingSync })} onPress={handleSyncNow} />}
            </Card>

            <Text style={styles.sectionTitle}>{t('settings.supportHelp')}</Text>
            <Card style={styles.section}>
              <SettingRow icon={<Mail size={20} color={Colors.text.secondary} />} title={t('settings.contactUs')} onPress={() => router.push('/contact')} />
              <SettingRow icon={<Star size={20} color={Colors.text.secondary} />} title={t('settings.rateApp')} onPress={() => Alert.alert(t('settings.thanksTitle'), t('settings.ratingSoon'))} />
            </Card>

            <Text style={styles.sectionTitle}>{t('settings.legal')}</Text>
            <Card style={styles.section}>
              <SettingRow icon={<FileText size={20} color={Colors.text.secondary} />} title={t('settings.termsOfService')} onPress={() => router.push('/terms')} />
              <SettingRow icon={<FileText size={20} color={Colors.text.secondary} />} title={t('settings.privacyPolicy')} onPress={() => router.push('/privacy')} />
            </Card>

            <Card style={[styles.section, { marginTop: 24 }]}>
              <SettingRow testID="btn-logout" icon={<LogOut size={20} color={Colors.text.secondary} />} title={t('settings.logout')} onPress={handleLogout} />
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

        <Modal visible={showClearCacheModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.clearCacheModal}>
              <LinearGradient
                colors={['rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.05)', 'transparent']}
                style={styles.clearCacheGradientBg}
              />
              <View style={styles.clearCacheIconWrapper}>
                <View style={styles.clearCacheIconCircle}>
                  <Database size={32} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.clearCacheTitle}>{t('settings.clearCacheTitle')}</Text>
              <Text style={styles.clearCacheSubtitle}>{t('settings.clearCacheMessage')}</Text>
              <View style={styles.clearCacheActions}>
                <TouchableOpacity
                  style={styles.clearCacheCancelButton}
                  onPress={() => setShowClearCacheModal(false)}
                  disabled={isClearingCache}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearCacheCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.clearCacheConfirmButton, isClearingCache && { opacity: 0.7 }]}
                  onPress={confirmClearCache}
                  disabled={isClearingCache}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[Colors.primary.blue, '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.clearCacheConfirmGradient}
                  >
                    <Trash2 size={18} color="#FFFFFF" />
                    <Text style={styles.clearCacheConfirmText}>
                      {isClearingCache ? t('settings.clearing') : t('settings.clearAction')}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
              <Text style={styles.logoutTitle}>{t('settings.goodbyeTitle')}</Text>
              <Text style={styles.logoutSubtitle}>
                {t('settings.logoutSubtitle')}
              </Text>
              <View style={styles.logoutInfoBox}>
                <Shield size={16} color={Colors.text.secondary} />
                <Text style={styles.logoutInfoText}>
                  {t('settings.logoutInfo')}
                </Text>
              </View>
              <View style={styles.logoutActions}>
                <TouchableOpacity
                  style={styles.logoutCancelButton}
                  onPress={() => setShowLogoutModal(false)}
                  disabled={isLoggingOut}
                  activeOpacity={0.7}
                >
                  <Text style={styles.logoutCancelText}>{t('settings.stayConnected')}</Text>
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
                      {isLoggingOut ? t('settings.loggingOut') : t('settings.logout')}
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
              <Text style={styles.modalTitle}>{t('settings.adminMode')}</Text>
              <Text style={[styles.settingValue, { textAlign: 'center', marginBottom: 16 }]}>{t('settings.adminModePrompt')}</Text>
              <TextInput
                style={styles.adminCodeInput}
                placeholder={t('settings.adminCodePlaceholder')}
                placeholderTextColor={Colors.text.muted}
                value={adminCode}
                onChangeText={setAdminCode}
                secureTextEntry
                autoCapitalize="none"
              />
              <Button
                title={t('settings.activate')}
                onPress={async () => {
                  if (adminCode === 'VS2026ADMIN') {
                    try {
                      await makeAdmin();
                      Alert.alert(t('common.success'), t('settings.adminActivated'));
                    } catch (e) {
                      console.log('[Settings] Admin activation error:', e);
                      Alert.alert(t('common.error'), t('settings.adminActivationFailed'));
                    }
                    setShowAdminModal(false);
                    setAdminCode('');
                  } else {
                    Alert.alert(t('common.error'), t('settings.incorrectCode'));
                  }
                }}
                style={{ marginTop: 8 }}
              />
              <Button title={t('common.cancel')} onPress={() => { setShowAdminModal(false); setAdminCode(''); }} variant="outline" style={styles.closeButton} />
            </View>
          </View>
        </Modal>

        <Modal visible={showLanguageModal} transparent animationType="fade">
          <View style={styles.modalOverlay}><View style={styles.languageModal}>
            <Text style={styles.modalTitle}>{t('settings.chooseLanguage')}</Text>
            {[{ code: 'fr' as const, label: 'Français', flag: '🇫🇷' }, { code: 'en' as const, label: 'English', flag: '🇬🇧' }].map(lang => (
              <TouchableOpacity key={lang.code} style={[styles.languageOption, currentLanguage === lang.code && styles.languageOptionActive]} onPress={() => handleLanguageChange(lang.code)}>
                <Text style={styles.languageFlag}>{lang.flag}</Text><Text style={[styles.languageLabel, currentLanguage === lang.code && styles.languageLabelActive]}>{lang.label}</Text>
                {currentLanguage === lang.code && <CheckCircle size={20} color={Colors.primary.blue} />}
              </TouchableOpacity>
            ))}
            <Button title={t('common.close')} onPress={() => setShowLanguageModal(false)} variant="outline" style={styles.closeButton} />
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
              <Text style={styles.deleteTitle}>{t('settings.deleteAccountTitle')}</Text>
              <Text style={styles.deleteSubtitle}>
                {t('settings.deleteAccountSubtitle')}
              </Text>
              <View style={styles.deleteWarningBox}>
                <AlertTriangle size={16} color={Colors.status.error} />
                <Text style={styles.deleteWarningText}>
                  {t('settings.deleteAccountWarning')}
                </Text>
              </View>
              <Text style={styles.deleteConfirmLabel}>{t('settings.typeDeleteConfirm')}</Text>
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
                  <Text style={styles.deleteCancelText}>{t('common.cancel')}</Text>
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
                      {isDeleteLoading ? t('settings.deleting') : t('settings.deletePermanently')}
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
  clearCacheModal: { backgroundColor: Colors.background.dark, borderRadius: 28, padding: 0, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.medium, overflow: 'hidden' },
  clearCacheGradientBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 150, borderRadius: 28 },
  clearCacheIconWrapper: { marginTop: 32, marginBottom: 20 },
  clearCacheIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.primary.blue, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  clearCacheTitle: { color: Colors.text.primary, fontSize: 22, fontWeight: '700' as const, marginBottom: 8, letterSpacing: -0.5 },
  clearCacheSubtitle: { color: Colors.text.secondary, fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 24, marginBottom: 28 },
  clearCacheActions: { flexDirection: 'column', gap: 10, width: '100%', paddingHorizontal: 24, paddingBottom: 28 },
  clearCacheCancelButton: { paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.background.cardLight, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.light },
  clearCacheCancelText: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  clearCacheConfirmButton: { borderRadius: 14, overflow: 'hidden' },
  clearCacheConfirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  clearCacheConfirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' as const },
});
