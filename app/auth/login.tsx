import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { PhoneInput } from '@/components/PhoneInput';
import { Input } from '@/components/Input';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  
  const { login, isLoginLoading, loginError } = useAuth();
  const [phone, setPhone] = useState('');
  const [nationalNumber, setNationalNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handlePhoneChange = (fullNumber: string, national: string) => {
    setPhone(fullNumber);
    setNationalNumber(national);
    setError('');
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setError('');
  };

  const validate = () => {
    if (!nationalNumber) {
      setError('Numéro de téléphone requis');
      return false;
    }
    if (nationalNumber.length < 8) {
      setError('Numéro invalide (minimum 8 chiffres)');
      return false;
    }
    if (!password) {
      setError('Mot de passe requis');
      return false;
    }
    setError('');
    return true;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    
    setError('');
    
    try {
      console.log('[Login] Attempting direct login for:', phone);
      await login({ phone, password });
      console.log('[Login] Login successful, navigating to home');
      router.replace('/(tabs)/(home)');
    } catch (err: any) {
      console.error('[Login] Error:', err);
      const errorMsg = err.message || 'Erreur de connexion';
      if (errorMsg.includes('non enregistré') || errorMsg.includes('not found') || errorMsg.includes('introuvable')) {
        setError('Ce numéro n\'est pas enregistré. Veuillez créer un compte.');
      } else if (errorMsg.includes('banni')) {
        setError('Ce compte a été suspendu.');
      } else {
        setError(errorMsg);
      }
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
              <Text style={styles.title}>Bon retour !</Text>
              <Text style={styles.subtitle}>
                Connectez-vous pour retrouver votre équipe
              </Text>
            </View>

            <View style={styles.form}>
              <PhoneInput
                testID="input-phone"
                label="Numéro de téléphone"
                value={nationalNumber}
                onChangeText={handlePhoneChange}
                defaultCountry="CI"
              />

              <Input
                testID="input-password"
                label="Mot de passe"
                placeholder="••••••••"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry
                icon={<Lock size={20} color={Colors.text.muted} />}
              />

              <Button
                testID="btn-login"
                title="Se connecter"
                onPress={handleLogin}
                loading={isLoginLoading}
                variant="primary"
                size="large"
                style={styles.loginButton}
                icon={<ArrowRight size={20} color="#fff" />}
              />

              {(error || loginError) ? (
                <Text style={styles.errorText}>{error || loginError}</Text>
              ) : null}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Pas encore de compte ?</Text>
              <TouchableOpacity onPress={() => router.replace('/auth/register')}>
                <Text style={styles.footerLink}>Créer un compte</Text>
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
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
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
    textAlign: 'center',
  },
  form: {
    gap: 4,
  },
  loginButton: {
    marginTop: 16,
  },
  errorText: {
    color: Colors.status.error,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
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
    color: Colors.primary.orange,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  
});