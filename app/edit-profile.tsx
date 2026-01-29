import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Camera, User, Mail, Phone, MapPin, FileText, Plus, Trash2, Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/Avatar';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ALL_SPORTS, sportLabels, levelLabels, DEFAULT_POSITIONS } from '@/mocks/data';
import { Sport, SkillLevel, UserSport } from '@/types';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, isUpdateLoading, pickAvatar, isPickingAvatar, addSport, removeSport } = useAuth();
  const [formData, setFormData] = useState({ fullName: '', username: '', phone: '', city: '', country: '', bio: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSportModal, setShowSportModal] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        username: user.username || '',
        phone: user.phone || '',
        city: user.city || '',
        country: user.country || '',
        bio: user.bio || '',
      });
    }
  }, [user]);
  const [selectedSports, setSelectedSports] = useState<Set<Sport>>(new Set());
  const [sportYears, setSportYears] = useState<Record<Sport, string>>({} as Record<Sport, string>);
  const [sportLevels, setSportLevels] = useState<Record<Sport, SkillLevel>>({} as Record<Sport, SkillLevel>);
  const [sportPositions, setSportPositions] = useState<Record<Sport, string>>({} as Record<Sport, string>);

  const updateField = (field: string, value: string) => { setFormData(prev => ({ ...prev, [field]: value })); if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' })); };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Nom requis';
    if (!formData.username.trim()) newErrors.username = 'Nom d\'utilisateur requis';
    else if (formData.username.length < 3) newErrors.username = 'Minimum 3 caractères';
    if (!formData.city.trim()) newErrors.city = 'Ville requise';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Non connecté', 'Veuillez vous connecter pour modifier votre profil.');
      return;
    }
    if (!validate()) return;
    try {
      await updateProfile({ fullName: formData.fullName, username: formData.username, phone: formData.phone || undefined, city: formData.city, country: formData.country, bio: formData.bio || undefined });
      Alert.alert('Succès', 'Profil mis à jour');
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de mettre à jour le profil');
    }
  };

  const handlePickAvatar = async () => {
    try { await pickAvatar(); Alert.alert('Succès', 'Photo mise à jour'); } 
    catch (err: any) { if (err.message !== 'Annulé') Alert.alert('Erreur', err.message || 'Impossible de changer la photo'); }
  };

  const alreadyHasSport = (s: Sport) => user?.sports?.some(us => us.sport === s) ?? false;

  const toggleSport = (sport: Sport) => {
    if (alreadyHasSport(sport)) {
      Alert.alert('Déjà ajouté', `${sportLabels[sport]} est déjà dans vos sports.`);
      return;
    }
    const newSelected = new Set(selectedSports);
    if (newSelected.has(sport)) {
      newSelected.delete(sport);
      const newYears = { ...sportYears };
      delete newYears[sport];
      setSportYears(newYears);
      const newLevels = { ...sportLevels };
      delete newLevels[sport];
      setSportLevels(newLevels);
      const newPositions = { ...sportPositions };
      delete newPositions[sport];
      setSportPositions(newPositions);
    } else {
      newSelected.add(sport);
      setSportYears({ ...sportYears, [sport]: '1' });
      setSportLevels({ ...sportLevels, [sport]: 'intermediate' });
      setSportPositions({ ...sportPositions, [sport]: '' });
    }
    setSelectedSports(newSelected);
  };

  const handleAddAllSports = async () => {
    if (!user) {
      Alert.alert('Non connecté', 'Veuillez vous connecter pour ajouter des sports.');
      return;
    }
    if (selectedSports.size === 0) {
      Alert.alert('Aucun sport', 'Veuillez sélectionner au moins un sport.');
      return;
    }

    const sportsToAdd: UserSport[] = Array.from(selectedSports).map(sport => {
      const years = Math.min(99, Math.max(1, parseInt(sportYears[sport] || '1', 10) || 1));
      return {
        sport,
        level: sportLevels[sport] || 'intermediate',
        position: sportPositions[sport] || undefined,
        yearsPlaying: years,
      };
    });

    try {
      for (const sport of sportsToAdd) {
        await addSport(sport);
      }
      Alert.alert('Succès', `${sportsToAdd.length} sport(s) ajouté(s) !`);
      setSelectedSports(new Set());
      setSportYears({} as Record<Sport, string>);
      setSportLevels({} as Record<Sport, SkillLevel>);
      setSportPositions({} as Record<Sport, string>);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'ajouter les sports');
    }
  };

  const handleRemoveSport = (sport: Sport) => {
    Alert.alert('Supprimer', `Supprimer ${sportLabels[sport]} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeSport(sport) },
    ]);
  };

  const levels: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
                <X size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Modifier le profil</Text>
              <View style={styles.placeholder} />
            </View>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <Text style={{ color: Colors.text.muted, fontSize: 16, textAlign: 'center', marginBottom: 16 }}>Non connecté. Veuillez vous connecter pour modifier votre profil.</Text>
              <TouchableOpacity style={{ backgroundColor: Colors.primary.blue, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }} onPress={() => router.back()}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Retour</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}><X size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Modifier le profil</Text>
            <View style={styles.placeholder} />
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
            <ScrollView testID="edit-profile-scroll" style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.avatarSection}>
                <View style={styles.avatarContainer}>
                  <Avatar uri={user?.avatar} name={user?.fullName} size="xlarge" />
                  <TouchableOpacity style={styles.cameraButton} onPress={handlePickAvatar} disabled={isPickingAvatar}>
                    <Camera size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handlePickAvatar} disabled={isPickingAvatar}>
                  <Text style={styles.changePhotoText}>{isPickingAvatar ? 'Chargement...' : 'Changer la photo'}</Text>
                </TouchableOpacity>
              </View>

              <Input testID="input-fullname" label="Nom complet" placeholder="Kouamé Yao" value={formData.fullName} onChangeText={(v) => updateField('fullName', v)} autoCapitalize="words" error={errors.fullName} icon={<User size={20} color={Colors.text.muted} />} />
              <Input label="Nom d'utilisateur" placeholder="kouame_yao" value={formData.username} onChangeText={(v) => updateField('username', v)} autoCapitalize="none" error={errors.username} icon={<User size={20} color={Colors.text.muted} />} />
              <Input label="Email" placeholder={user?.email || 'votre@email.com'} value={user?.email || ''} onChangeText={() => {}} editable={false} icon={<Mail size={20} color={Colors.text.muted} />} />
              <Input label="Téléphone" placeholder="+225 07 00 00 00" value={formData.phone} onChangeText={(v) => updateField('phone', v)} keyboardType="phone-pad" icon={<Phone size={20} color={Colors.text.muted} />} />
              <Input label="Ville" placeholder="Abidjan" value={formData.city} onChangeText={(v) => updateField('city', v)} autoCapitalize="words" error={errors.city} icon={<MapPin size={20} color={Colors.text.muted} />} />
              <Input label="Pays" placeholder="Côte d'Ivoire" value={formData.country} onChangeText={(v) => updateField('country', v)} autoCapitalize="words" icon={<MapPin size={20} color={Colors.text.muted} />} />
              <Input label="Bio" placeholder="Parlez de vous..." value={formData.bio} onChangeText={(v) => updateField('bio', v)} multiline numberOfLines={4} icon={<FileText size={20} color={Colors.text.muted} />} />

              <View style={styles.sportsSection}>
                <View style={styles.sportsSectionHeader}>
                  <Text style={styles.sportsTitle}>Sports pratiqués</Text>
                  <TouchableOpacity style={styles.addSportBtn} onPress={() => setShowSportModal(true)}><Plus size={20} color="#FFFFFF" /></TouchableOpacity>
                </View>
                {user?.sports && user.sports.length > 0 ? user.sports.map((sport, i) => (
                  <Card key={i} style={styles.sportItem}>
                    <View style={styles.sportItemContent}>
                      <View><Text style={styles.sportItemName}>{sportLabels[sport.sport]}</Text><Text style={styles.sportItemMeta}>{levelLabels[sport.level]} • {sport.yearsPlaying} ans{sport.position ? ` • ${sport.position}` : ''}</Text></View>
                      <TouchableOpacity onPress={() => handleRemoveSport(sport.sport)}><Trash2 size={20} color={Colors.status.error} /></TouchableOpacity>
                    </View>
                  </Card>
                )) : <Text style={styles.noSportsText}>Aucun sport ajouté</Text>}
              </View>

              <Button title="Enregistrer" onPress={handleSave} loading={isUpdateLoading} variant="primary" size="large" style={styles.saveButton} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={showSportModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ajouter des sports</Text>
                <TouchableOpacity onPress={() => {
                  setShowSportModal(false);
                  setSelectedSports(new Set());
                  setSportYears({} as Record<Sport, string>);
                  setSportLevels({} as Record<Sport, SkillLevel>);
                  setSportPositions({} as Record<Sport, string>);
                }}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.modalLabel}>Sélectionnez un ou plusieurs sports</Text>
                <View style={styles.sportsGrid}>
                  {ALL_SPORTS.map((sport) => {
                    const isAdded = alreadyHasSport(sport);
                    const isSelected = selectedSports.has(sport);
                    const positions = DEFAULT_POSITIONS[sport] || DEFAULT_POSITIONS.default;
                    return (
                      <View key={sport} style={styles.sportCheckboxContainer}>
                        <TouchableOpacity
                          testID={`checkbox-${sport.toLowerCase()}`}
                          style={[
                            styles.sportCheckboxRow,
                            isSelected && styles.sportCheckboxRowActive,
                            isAdded && styles.sportCheckboxRowDisabled,
                          ]}
                          onPress={() => !isAdded && toggleSport(sport)}
                          disabled={isAdded}
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkboxChecked, isAdded && styles.checkboxDisabled]}>
                            {isSelected && !isAdded && <Check size={14} color="#FFFFFF" />}
                            {isAdded && <Check size={14} color={Colors.text.muted} />}
                          </View>
                          <Text style={[
                            styles.sportCheckboxLabel,
                            isSelected && styles.sportCheckboxLabelActive,
                            isAdded && styles.sportCheckboxLabelDisabled,
                          ]}>
                            {sportLabels[sport]}
                            {isAdded ? ' (déjà ajouté)' : ''}
                          </Text>
                        </TouchableOpacity>
                        
                        {isSelected && !isAdded && (
                          <View style={styles.sportDetails}>
                            <Text style={styles.modalLabel}>Niveau</Text>
                            <View style={styles.levelOptions}>
                              {levels.map(level => (
                                <TouchableOpacity
                                  key={level}
                                  style={[styles.levelOption, sportLevels[sport] === level && styles.levelOptionActive]}
                                  onPress={() => setSportLevels({ ...sportLevels, [sport]: level })}
                                >
                                  <Text style={[styles.levelOptionText, sportLevels[sport] === level && styles.levelOptionTextActive]}>
                                    {levelLabels[level]}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>

                            {positions.length > 0 && (
                              <>
                                <Text style={styles.modalLabel}>Position (optionnel)</Text>
                                <View style={styles.positionOptions}>
                                  {positions.map(pos => (
                                    <TouchableOpacity
                                      key={pos}
                                      style={[styles.positionOption, sportPositions[sport] === pos && styles.positionOptionActive]}
                                      onPress={() => setSportPositions({ ...sportPositions, [sport]: pos })}
                                    >
                                      <Text style={[styles.positionOptionText, sportPositions[sport] === pos && styles.positionOptionTextActive]}>
                                        {pos}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </>
                            )}

                            <Text style={styles.modalLabel}>Nombre d'années d'expérience</Text>
                            <Text style={styles.modalHint}>Combien d'années pratiquez-vous ce sport ? (1-99 ans)</Text>
                            <Input
                              value={sportYears[sport] || '1'}
                              onChangeText={(v) => setSportYears({ ...sportYears, [sport]: v.replace(/\D/g, '').slice(0, 2) || '1' })}
                              keyboardType="numeric"
                              placeholder="Ex: 5"
                            />
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
              <View style={styles.modalActions}>
                <Button
                  title={`Ajouter ${selectedSports.size} sport(s)`}
                  onPress={handleAddAllSports}
                  variant="primary"
                  disabled={selectedSports.size === 0}
                  style={[styles.modalButton, { flex: 1 }]}
                />
                <Button
                  title="Terminé"
                  onPress={() => {
                    setShowSportModal(false);
                    setSelectedSports(new Set());
                    setSportYears({} as Record<Sport, string>);
                    setSportLevels({} as Record<Sport, SkillLevel>);
                    setSportPositions({} as Record<Sport, string>);
                  }}
                  variant="outline"
                  style={[styles.modalButton, { flex: 1 }]}
                />
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
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  placeholder: { width: 40 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarContainer: { position: 'relative' },
  cameraButton: { position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.background.dark },
  changePhotoText: { color: Colors.primary.blue, fontSize: 14, fontWeight: '500' as const, marginTop: 12 },
  sportsSection: { marginTop: 24, marginBottom: 16 },
  sportsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sportsTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  addSportBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center' },
  sportItem: { marginBottom: 8 },
  sportItemContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sportItemName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  sportItemMeta: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  noSportsText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  saveButton: { marginTop: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  modalScroll: { maxHeight: 400 },
  modalLabel: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const, marginTop: 16, marginBottom: 8 },
  modalHint: { color: Colors.text.muted, fontSize: 12, marginBottom: 8 },
  sportOption: { flex: 1, margin: 4, padding: 12, borderRadius: 10, backgroundColor: Colors.background.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sportOptionActive: { backgroundColor: Colors.primary.blue },
  sportOptionDisabled: { opacity: 0.6, backgroundColor: Colors.background.cardLight },
  sportOptionText: { color: Colors.text.secondary, fontSize: 13 },
  sportOptionTextActive: { color: '#FFFFFF', fontWeight: '500' as const },
  sportOptionTextDisabled: { color: Colors.text.muted },
  levelOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.background.card },
  levelOptionActive: { backgroundColor: Colors.primary.blue },
  levelOptionText: { color: Colors.text.secondary, fontSize: 14 },
  levelOptionTextActive: { color: '#FFFFFF', fontWeight: '500' as const },
  positionOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  positionOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.background.card },
  positionOptionActive: { backgroundColor: Colors.primary.orange },
  positionOptionText: { color: Colors.text.secondary, fontSize: 13 },
  positionOptionTextActive: { color: '#FFFFFF', fontWeight: '500' as const },
  modalButton: { marginTop: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  sportsGrid: { gap: 12 },
  sportCheckboxContainer: { marginBottom: 16 },
  sportCheckboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, backgroundColor: Colors.background.card, borderWidth: 2, borderColor: 'transparent' },
  sportCheckboxRowActive: { borderColor: Colors.primary.blue, backgroundColor: Colors.primary.blue + '15' },
  sportCheckboxRowDisabled: { opacity: 0.5 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.border.light, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background.cardLight },
  checkboxChecked: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  checkboxDisabled: { backgroundColor: Colors.background.cardLight, borderColor: Colors.border.light },
  sportCheckboxLabel: { flex: 1, color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  sportCheckboxLabelActive: { color: Colors.primary.blue, fontWeight: '600' as const },
  sportCheckboxLabelDisabled: { color: Colors.text.muted },
  sportDetails: { marginTop: 12, marginLeft: 36, padding: 12, backgroundColor: Colors.background.cardLight, borderRadius: 8 },
});
