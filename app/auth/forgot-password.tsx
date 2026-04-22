import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { ArrowLeft, Mail, Send } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { resetPassword } from '@/lib/api/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validate = () => {
    if (!email.trim()) {
      setError('Email requis');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email invalide');
      return false;
    }
    setError('');
    return true;
  };

  const handleReset = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      setError('');
      await resetPassword(email.trim());
      Alert.alert(
        'Email envoyé',
        'Un lien de réinitialisation a été envoyé à votre adresse email.',
        [
          {
            text: 'OK',
            onPress: () => safeBack(router, '/auth/login'),
          },
        ]
      );
    } catch (err: any) {
      console.error('[ForgotPassword] Error:', err);
      setError(err.message || 'Erreur lors de l\'envoi de l\'email');
    } finally {
      setLoading(false);
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
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => safeBack(router, '/auth/login')}
            >
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>

            <View style={styles.header}>
              <Image
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bb74j32pntaehgnts84r7' }}
                style={styles.logo}
                contentFit="contain"
              />
              <Text style={styles.title}>Mot de passe oublié ?</Text>
              <Text style={styles.subtitle}>
                Entrez votre email pour recevoir un lien de réinitialisation
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                testID="input-email"
                label="Email"
                placeholder="exemple@email.com"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                icon={<Mail size={20} color={Colors.text.muted} />}
              />

              <Button
                testID="btn-reset"
                title="Envoyer le lien"
                onPress={handleReset}
                loading={loading}
                variant="primary"
                size="large"
                style={styles.resetButton}
                icon={<Send size={20} color="#fff" />}
              />

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Vous vous souvenez ?</Text>
              <TouchableOpacity onPress={() => safeBack(router, '/auth/login')}>
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
    paddingHorizontal: 20,
  },
  form: {
    gap: 16,
  },
  resetButton: {
    marginTop: 8,
  },
  errorText: {
    color: Colors.status.error,
    fontSize: 14,
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
    color: Colors.primary.orange,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
