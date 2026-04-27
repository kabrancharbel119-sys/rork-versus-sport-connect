import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { User, ArrowLeft, ArrowRight, Lock, Mail, MapPin } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useAuth } from '@/contexts/AuthContext';
import { LocationSelector, LocationResult } from '@/components/LocationSelector';

export default function RegisterScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const { register, isRegisterLoading, registerError } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    city: '',
    country: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    referralCode: '',
    role: 'user' as const,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});


  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }
    
    if (!formData.username.trim()) {
      newErrors.username = 'Nom d\'utilisateur requis';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Minimum 3 caractères';
    }
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Prénom requis';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Nom requis';
    }
    
    if (!formData.city.trim()) {
      newErrors.city = 'Ville requise';
    }
    
    if (!formData.password) {
      newErrors.password = 'Mot de passe requis';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Minimum 8 caractères recommandés';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    
    setErrors({});
    
    try {
      console.log('[Register] Creating account for:', formData.email);
      await register({
        email: formData.email.trim(),
        password: formData.password,
        username: formData.username.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        city: formData.city,
        country: formData.country,
        location: formData.latitude && formData.longitude ? {
          latitude: formData.latitude,
          longitude: formData.longitude,
          city: formData.city,
          country: formData.country,
          lastUpdated: new Date(),
        } : undefined,
        referralCode: formData.referralCode.trim() || undefined,
        role: 'user',
      });
      console.log('[Register] Registration successful');
      router.replace('/(tabs)/(home)');
    } catch (error: any) {
      console.log('[Register] Error:', error);
      Alert.alert('Erreur', error.message || 'Erreur inattendue');
      setErrors({ general: error.message || 'Erreur inattendue' });
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={[Colors.background.dark, '#0D1420']}
        style={styles.container}
      >
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.keyboardView}
            keyboardVerticalOffset={80}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => safeBack(router, '/auth/welcome')}
              >
                <ArrowLeft size={24} color={Colors.text.primary} />
              </TouchableOpacity>

              <View style={styles.header}>
                <Image
                  source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bb74j32pntaehgnts84r7' }}
                  style={styles.logo}
                  contentFit="contain"
                />
                <Text style={styles.title}>Rejoignez VS</Text>
                <Text style={styles.subtitle}>Créez votre compte</Text>
              </View>

              <View style={styles.form}>
                <Input
                  scrollViewRef={scrollViewRef}
                  testID="input-email"
                  label="Email"
                  placeholder="exemple@email.com"
                  value={formData.email}
                  onChangeText={(v) => updateField('email', v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={errors.email}
                  icon={<Mail size={20} color={Colors.text.muted} />}
                />

                <Input
                  scrollViewRef={scrollViewRef}
                  testID="input-username"
                  label="Nom d'utilisateur"
                  placeholder="kouame_yao"
                  value={formData.username}
                  onChangeText={(v) => updateField('username', v)}
                  autoCapitalize="none"
                  error={errors.username}
                  icon={<User size={20} color={Colors.text.muted} />}
                />

                <Input
                  scrollViewRef={scrollViewRef}
                  testID="input-firstname"
                  label="Prénom"
                  placeholder="Kouamé"
                  value={formData.firstName}
                  onChangeText={(v) => updateField('firstName', v)}
                  autoCapitalize="words"
                  error={errors.firstName}
                  icon={<User size={20} color={Colors.text.muted} />}
                />

                <Input
                  scrollViewRef={scrollViewRef}
                  testID="input-lastname"
                  label="Nom"
                  placeholder="Yao"
                  value={formData.lastName}
                  onChangeText={(v) => updateField('lastName', v)}
                  autoCapitalize="words"
                  error={errors.lastName}
                  icon={<User size={20} color={Colors.text.muted} />}
                />

                <Input
                  scrollViewRef={scrollViewRef}
                  testID="input-password"
                  label="Mot de passe"
                  placeholder="••••••••"
                  value={formData.password}
                  onChangeText={(v) => updateField('password', v)}
                  secureTextEntry
                  error={errors.password}
                  icon={<Lock size={20} color={Colors.text.muted} />}
                />

                <Input
                  scrollViewRef={scrollViewRef}
                  testID="input-confirm-password"
                  label="Confirmer le mot de passe"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChangeText={(v) => updateField('confirmPassword', v)}
                  secureTextEntry
                  error={errors.confirmPassword}
                  icon={<Lock size={20} color={Colors.text.muted} />}
                />

                {/* Location Selector */}
                <View style={styles.locationSection}>
                  <LocationSelector
                    initialCity={formData.city}
                    initialCountry={formData.country}
                    onSelect={(location: LocationResult) => {
                      setFormData(prev => ({
                        ...prev,
                        city: location.city,
                        country: location.country,
                        latitude: location.latitude,
                        longitude: location.longitude,
                      }));
                      if (errors.city) {
                        setErrors(prev => ({ ...prev, city: '' }));
                      }
                    }}
                    onClear={() => {
                      setFormData(prev => ({
                        ...prev,
                        city: '',
                        country: '',
                        latitude: undefined,
                        longitude: undefined,
                      }));
                    }}
                  />
                  {errors.city && <Text style={styles.fieldError}>{errors.city}</Text>}
                </View>

                <Input
                  scrollViewRef={scrollViewRef}
                  testID="input-referral"
                  label="Code de parrainage (optionnel)"
                  placeholder="VS123ABC"
                  value={formData.referralCode}
                  onChangeText={(v) => updateField('referralCode', v)}
                  autoCapitalize="characters"
                />

                {(errors.general || registerError) && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errors.general || registerError}</Text>
                  </View>
                )}

                <Button
                  testID="btn-register"
                  title="Créer mon compte"
                  onPress={handleRegister}
                  loading={isRegisterLoading}
                  disabled={isRegisterLoading}
                  variant="orange"
                  size="large"
                  style={styles.submitButton}
                  icon={<ArrowRight size={20} color="#fff" />}
                />
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Déjà un compte ?</Text>
                <TouchableOpacity onPress={() => router.replace('/auth/login')}>
                  <Text style={styles.footerLink}>Se connecter</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => safeBack(router, '/auth/welcome')}
            >
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>

            <View style={styles.header}>
              <Image
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bb74j32pntaehgnts84r7' }}
                style={styles.logo}
                contentFit="contain"
              />
              <Text style={styles.title}>Rejoignez VS</Text>
              <Text style={styles.subtitle}>Créez votre compte</Text>
            </View>

            <View style={styles.form}>
              <Input
                scrollViewRef={scrollViewRef}
                testID="input-email"
                label="Email"
                placeholder="exemple@email.com"
                value={formData.email}
                onChangeText={(v) => updateField('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
                icon={<Mail size={20} color={Colors.text.muted} />}
              />

              <Input
                scrollViewRef={scrollViewRef}
                testID="input-username"
                label="Nom d'utilisateur"
                placeholder="kouame_yao"
                value={formData.username}
                onChangeText={(v) => updateField('username', v)}
                autoCapitalize="none"
                error={errors.username}
                icon={<User size={20} color={Colors.text.muted} />}
              />

              <Input
                scrollViewRef={scrollViewRef}
                testID="input-firstname"
                label="Prénom"
                placeholder="Kouamé"
                value={formData.firstName}
                onChangeText={(v) => updateField('firstName', v)}
                autoCapitalize="words"
                error={errors.firstName}
                icon={<User size={20} color={Colors.text.muted} />}
              />

              <Input
                scrollViewRef={scrollViewRef}
                testID="input-lastname"
                label="Nom"
                placeholder="Yao"
                value={formData.lastName}
                onChangeText={(v) => updateField('lastName', v)}
                autoCapitalize="words"
                error={errors.lastName}
                icon={<User size={20} color={Colors.text.muted} />}
              />

              <Input
                scrollViewRef={scrollViewRef}
                testID="input-password"
                label="Mot de passe"
                placeholder="••••••••"
                value={formData.password}
                onChangeText={(v) => updateField('password', v)}
                secureTextEntry
                error={errors.password}
                icon={<Lock size={20} color={Colors.text.muted} />}
              />

              <Input
                scrollViewRef={scrollViewRef}
                testID="input-confirm-password"
                label="Confirmer le mot de passe"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChangeText={(v) => updateField('confirmPassword', v)}
                secureTextEntry
                error={errors.confirmPassword}
                icon={<Lock size={20} color={Colors.text.muted} />}
              />

              {/* Location Selector */}
              <View style={styles.locationSection}>
                <LocationSelector
                  initialCity={formData.city}
                  initialCountry={formData.country}
                  onSelect={(location: LocationResult) => {
                    setFormData(prev => ({
                      ...prev,
                      city: location.city,
                      country: location.country,
                      latitude: location.latitude,
                      longitude: location.longitude,
                    }));
                    if (errors.city) {
                      setErrors(prev => ({ ...prev, city: '' }));
                    }
                  }}
                  onClear={() => {
                    setFormData(prev => ({
                      ...prev,
                      city: '',
                      country: '',
                      latitude: undefined,
                      longitude: undefined,
                    }));
                  }}
                />
                {errors.city && <Text style={styles.fieldError}>{errors.city}</Text>}
              </View>

              <Input
                scrollViewRef={scrollViewRef}
                testID="input-referral"
                label="Code de parrainage (optionnel)"
                placeholder="VS123ABC"
                value={formData.referralCode}
                onChangeText={(v) => updateField('referralCode', v)}
                autoCapitalize="characters"
              />

              {(errors.general || registerError) && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errors.general || registerError}</Text>
                </View>
              )}

              <Button
                testID="btn-register"
                title="Créer mon compte"
                onPress={handleRegister}
                loading={isRegisterLoading}
                disabled={isRegisterLoading}
                variant="orange"
                size="large"
                style={styles.submitButton}
                icon={<ArrowRight size={20} color="#fff" />}
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Déjà un compte ?</Text>
              <TouchableOpacity onPress={() => router.replace('/auth/login')}>
                <Text style={styles.footerLink}>Se connecter</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 70,
    height: 70,
    marginBottom: 12,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 28,
    fontWeight: '700' as const,
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: 16,
    marginTop: 8,
  },
  form: {
    gap: 4,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.status.error,
    fontSize: 14,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: 16,
  },
  roleSelector: {
    marginBottom: 20,
  },
  roleSelectorLabel: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  roleOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.background.card,
    borderWidth: 2,
    borderColor: Colors.border.light,
  },
  roleOptionActive: {
    borderColor: Colors.primary.blue,
    backgroundColor: Colors.primary.blue + '20',
  },
  roleOptionActiveOrange: {
    borderColor: Colors.primary.orange,
    backgroundColor: Colors.primary.orange + '20',
  },
  roleOptionText: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  roleOptionTextActive: {
    color: '#FFFFFF',
  },
  roleHint: {
    color: Colors.primary.orange,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    gap: 4,
  },
  footerText: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  footerLink: {
    color: Colors.primary.blue,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  locationSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  fieldError: {
    color: Colors.status.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});
