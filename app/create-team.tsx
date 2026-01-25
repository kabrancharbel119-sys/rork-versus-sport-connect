import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, TextInput, ActionSheetIOS } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Users, MapPin, Check, ChevronDown, Search, Shield, Image as ImageIcon, Plus, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { Sport, SkillLevel, PlayStyle, TeamRole } from '@/types';
import { ALL_SPORTS, sportLabels, levelLabels, ambianceLabels, DEFAULT_POSITIONS, TEAM_ROLES } from '@/mocks/data';

const levels: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
const ambiances: PlayStyle[] = ['competitive', 'casual', 'mixed'];

const formats: Record<Sport, string[]> = {
  football: ['5v5', '7v7', '11v11'], basketball: ['3v3', '5v5'], volleyball: ['4v4', '6v6'],
  tennis: ['1v1', '2v2'], handball: ['7v7'], rugby: ['7v7', '15v15'], badminton: ['1v1', '2v2'],
  tabletennis: ['1v1', '2v2'], cricket: ['11v11'], baseball: ['9v9'], hockey: ['6v6', '11v11'],
  golf: ['1v1', '2v2', '4v4'], swimming: ['1v1', '4v4'], athletics: ['1v1', '4v4'], boxing: ['1v1'],
  mma: ['1v1'], wrestling: ['1v1'], judo: ['1v1'], karate: ['1v1'], taekwondo: ['1v1'],
  cycling: ['1v1', '4v4'], skateboarding: ['1v1'], surfing: ['1v1'], climbing: ['1v1', '2v2'],
  gymnastics: ['1v1'], esports: ['1v1', '2v2', '5v5'], futsal: ['5v5'], beachvolleyball: ['2v2', '4v4'],
  padel: ['2v2'], squash: ['1v1', '2v2'],
};

const TEAM_LOGOS = [
  'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=200&h=200&fit=crop',
];

const pickImageFromLibrary = async (): Promise<string | null> => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  
  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }
  return null;
};

const takePhoto = async (): Promise<string | null> => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission requise', 'Autorisez l\'accès à la caméra pour prendre une photo.');
    return null;
  }
  
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  
  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }
  return null;
};

const sportIcons: Record<string, string> = {
  football: '⚽', basketball: '🏀', volleyball: '🏐', tennis: '🎾', handball: '🤾', rugby: '🏉',
  badminton: '🏸', tabletennis: '🏓', cricket: '🏏', baseball: '⚾', hockey: '🏒', golf: '⛳',
  swimming: '🏊', athletics: '🏃', boxing: '🥊', mma: '🥋', wrestling: '🤼', judo: '🥋',
  karate: '🥋', taekwondo: '🥋', cycling: '🚴', skateboarding: '🛹', surfing: '🏄', climbing: '🧗',
  gymnastics: '🤸', esports: '🎮', futsal: '⚽', beachvolleyball: '🏐', padel: '🎾', squash: '🎾',
};

export default function CreateTeamScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { createTeam, isCreating } = useTeams();

  const [step, setStep] = useState(1);
  const [showSportModal, setShowSportModal] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [sportSearch, setSportSearch] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [customLogoUrl, setCustomLogoUrl] = useState('');
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    sport: 'football' as Sport,
    format: '5v5',
    level: 'intermediate' as SkillLevel,
    ambiance: 'mixed' as PlayStyle,
    city: user?.city || 'Abidjan',
    country: user?.country || 'Côte d\'Ivoire',
    description: '',
    maxMembers: '15',
    isRecruiting: true,
  });

  const [customRoles, setCustomRoles] = useState<TeamRole[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredSports = useMemo(() => {
    if (!sportSearch.trim()) return ALL_SPORTS;
    return ALL_SPORTS.filter(s => 
      sportLabels[s].toLowerCase().includes(sportSearch.toLowerCase())
    );
  }, [sportSearch]);

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Nom requis';
    else if (formData.name.length < 3) newErrors.name = 'Minimum 3 caractères';
    else if (formData.name.length > 30) newErrors.name = 'Maximum 30 caractères';
    if (!formData.city.trim()) newErrors.city = 'Ville requise';
    const maxMembers = parseInt(formData.maxMembers, 10);
    if (isNaN(maxMembers) || maxMembers < 2) newErrors.maxMembers = 'Minimum 2 membres';
    if (maxMembers > 50) newErrors.maxMembers = 'Maximum 50 membres';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate() || !user) return;
    try {
      await createTeam({
        name: formData.name,
        logo: formData.logo || undefined,
        sport: formData.sport,
        format: formData.format,
        level: formData.level,
        ambiance: formData.ambiance,
        city: formData.city,
        country: formData.country,
        description: formData.description || undefined,
        maxMembers: parseInt(formData.maxMembers, 10),
        captainId: user.id,
        isRecruiting: formData.isRecruiting,
        customRoles,
      });
      Alert.alert('Succès', 'Équipe créée avec succès !', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de créer l\'équipe');
    }
  };

  const addCustomRole = () => {
    if (!newRoleName.trim()) return;
    if (customRoles.some(r => r.name.toLowerCase() === newRoleName.toLowerCase())) {
      Alert.alert('Erreur', 'Ce rôle existe déjà');
      return;
    }
    setCustomRoles([...customRoles, { id: `role-${Date.now()}`, name: newRoleName.trim(), isCustom: true, createdBy: user?.id }]);
    setNewRoleName('');
  };

  const removeCustomRole = (roleId: string) => {
    setCustomRoles(customRoles.filter(r => r.id !== roleId));
  };

  const selectSport = (sport: Sport) => {
    updateField('sport', sport);
    updateField('format', formats[sport][0]);
    setShowSportModal(false);
    setSportSearch('');
  };

  const renderStep1 = () => (
    <>
      <TouchableOpacity style={styles.logoSelector} onPress={() => setShowLogoModal(true)}>
        {formData.logo ? (
          <Avatar uri={formData.logo} name={formData.name || 'Équipe'} size="large" />
        ) : (
          <View style={styles.logoPlaceholder}>
            <ImageIcon size={32} color={Colors.text.muted} />
            <Text style={styles.logoPlaceholderText}>Logo</Text>
          </View>
        )}
        <View style={styles.logoEditBadge}>
          <Plus size={14} color="#FFF" />
        </View>
      </TouchableOpacity>

      <Input
        label="Nom de l'équipe *"
        placeholder="Ex: FC Cocody"
        value={formData.name}
        onChangeText={(v) => updateField('name', v)}
        error={errors.name}
        maxLength={30}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Sport *</Text>
        <TouchableOpacity style={styles.sportSelector} onPress={() => setShowSportModal(true)}>
          <Text style={styles.sportIcon}>{sportIcons[formData.sport]}</Text>
          <Text style={styles.sportSelectorText}>{sportLabels[formData.sport]}</Text>
          <ChevronDown size={20} color={Colors.text.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Format</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.optionRow}>
            {formats[formData.sport].map((format) => (
              <TouchableOpacity
                key={format}
                style={[styles.optionChip, formData.format === format && styles.optionChipActive]}
                onPress={() => updateField('format', format)}
              >
                <Text style={[styles.optionText, formData.format === format && styles.optionTextActive]}>{format}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Niveau</Text>
        <View style={styles.optionGrid}>
          {levels.map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.levelChip, formData.level === level && styles.levelChipActive]}
              onPress={() => updateField('level', level)}
            >
              <Text style={[styles.levelText, formData.level === level && styles.levelTextActive]}>
                {levelLabels[level]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  );

  const renderStep2 = () => (
    <>
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Ambiance de jeu</Text>
        <View style={styles.ambianceGrid}>
          {ambiances.map((ambiance) => (
            <TouchableOpacity
              key={ambiance}
              style={[styles.ambianceCard, formData.ambiance === ambiance && styles.ambianceCardActive]}
              onPress={() => updateField('ambiance', ambiance)}
            >
              <Text style={styles.ambianceEmoji}>
                {ambiance === 'competitive' ? '🏆' : ambiance === 'casual' ? '😎' : '⚖️'}
              </Text>
              <Text style={[styles.ambianceLabel, formData.ambiance === ambiance && styles.ambianceLabelActive]}>
                {ambianceLabels[ambiance]}
              </Text>
              {formData.ambiance === ambiance && (
                <View style={styles.checkBadge}><Check size={12} color="#FFF" /></View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.rowInputs}>
        <View style={styles.halfInput}>
          <Input
            label="Ville *"
            placeholder="Abidjan"
            value={formData.city}
            onChangeText={(v) => updateField('city', v)}
            error={errors.city}
            icon={<MapPin size={18} color={Colors.text.muted} />}
          />
        </View>
        <View style={styles.halfInput}>
          <Input
            label="Max. membres"
            placeholder="15"
            value={formData.maxMembers}
            onChangeText={(v) => updateField('maxMembers', v.replace(/[^0-9]/g, ''))}
            error={errors.maxMembers}
            keyboardType="numeric"
          />
        </View>
      </View>

      <TouchableOpacity style={styles.toggleRow} onPress={() => updateField('isRecruiting', !formData.isRecruiting)}>
        <View style={styles.toggleInfo}>
          <Shield size={20} color={Colors.primary.blue} />
          <View style={styles.toggleTextContainer}>
            <Text style={styles.toggleTitle}>Recrutement ouvert</Text>
            <Text style={styles.toggleSubtitle}>Permettre aux joueurs de demander à rejoindre</Text>
          </View>
        </View>
        <View style={[styles.toggle, formData.isRecruiting && styles.toggleActive]}>
          <View style={[styles.toggleThumb, formData.isRecruiting && styles.toggleThumbActive]} />
        </View>
      </TouchableOpacity>

      <Input
        label="Description (optionnel)"
        placeholder="Décrivez votre équipe, vos objectifs, votre style de jeu..."
        value={formData.description}
        onChangeText={(v) => updateField('description', v)}
        multiline
        numberOfLines={4}
        maxLength={300}
      />
    </>
  );

  const renderStep3 = () => (
    <>
      <View style={styles.rolesSection}>
        <View style={styles.rolesSectionHeader}>
          <Text style={styles.fieldLabel}>Rôles par défaut</Text>
        </View>
        <View style={styles.defaultRoles}>
          {TEAM_ROLES.map((role) => (
            <View key={role} style={styles.defaultRoleChip}>
              <Text style={styles.defaultRoleText}>{role}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.rolesSection}>
        <View style={styles.rolesSectionHeader}>
          <Text style={styles.fieldLabel}>Rôles personnalisés</Text>
          <TouchableOpacity style={styles.addRoleBtn} onPress={() => setShowRolesModal(true)}>
            <Plus size={16} color={Colors.primary.blue} />
            <Text style={styles.addRoleBtnText}>Ajouter</Text>
          </TouchableOpacity>
        </View>
        {customRoles.length > 0 ? (
          <View style={styles.customRoles}>
            {customRoles.map((role) => (
              <View key={role.id} style={styles.customRoleChip}>
                <Text style={styles.customRoleText}>{role.name}</Text>
                <TouchableOpacity onPress={() => removeCustomRole(role.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={14} color={Colors.text.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noCustomRoles}>Ajoutez des rôles personnalisés pour votre équipe</Text>
        )}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Récapitulatif</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Nom:</Text>
          <Text style={styles.summaryValue}>{formData.name || '-'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Sport:</Text>
          <Text style={styles.summaryValue}>{sportLabels[formData.sport]} {formData.format}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Niveau:</Text>
          <Text style={styles.summaryValue}>{levelLabels[formData.level]}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Lieu:</Text>
          <Text style={styles.summaryValue}>{formData.city}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Membres max:</Text>
          <Text style={styles.summaryValue}>{formData.maxMembers}</Text>
        </View>
      </View>
    </>
  );

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
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Créer une équipe</Text>
              <Text style={styles.stepIndicator}>Étape {step}/3</Text>
            </View>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </ScrollView>

            <View style={styles.footer}>
              {step > 1 && (
                <Button title="Retour" onPress={() => setStep(step - 1)} variant="secondary" size="large" style={styles.backBtn} />
              )}
              {step < 3 ? (
                <Button
                  title="Suivant"
                  onPress={() => {
                    if (step === 1 && !formData.name.trim()) {
                      setErrors({ name: 'Nom requis' });
                      return;
                    }
                    setStep(step + 1);
                  }}
                  variant="primary"
                  size="large"
                  style={styles.nextBtn}
                />
              ) : (
                <Button
                  title="Créer l'équipe"
                  onPress={handleCreate}
                  loading={isCreating}
                  variant="orange"
                  size="large"
                  style={styles.nextBtn}
                />
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={showSportModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choisir un sport</Text>
                <TouchableOpacity style={styles.modalClose} onPress={() => { setShowSportModal(false); setSportSearch(''); }}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.searchContainer}>
                <Search size={20} color={Colors.text.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher..."
                  placeholderTextColor={Colors.text.muted}
                  value={sportSearch}
                  onChangeText={setSportSearch}
                />
              </View>
              <ScrollView style={styles.sportsList}>
                {filteredSports.map((sport) => (
                  <TouchableOpacity
                    key={sport}
                    style={[styles.sportItem, formData.sport === sport && styles.sportItemActive]}
                    onPress={() => selectSport(sport)}
                  >
                    <Text style={styles.sportItemIcon}>{sportIcons[sport]}</Text>
                    <Text style={[styles.sportItemText, formData.sport === sport && styles.sportItemTextActive]}>
                      {sportLabels[sport]}
                    </Text>
                    {formData.sport === sport && <Check size={20} color={Colors.primary.blue} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showLogoModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentSmall}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choisir un logo</Text>
                <TouchableOpacity style={styles.modalClose} onPress={() => { setShowLogoModal(false); setShowCustomUrlInput(false); setCustomLogoUrl(''); }}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              
              {!showCustomUrlInput ? (
                <>
                  <View style={styles.imagePickerButtons}>
                    <TouchableOpacity 
                      style={styles.imagePickerBtn}
                      onPress={async () => {
                        const uri = await pickImageFromLibrary();
                        if (uri) {
                          updateField('logo', uri);
                          setShowLogoModal(false);
                        }
                      }}
                    >
                      <ImageIcon size={24} color={Colors.primary.blue} />
                      <Text style={styles.imagePickerBtnText}>Galerie photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.imagePickerBtn}
                      onPress={async () => {
                        const uri = await takePhoto();
                        if (uri) {
                          updateField('logo', uri);
                          setShowLogoModal(false);
                        }
                      }}
                    >
                      <View style={styles.cameraIconCircle}>
                        <Text style={styles.cameraIcon}>📷</Text>
                      </View>
                      <Text style={styles.imagePickerBtnText}>Prendre photo</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.orDividerText}>ou choisir un logo prédéfini</Text>
                  
                  <View style={styles.logosGrid}>
                    <TouchableOpacity
                      style={[styles.logoOption, !formData.logo && styles.logoOptionActive]}
                      onPress={() => { updateField('logo', ''); setShowLogoModal(false); }}
                    >
                      <Users size={28} color={Colors.text.muted} />
                    </TouchableOpacity>
                    {TEAM_LOGOS.map((logo, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.logoOption, formData.logo === logo && styles.logoOptionActive]}
                        onPress={() => { updateField('logo', logo); setShowLogoModal(false); }}
                      >
                        <Avatar uri={logo} name="Logo" size="medium" />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.customUrlButton} onPress={() => setShowCustomUrlInput(true)}>
                    <ImageIcon size={18} color={Colors.primary.blue} />
                    <Text style={styles.customUrlButtonText}>Utiliser une URL personnalisée</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.customUrlContainer}>
                  <Input
                    label="URL de l'image"
                    placeholder="https://exemple.com/logo.png"
                    value={customLogoUrl}
                    onChangeText={setCustomLogoUrl}
                    autoCapitalize="none"
                    keyboardType="default"
                  />
                  {customLogoUrl.trim() && (
                    <View style={styles.logoPreviewContainer}>
                      <Text style={styles.logoPreviewLabel}>Aperçu:</Text>
                      <Avatar uri={customLogoUrl} name="Logo" size="large" />
                    </View>
                  )}
                  <View style={styles.customUrlActions}>
                    <TouchableOpacity style={styles.customUrlBackBtn} onPress={() => { setShowCustomUrlInput(false); setCustomLogoUrl(''); }}>
                      <Text style={styles.customUrlBackText}>Retour</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.customUrlConfirmBtn, !customLogoUrl.trim() && styles.customUrlConfirmBtnDisabled]} 
                      onPress={() => { 
                        if (customLogoUrl.trim()) {
                          updateField('logo', customLogoUrl.trim()); 
                          setShowLogoModal(false); 
                          setShowCustomUrlInput(false);
                          setCustomLogoUrl('');
                        }
                      }}
                      disabled={!customLogoUrl.trim()}
                    >
                      <Text style={styles.customUrlConfirmText}>Confirmer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={showRolesModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentSmall}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouveau rôle</Text>
                <TouchableOpacity style={styles.modalClose} onPress={() => { setShowRolesModal(false); setNewRoleName(''); }}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Input
                  label="Nom du rôle"
                  placeholder="Ex: Stratège, Motivateur..."
                  value={newRoleName}
                  onChangeText={setNewRoleName}
                  maxLength={20}
                />
                <Button
                  title="Ajouter le rôle"
                  onPress={() => { addCustomRole(); setShowRolesModal(false); }}
                  variant="primary"
                  size="large"
                  disabled={!newRoleName.trim()}
                  style={styles.addRoleConfirmBtn}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '600' as const },
  stepIndicator: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  placeholder: { width: 40 },
  progressBar: { height: 3, backgroundColor: Colors.background.card, marginHorizontal: 20 },
  progressFill: { height: '100%', backgroundColor: Colors.primary.orange, borderRadius: 2 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  logoSelector: { alignSelf: 'center', marginBottom: 24, position: 'relative' as const },
  logoPlaceholder: { width: 100, height: 100, borderRadius: 24, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.border.light, borderStyle: 'dashed' as const },
  logoPlaceholderText: { color: Colors.text.muted, fontSize: 12, marginTop: 4 },
  logoEditBadge: { position: 'absolute' as const, bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.background.dark },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const, marginBottom: 10 },
  sportSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.card, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.light, gap: 12 },
  sportIcon: { fontSize: 24 },
  sportSelectorText: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  optionChipActive: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  optionText: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const },
  optionTextActive: { color: '#FFFFFF' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  levelChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  levelChipActive: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  levelText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' as const },
  levelTextActive: { color: '#FFFFFF' },
  ambianceGrid: { flexDirection: 'row', gap: 10 },
  ambianceCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: Colors.background.card, borderWidth: 2, borderColor: 'transparent', position: 'relative' as const },
  ambianceCardActive: { borderColor: Colors.primary.blue, backgroundColor: 'rgba(21,101,192,0.1)' },
  ambianceEmoji: { fontSize: 28, marginBottom: 8 },
  ambianceLabel: { color: Colors.text.secondary, fontSize: 12, fontWeight: '500' as const },
  ambianceLabelActive: { color: Colors.primary.blue },
  checkBadge: { position: 'absolute' as const, top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center' },
  rowInputs: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.background.card, padding: 16, borderRadius: 12, marginBottom: 20 },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleTextContainer: { flex: 1 },
  toggleTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '500' as const },
  toggleSubtitle: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  toggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: Colors.background.cardLight, padding: 2 },
  toggleActive: { backgroundColor: Colors.primary.blue },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF' },
  toggleThumbActive: { transform: [{ translateX: 22 }] },
  rolesSection: { marginBottom: 20 },
  rolesSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addRoleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addRoleBtnText: { color: Colors.primary.blue, fontSize: 13, fontWeight: '500' as const },
  defaultRoles: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  defaultRoleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.background.card },
  defaultRoleText: { color: Colors.text.secondary, fontSize: 12 },
  customRoles: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  customRoleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(21,101,192,0.15)' },
  customRoleText: { color: Colors.primary.blue, fontSize: 12, fontWeight: '500' as const },
  noCustomRoles: { color: Colors.text.muted, fontSize: 13, fontStyle: 'italic' as const },
  summaryCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border.light },
  summaryTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  summaryLabel: { color: Colors.text.muted, fontSize: 14 },
  summaryValue: { color: Colors.text.primary, fontSize: 14, fontWeight: '500' as const },
  footer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, gap: 12, borderTopWidth: 1, borderTopColor: Colors.border.light },
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalContentSmall: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  modalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  modalClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.card, marginHorizontal: 20, marginVertical: 12, paddingHorizontal: 16, borderRadius: 12, gap: 12 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15, paddingVertical: 12 },
  sportsList: { paddingHorizontal: 20, paddingBottom: 40 },
  sportItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.light, gap: 14 },
  sportItemActive: { backgroundColor: 'rgba(21,101,192,0.05)' },
  sportItemIcon: { fontSize: 24, width: 36, textAlign: 'center' as const },
  sportItemText: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  sportItemTextActive: { color: Colors.primary.blue, fontWeight: '500' as const },
  imagePickerButtons: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16 },
  imagePickerBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 20, backgroundColor: Colors.background.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border.light, gap: 8 },
  imagePickerBtnText: { color: Colors.text.primary, fontSize: 13, fontWeight: '500' as const },
  cameraIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,107,0,0.15)', alignItems: 'center', justifyContent: 'center' },
  cameraIcon: { fontSize: 20 },
  orDividerText: { color: Colors.text.muted, fontSize: 12, textAlign: 'center' as const, marginVertical: 16 },
  logosGrid: { flexDirection: 'row', flexWrap: 'wrap' as const, paddingHorizontal: 20, paddingBottom: 12, gap: 12, justifyContent: 'center' },
  logoOption: { width: 70, height: 70, borderRadius: 16, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  logoOptionActive: { borderColor: Colors.primary.blue },
  customUrlButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginHorizontal: 20, marginBottom: 20, borderRadius: 12, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  customUrlButtonText: { color: Colors.primary.blue, fontSize: 14, fontWeight: '500' as const },
  customUrlContainer: { padding: 20 },
  logoPreviewContainer: { alignItems: 'center', marginTop: 16, gap: 8 },
  logoPreviewLabel: { color: Colors.text.muted, fontSize: 12 },
  customUrlActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  customUrlBackBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.background.card },
  customUrlBackText: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const },
  customUrlConfirmBtn: { flex: 2, alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary.blue },
  customUrlConfirmBtnDisabled: { backgroundColor: Colors.background.cardLight },
  customUrlConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' as const },
  addRoleConfirmBtn: { marginTop: 16 },
});
