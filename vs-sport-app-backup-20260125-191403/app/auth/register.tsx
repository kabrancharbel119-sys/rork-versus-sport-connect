import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { User, ArrowLeft, ArrowRight, Lock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { PhoneInput } from '@/components/PhoneInput';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  
  const { register, isRegisterLoading, registerError } = useAuth();
  const [nationalNumber, setNationalNumber] = useState('');
  const [formData, setFormData] = useState({
    phone: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    city: 'Abidjan',
    country: 'Côte d\'Ivoire',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handlePhoneChange = (fullNumber: string, national: string) => {
    setFormData(prev => ({ ...prev, phone: fullNumber }));
    setNationalNumber(national);
    if (errors.phone) {
      setErrors(prev => ({ ...prev, phone: '' }));
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Prénom requis';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Nom requis';
    }
    
    if (!nationalNumber) {
      newErrors.phone = 'Numéro de téléphone requis';
    } else if (nationalNumber.length < 8) {
      newErrors.phone = 'Numéro invalide (minimum 8 chiffres)';
    }
    
    if (!formData.password) {
      newErrors.password = 'Mot de passe requis';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Minimum 6 caractères';
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
    const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
    const username = `${formData.firstName.toLowerCase()}_${formData.lastName.toLowerCase()}`.replace(/\s/g, '');
    
    try {
      console.log('[Register] Creating account for:', formData.phone);
      await register({
        phone: formData.phone,
        password: formData.password,
        fullName,
        username,
        city: formData.city,
        country: formData.country,
      });
      console.log('[Register] Registration successful, navigating to home');
      router.replace('/(tabs)/(home)');
    } catch (error: any) {
      console.log('[Register] Error:', error);
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
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
                label="Prénom"
                placeholder="Kouamé"
                value={formData.firstName}
                onChangeText={(v) => updateField('firstName', v)}
                autoCapitalize="words"
                error={errors.firstName}
                icon={<User size={20} color={Colors.text.muted} />}
              />

              <Input
                label="Nom"
                placeholder="Yao"
                value={formData.lastName}
                onChangeText={(v) => updateField('lastName', v)}
                autoCapitalize="words"
                error={errors.lastName}
                icon={<User size={20} color={Colors.text.muted} />}
              />

              <PhoneInput
                label="Numéro de téléphone"
                value={nationalNumber}
                onChangeText={handlePhoneChange}
                error={errors.phone}
                defaultCountry="CI"
              />

              <Input
                label="Mot de passe"
                placeholder="••••••••"
                value={formData.password}
                onChangeText={(v) => updateField('password', v)}
                secureTextEntry
                error={errors.password}
                icon={<Lock size={20} color={Colors.text.muted} />}
              />

              <Input
                label="Confirmer le mot de passe"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChangeText={(v) => updateField('confirmPassword', v)}
                secureTextEntry
                error={errors.confirmPassword}
                icon={<Lock size={20} color={Colors.text.muted} />}
              />

              {(errors.general || registerError) && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errors.general || registerError}</Text>
                </View>
              )}

              <Button
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
});
