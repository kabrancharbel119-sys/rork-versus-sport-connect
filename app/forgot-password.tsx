import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, Key, CheckCircle, ArrowRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { supabase } from '@/lib/supabase';

type Step = 'email' | 'verify' | 'reset' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = () => {
    if (!email) { setErrors({ email: 'Email requis' }); return false; }
    if (!/\S+@\S+\.\S+/.test(email)) { setErrors({ email: 'Email invalide' }); return false; }
    return true;
  };

  const validateCode = () => {
    if (!code || code.length !== 6) { setErrors({ code: 'Code à 6 chiffres requis' }); return false; }
    return true;
  };

  const validatePasswords = () => {
    const newErrors: Record<string, string> = {};
    if (!newPassword) newErrors.newPassword = 'Mot de passe requis';
    else if (newPassword.length < 6) newErrors.newPassword = 'Minimum 6 caractères';
    if (!confirmPassword) newErrors.confirmPassword = 'Confirmation requise';
    else if (newPassword !== confirmPassword) newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendCode = async () => {
    setErrors({});
    if (!validateEmail()) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'versus://reset-password',
      });
      
      if (error) throw error;
      
      Alert.alert('Code envoyé', `Un email de réinitialisation a été envoyé à ${email}`);
      setStep('verify');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue';
      Alert.alert('Erreur', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndReset = async () => {
    setErrors({});
    if (!validateCode()) return;
    if (!validatePasswords()) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (error) throw error;
      
      setStep('success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue';
      if (message.includes('Code')) {
        setErrors({ code: message });
      } else {
        Alert.alert('Erreur', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setErrors({});
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      Alert.alert('Code renvoyé', `Un nouveau code a été envoyé à ${email}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue';
      Alert.alert('Erreur', message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderEmailStep = () => (
    <>
      <Text style={styles.title}>Mot de passe oublié ?</Text>
      <Text style={styles.subtitle}>Entrez votre adresse email pour recevoir un lien de réinitialisation</Text>
      <Input 
        label="Adresse email" 
        placeholder="votre@email.com" 
        value={email} 
        onChangeText={setEmail} 
        keyboardType="email-address" 
        autoCapitalize="none" 
        error={errors.email} 
        icon={<Mail size={20} color={Colors.text.muted} />} 
      />
      <Button 
        title="Envoyer le lien" 
        onPress={handleSendCode} 
        loading={isLoading} 
        variant="primary" 
        size="large" 
        style={styles.button} 
      />
    </>
  );

  const renderVerifyStep = () => (
    <>
      <Text style={styles.title}>Réinitialisation</Text>
      <Text style={styles.subtitle}>Entrez le code reçu par email et votre nouveau mot de passe</Text>
      <Input
        scrollViewRef={scrollViewRef}
        label="Code de vérification"
        placeholder="000000"
        value={code} 
        onChangeText={setCode} 
        keyboardType="numeric" 
        maxLength={6} 
        error={errors.code} 
        icon={<Key size={20} color={Colors.text.muted} />} 
      />
      <Input 
        label="Nouveau mot de passe" 
        placeholder="••••••••" 
        value={newPassword} 
        onChangeText={setNewPassword} 
        secureTextEntry 
        error={errors.newPassword} 
        icon={<Key size={20} color={Colors.text.muted} />} 
      />
      <Input
        scrollViewRef={scrollViewRef}
        label="Confirmer le mot de passe"
        placeholder="••••••••"
        value={confirmPassword} 
        onChangeText={setConfirmPassword} 
        secureTextEntry 
        error={errors.confirmPassword} 
        icon={<Key size={20} color={Colors.text.muted} />} 
      />
      <Button 
        title="Réinitialiser" 
        onPress={handleVerifyAndReset} 
        loading={isLoading} 
        variant="primary" 
        size="large" 
        style={styles.button} 
      />
      <TouchableOpacity 
        style={styles.resendBtn} 
        onPress={handleResendCode}
        disabled={isLoading}
      >
        <Text style={styles.resendText}>
          {isLoading ? 'Envoi en cours...' : 'Renvoyer le code'}
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderSuccessStep = () => (
    <View style={styles.successContainer}>
      <View style={styles.successIcon}><CheckCircle size={64} color={Colors.status.success} /></View>
      <Text style={styles.successTitle}>Mot de passe réinitialisé !</Text>
      <Text style={styles.successText}>Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter.</Text>
      <Button title="Se connecter" onPress={() => router.replace('/auth/login')} variant="primary" size="large" style={styles.button} icon={<ArrowRight size={20} color="#FFF" />} />
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 30}>
            <ScrollView ref={scrollViewRef} contentContainerStyle={[styles.scrollContent, { paddingBottom: 320 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              {step !== 'success' && (
                <TouchableOpacity style={styles.backButton} onPress={() => step === 'email' ? router.back() : setStep('email')}>
                  <ArrowLeft size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              )}
              <View style={styles.progressContainer}>
                {['email', 'verify', 'success'].map((s, i) => (
                  <View key={s} style={[styles.progressDot, step === s && styles.progressDotActive, ['verify', 'success'].indexOf(step) >= i && styles.progressDotComplete]} />
                ))}
              </View>
              <View style={styles.content}>
                {step === 'email' && renderEmailStep()}
                {step === 'verify' && renderVerifyStep()}
                {step === 'success' && renderSuccessStep()}
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
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.background.cardLight },
  progressDotActive: { width: 24, backgroundColor: Colors.primary.blue },
  progressDotComplete: { backgroundColor: Colors.primary.blue },
  content: { flex: 1 },
  title: { color: Colors.text.primary, fontSize: 28, fontWeight: '700' as const, marginBottom: 8 },
  subtitle: { color: Colors.text.secondary, fontSize: 16, marginBottom: 32, lineHeight: 24 },
  button: { marginTop: 16 },
  resendBtn: { alignItems: 'center', marginTop: 16 },
  resendText: { color: Colors.primary.blue, fontSize: 14 },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  successIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { color: Colors.text.primary, fontSize: 24, fontWeight: '700' as const, marginBottom: 12 },
  successText: { color: Colors.text.secondary, fontSize: 16, textAlign: 'center', marginBottom: 32, lineHeight: 24 },
});
