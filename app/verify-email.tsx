import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, CheckCircle, RefreshCw } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { supabase } from '@/lib/supabase';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string; name: string; debugCode?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async () => {
    setError('');
    if (!code || code.length !== 6) {
      setError('Veuillez entrer un code à 6 chiffres');
      return;
    }
    if (!params.email) {
      setError('Email manquant');
      return;
    }
    
    setIsLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: params.email,
        token: code,
        type: 'signup',
      });
      
      if (verifyError) throw verifyError;
      
      setIsVerified(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Code invalide ou expiré';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0 || !params.email) return;
    
    setIsResending(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: params.email,
      });
      
      if (resendError) throw resendError;
      
      Alert.alert('Code envoyé', 'Un nouveau code a été envoyé à votre adresse email');
      setCountdown(60);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue';
      Alert.alert('Erreur', message);
    } finally {
      setIsResending(false);
    }
  };

  const handleContinue = () => {
    router.replace('/auth/login');
  };

  if (isVerified) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <CheckCircle size={64} color={Colors.status.success} />
              </View>
              <Text style={styles.successTitle}>Email vérifié ! 🎉</Text>
              <Text style={styles.successText}>
                Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter et profiter de toutes les fonctionnalités de VS App.
              </Text>
              <Button
                title="Se connecter"
                onPress={handleContinue}
                variant="primary"
                size="large"
                style={styles.continueButton}
              />
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
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 30}>
            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 280 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <ArrowLeft size={24} color={Colors.text.primary} />
              </TouchableOpacity>

              <View style={styles.iconContainer}>
                <Mail size={48} color={Colors.primary.blue} />
              </View>

              <Text style={styles.title}>Vérifiez votre email</Text>
              <Text style={styles.subtitle}>
                {params.debugCode 
                  ? "L'email n'a pas pu être envoyé. Utilisez le code ci-dessous :"
                  : "Nous avons envoyé un code de vérification à"}
                {'\n'}
                <Text style={styles.emailText}>{params.email}</Text>
              </Text>

              {params.debugCode && (
                <View style={styles.debugCodeContainer}>
                  <Text style={styles.debugCodeLabel}>Code de vérification (test)</Text>
                  <Text style={styles.debugCode}>{params.debugCode}</Text>
                </View>
              )}

              <View style={styles.form}>
                <Input
                  scrollViewRef={scrollViewRef}
                  label="Code de vérification"
                  placeholder="000000"
                  value={code}
                  onChangeText={(v) => {
                    setCode(v);
                    setError('');
                  }}
                  keyboardType="numeric"
                  maxLength={6}
                  error={error}
                  icon={<Mail size={20} color={Colors.text.muted} />}
                />

                <Button
                  title="Vérifier"
                  onPress={handleVerify}
                  loading={isLoading}
                  variant="primary"
                  size="large"
                  style={styles.verifyButton}
                />

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={handleResendCode}
                  disabled={countdown > 0 || isResending}
                >
                  <RefreshCw size={16} color={countdown > 0 ? Colors.text.muted : Colors.primary.blue} />
                  <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
                    {isResending
                      ? 'Envoi...'
                      : countdown > 0
                      ? `Renvoyer dans ${countdown}s`
                      : 'Renvoyer le code'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.helpContainer}>
                <Text style={styles.helpText}>
                  Vous n&apos;avez pas reçu le code ? Vérifiez vos spams ou{' '}
                  <Text style={styles.helpLink} onPress={handleResendCode}>
                    renvoyez le code
                  </Text>
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${Colors.primary.blue}20`,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 28,
    fontWeight: '700' as const,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emailText: {
    color: Colors.primary.blue,
    fontWeight: '600' as const,
  },
  form: {
    gap: 16,
  },
  verifyButton: {
    marginTop: 8,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  resendText: {
    color: Colors.primary.blue,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  resendTextDisabled: {
    color: Colors.text.muted,
  },
  helpContainer: {
    marginTop: 'auto',
    paddingTop: 32,
  },
  helpText: {
    color: Colors.text.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  helpLink: {
    color: Colors.primary.blue,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(16,185,129,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    color: Colors.text.primary,
    fontSize: 28,
    fontWeight: '700' as const,
    marginBottom: 16,
  },
  debugCodeContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  debugCodeLabel: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginBottom: 8,
  },
  debugCode: {
    color: '#F59E0B',
    fontSize: 32,
    fontWeight: '700' as const,
    textAlign: 'center',
    letterSpacing: 8,
  },
  successText: {
    color: Colors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  continueButton: {
    width: '100%',
  },
});
