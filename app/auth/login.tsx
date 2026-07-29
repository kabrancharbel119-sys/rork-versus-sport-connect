import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, TextInput, Alert, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { ArrowLeft, ArrowRight, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  
  const { login, isLoginLoading, loginError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setError('');
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setError('');
  };

  const validate = () => {
    if (!email.trim()) {
      setError('Email requis');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email invalide');
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const loggedInUser = await login({ email: email.trim(), password });
      if (loggedInUser?.role === 'venue_manager') {
        router.replace('/(manager-tabs)/dashboard' as any);
      } else {
        router.replace('/(tabs)/(home)');
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMsg = err.message || 'Erreur de connexion';
      if (errorMsg.includes('Invalid login credentials') || errorMsg.includes('Email not confirmed')) {
        setError('Email ou mot de passe incorrect');
      } else {
        setError(errorMsg);
      }
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient
          colors={['#0d111d', '#0f1422', '#0d111d']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Decorative orbs */}
        <View style={[styles.bgOrb, { top: -100, right: -80 }]} />
        <View style={[styles.bgOrb2, { bottom: -120, left: -100 }]} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 30}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 280 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces={false}
            overScrollMode="never"
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => safeBack(router, '/auth/welcome')}
              activeOpacity={0.7}
            >
              <ArrowLeft size={22} color={Colors.text.primary} strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.logoWrap}>
                <LinearGradient
                  colors={[Colors.primary.orange + '20', Colors.primary.orange + '05', 'transparent']}
                  locations={[0, 0.6, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <Image
                  source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bb74j32pntaehgnts84r7' }}
                  style={styles.logo}
                  contentFit="contain"
                />
              </View>
              <Text style={styles.title}>Bon retour !</Text>
              <Text style={styles.subtitle}>
                Connectez-vous pour retrouver votre équipe
              </Text>
            </View>

            <View style={styles.form}>
              {/* Email field */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIconWrap}>
                    <Mail size={18} color={Colors.primary.orange} strokeWidth={2} />
                  </View>
                  <TextInput
                    testID="input-email"
                    style={styles.textInput}
                    placeholder="exemple@email.com"
                    placeholderTextColor={Colors.text.muted + '80'}
                    value={email}
                    onChangeText={handleEmailChange}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textContentType="emailAddress"
                    autoComplete="email"
                  />
                </View>
              </View>

              {/* Password field */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Mot de passe</Text>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIconWrap}>
                    <Lock size={18} color={Colors.primary.orange} strokeWidth={2} />
                  </View>
                  <TextInput
                    testID="input-password"
                    style={styles.textInput}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.text.muted + '80'}
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    autoComplete="password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    activeOpacity={0.6}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color={Colors.text.muted} strokeWidth={2} />
                    ) : (
                      <Eye size={18} color={Colors.text.muted} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                onPress={() => router.push('/auth/forgot-password')}
                style={styles.forgotPassword}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>

              {/* Login button with gradient */}
              <TouchableOpacity
                testID="btn-login"
                onPress={handleLogin}
                disabled={isLoginLoading}
                activeOpacity={0.85}
                style={styles.loginBtnWrap}
              >
                <LinearGradient
                  colors={[Colors.primary.orange, Colors.primary.orangeDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loginBtnGradient}
                >
                  {isLoginLoading ? (
                    <View style={styles.loginBtnLoading}>
                      <Text style={styles.loginBtnText}>Connexion...</Text>
                    </View>
                  ) : (
                    <View style={styles.loginBtnRow}>
                      <Text style={styles.loginBtnText}>Se connecter</Text>
                      <ArrowRight size={20} color="#fff" strokeWidth={2.5} />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {(error || loginError) ? (
                <View style={styles.errorWrap}>
                  <AlertCircle size={16} color={Colors.status.error} strokeWidth={2} />
                  <Text style={styles.errorText}>{error || loginError}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.footer}>
              <View style={styles.footerDivider}>
                <View style={styles.footerLine} />
                <Text style={styles.footerDividerText}>ou</Text>
                <View style={styles.footerLine} />
              </View>
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Pas encore de compte ?</Text>
                <TouchableOpacity onPress={() => router.replace('/auth/register')} activeOpacity={0.7}>
                  <Text style={styles.footerLink}>Créer un compte</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d111d',
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
  bgOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.primary.orange + '0A',
  },
  bgOrb2: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.primary.blue + '08',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.background.card + '99',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  logo: {
    width: 76,
    height: 76,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 32,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  subtitle: {
    color: Colors.text.muted,
    fontSize: 15,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: 0,
  },
  field: {
    marginBottom: 18,
  },
  fieldLabel: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 8,
    marginLeft: 2,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card + '80',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.text.muted + '15',
  },
  inputIconWrap: {
    paddingLeft: 16,
    paddingRight: 4,
  },
  textInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    fontWeight: '500' as const,
  },
  eyeBtn: {
    padding: 14,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  forgotPasswordText: {
    color: Colors.primary.orange,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  loginBtnWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary.orange,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }) as any,
  },
  loginBtnGradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginBtnLoading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.status.error + '15',
    borderWidth: 1,
    borderColor: Colors.status.error + '30',
  },
  errorText: {
    color: Colors.status.error,
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
  },
  footer: {
    marginTop: 40,
  },
  footerDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.text.muted + '15',
  },
  footerDividerText: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  footerLink: {
    color: Colors.primary.orange,
    fontSize: 14,
    fontWeight: '700' as const,
  },
});