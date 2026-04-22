import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, TextInput } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MapPin, Phone, Mail, Building2, User, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterManagerScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { register, isRegisterLoading } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    businessName: '',
    phone: '',
    city: 'Abidjan',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1); // 1 = info perso, 2 = info business

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!formData.firstName.trim()) e.firstName = 'Prénom requis';
    if (!formData.lastName.trim()) e.lastName = 'Nom requis';
    if (!formData.email.trim()) e.email = 'Email requis';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Email invalide';
    if (!formData.password) e.password = 'Mot de passe requis';
    else if (formData.password.length < 6) e.password = '6 caractères minimum';
    if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Les mots de passe ne correspondent pas';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!formData.businessName.trim()) e.businessName = 'Nom de l\'établissement requis';
    if (!formData.phone.trim()) e.phone = 'Téléphone requis';
    if (!formData.city.trim()) e.city = 'Ville requise';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const handleRegister = async () => {
    if (!validateStep2()) return;

    try {
      await register({
        email: formData.email.trim(),
        password: formData.password,
        username: formData.businessName.trim().toLowerCase().replace(/\s+/g, '-'),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        city: formData.city,
        role: 'venue_manager',
      });
      router.replace('/(manager-tabs)' as any);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Erreur lors de la création du compte.');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => step === 2 ? setStep(1) : safeBack(router, '/auth/welcome')}>
              <ArrowLeft size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <View style={[styles.headerIconBg]}>
                <MapPin size={20} color={Colors.primary.orange} />
              </View>
              <Text style={styles.headerTitle}>Compte Gestionnaire</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Steps indicator */}
          <View style={styles.stepsRow}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
            <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
          </View>
          <Text style={styles.stepLabel}>
            {step === 1 ? 'Étape 1/2 — Informations personnelles' : 'Étape 2/2 — Votre établissement'}
          </Text>

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 ? (
              <>
                <Text style={styles.sectionTitle}>Créez votre compte</Text>
                <Text style={styles.sectionDesc}>
                  Ces informations servent à identifier le propriétaire du ou des terrains.
                </Text>

                <View style={styles.fieldGroup}>
                  <View style={styles.row}>
                    <View style={styles.halfField}>
                      <Text style={styles.label}>Prénom *</Text>
                      <View style={[styles.inputWrap, errors.firstName ? styles.inputError : null]}>
                        <User size={18} color={Colors.text.muted} />
                        <TextInput
                          style={styles.input}
                          placeholder="Prénom"
                          placeholderTextColor={Colors.text.muted}
                          value={formData.firstName}
                          onChangeText={v => updateField('firstName', v)}
                        />
                      </View>
                      {errors.firstName ? <Text style={styles.error}>{errors.firstName}</Text> : null}
                    </View>
                    <View style={styles.halfField}>
                      <Text style={styles.label}>Nom *</Text>
                      <View style={[styles.inputWrap, errors.lastName ? styles.inputError : null]}>
                        <User size={18} color={Colors.text.muted} />
                        <TextInput
                          style={styles.input}
                          placeholder="Nom"
                          placeholderTextColor={Colors.text.muted}
                          value={formData.lastName}
                          onChangeText={v => updateField('lastName', v)}
                        />
                      </View>
                      {errors.lastName ? <Text style={styles.error}>{errors.lastName}</Text> : null}
                    </View>
                  </View>

                  <Text style={styles.label}>Adresse email *</Text>
                  <View style={[styles.inputWrap, errors.email ? styles.inputError : null]}>
                    <Mail size={18} color={Colors.text.muted} />
                    <TextInput
                      style={styles.input}
                      placeholder="votre@email.com"
                      placeholderTextColor={Colors.text.muted}
                      value={formData.email}
                      onChangeText={v => updateField('email', v)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                  {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

                  <Text style={styles.label}>Mot de passe *</Text>
                  <View style={[styles.inputWrap, errors.password ? styles.inputError : null]}>
                    <Lock size={18} color={Colors.text.muted} />
                    <TextInput
                      style={styles.input}
                      placeholder="Minimum 6 caractères"
                      placeholderTextColor={Colors.text.muted}
                      value={formData.password}
                      onChangeText={v => updateField('password', v)}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={18} color={Colors.text.muted} /> : <Eye size={18} color={Colors.text.muted} />}
                    </TouchableOpacity>
                  </View>
                  {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}

                  <Text style={styles.label}>Confirmer le mot de passe *</Text>
                  <View style={[styles.inputWrap, errors.confirmPassword ? styles.inputError : null]}>
                    <Lock size={18} color={Colors.text.muted} />
                    <TextInput
                      style={styles.input}
                      placeholder="Retapez le mot de passe"
                      placeholderTextColor={Colors.text.muted}
                      value={formData.confirmPassword}
                      onChangeText={v => updateField('confirmPassword', v)}
                      secureTextEntry={!showPassword}
                    />
                  </View>
                  {errors.confirmPassword ? <Text style={styles.error}>{errors.confirmPassword}</Text> : null}
                </View>

                <Button
                  title="Suivant"
                  onPress={handleNext}
                  variant="orange"
                  size="large"
                  style={{ marginTop: 20 }}
                />
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Votre établissement</Text>
                <Text style={styles.sectionDesc}>
                  Ces informations nous aident à préparer votre espace gestionnaire. Vous pourrez ajouter vos terrains après l'inscription.
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Nom de l'établissement *</Text>
                  <View style={[styles.inputWrap, errors.businessName ? styles.inputError : null]}>
                    <Building2 size={18} color={Colors.text.muted} />
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: Complexe Sportif de Cocody"
                      placeholderTextColor={Colors.text.muted}
                      value={formData.businessName}
                      onChangeText={v => updateField('businessName', v)}
                    />
                  </View>
                  {errors.businessName ? <Text style={styles.error}>{errors.businessName}</Text> : null}

                  <Text style={styles.label}>Téléphone professionnel *</Text>
                  <View style={[styles.inputWrap, errors.phone ? styles.inputError : null]}>
                    <Phone size={18} color={Colors.text.muted} />
                    <TextInput
                      style={styles.input}
                      placeholder="+225 07 00 00 00"
                      placeholderTextColor={Colors.text.muted}
                      value={formData.phone}
                      onChangeText={v => updateField('phone', v)}
                      keyboardType="phone-pad"
                    />
                  </View>
                  {errors.phone ? <Text style={styles.error}>{errors.phone}</Text> : null}

                  <Text style={styles.label}>Ville *</Text>
                  <View style={[styles.inputWrap, errors.city ? styles.inputError : null]}>
                    <MapPin size={18} color={Colors.text.muted} />
                    <TextInput
                      style={styles.input}
                      placeholder="Abidjan"
                      placeholderTextColor={Colors.text.muted}
                      value={formData.city}
                      onChangeText={v => updateField('city', v)}
                    />
                  </View>
                  {errors.city ? <Text style={styles.error}>{errors.city}</Text> : null}
                </View>

                {/* What happens next */}
                <View style={styles.nextStepsCard}>
                  <Text style={styles.nextStepsTitle}>Après l'inscription :</Text>
                  {[
                    'Vous accéderez à votre tableau de bord gestionnaire',
                    'Vous pourrez créer et configurer vos terrains',
                    'Les joueurs pourront réserver vos créneaux',
                  ].map((text, i) => (
                    <View key={i} style={styles.nextStepRow}>
                      <CheckCircle size={16} color={Colors.status.success} />
                      <Text style={styles.nextStepText}>{text}</Text>
                    </View>
                  ))}
                </View>

                <Button
                  title="Créer mon compte gestionnaire"
                  onPress={handleRegister}
                  loading={isRegisterLoading}
                  disabled={isRegisterLoading}
                  variant="orange"
                  size="large"
                  style={{ marginTop: 20 }}
                />
              </>
            )}

            <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginLinkText}>
                Déjà un compte ? <Text style={styles.loginLinkBold}>Se connecter</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBg: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.primary.orange + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' },
  stepsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 0, paddingHorizontal: 60, marginTop: 12, marginBottom: 6,
  },
  stepDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.background.cardLight, borderWidth: 2, borderColor: Colors.border.light,
  },
  stepDotActive: { backgroundColor: Colors.primary.orange, borderColor: Colors.primary.orange },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border.light },
  stepLineActive: { backgroundColor: Colors.primary.orange },
  stepLabel: { color: Colors.text.muted, fontSize: 12, textAlign: 'center', marginBottom: 8 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  sectionTitle: { color: Colors.text.primary, fontSize: 22, fontWeight: '800', marginBottom: 6 },
  sectionDesc: { color: Colors.text.muted, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  fieldGroup: { gap: 4 },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  label: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.background.card,
    borderWidth: 1.5, borderColor: Colors.border.light, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  inputError: { borderColor: Colors.status.error },
  input: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  error: { color: Colors.status.error, fontSize: 11, marginTop: 3 },
  nextStepsCard: {
    backgroundColor: Colors.background.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border.light, marginTop: 20, gap: 10,
  },
  nextStepsTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' },
  nextStepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextStepText: { color: Colors.text.secondary, fontSize: 13, flex: 1 },
  loginLink: { alignItems: 'center', marginTop: 24 },
  loginLinkText: { color: Colors.text.muted, fontSize: 14 },
  loginLinkBold: { color: Colors.primary.orange, fontWeight: '700' },
});
