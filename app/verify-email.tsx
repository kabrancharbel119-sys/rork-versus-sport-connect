import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, CheckCircle, RefreshCw } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { t } = useI18n();
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
      setError(t('verifyEmail.enterSixDigitCode'));
      return;
    }
    if (!params.email) {
      setError(t('verifyEmail.missingEmail'));
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
      const message = err instanceof Error ? err.message : t('verifyEmail.invalidOrExpiredCode');
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
      
      Alert.alert(t('verifyEmail.codeSentTitle'), t('verifyEmail.codeSentMessage'));
      setCountdown(60);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('verifyEmail.genericError');
      Alert.alert(t('common.error'), message);
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
              <Text style={styles.successTitle}>{t('verifyEmail.emailVerifiedTitle')}</Text>
              <Text style={styles.successText}>
                {t('verifyEmail.emailVerifiedMessage')}
              </Text>
              <Button
                title={t('verifyEmail.signIn')}
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
              <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router, '/auth/login')}>
                <ArrowLeft size={24} color={Colors.text.primary} />
              </TouchableOpacity>

              <View style={styles.iconContainer}>
                <Mail size={48} color={Colors.primary.blue} />
              </View>

              <Text style={styles.title}>{t('verifyEmail.verifyYourEmail')}</Text>
              <Text style={styles.subtitle}>
                {params.debugCode 
                  ? t('verifyEmail.debugModeSubtitle')
                  : t('verifyEmail.sentCodeTo')}
                {'\n'}
                <Text style={styles.emailText}>{params.email}</Text>
              </Text>

              {params.debugCode && (
                <View style={styles.debugCodeContainer}>
                  <Text style={styles.debugCodeLabel}>{t('verifyEmail.testCodeLabel')}</Text>
                  <Text style={styles.debugCode}>{params.debugCode}</Text>
                </View>
              )}

              <View style={styles.form}>
                <Input
                  scrollViewRef={scrollViewRef}
                  label={t('verifyEmail.verificationCodeLabel')}
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
                  title={t('verifyEmail.verify')}
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
                      ? t('verifyEmail.sending')
                      : countdown > 0
                      ? t('verifyEmail.resendIn', { seconds: countdown })
                      : t('verifyEmail.resendCode')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.helpContainer}>
                <Text style={styles.helpText}>
                  {t('verifyEmail.noCodeReceived')}{' '}
                  <Text style={styles.helpLink} onPress={handleResendCode}>
                    {t('verifyEmail.resendCodeInline')}
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
