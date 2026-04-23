import React, { useState, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, findNodeHandle } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle, Clock, XCircle, Shield, Award, Users, Trophy } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSupport } from '@/contexts/SupportContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';

export default function VerificationScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/profile' as any);
  };
  const { user, isAdmin } = useAuth();
  const { submitVerification, getUserVerificationStatus, isSubmittingVerification } = useSupport();
  const [reason, setReason] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const textAreaContainerRef = useRef<View>(null);

  const scrollToFocusedInput = useCallback(() => {
    if (!scrollViewRef.current || !textAreaContainerRef.current) return;
    const scroll = scrollViewRef.current;
    const container = textAreaContainerRef.current as View & { measureLayout?: (nativeNode: number, onSuccess: (x: number, y: number, w: number, h: number) => void, onFail: () => void) => void };
    const scrollNode = findNodeHandle(scroll as any);
    if (scrollNode != null && typeof container.measureLayout === 'function') {
      setTimeout(() => {
        container.measureLayout!(scrollNode, (_x, y) => {
          const scrollY = Math.max(0, y - 200);
          scroll.scrollTo({ y: scrollY, animated: true });
        }, () => {});
      }, 150);
    }
  }, []);

  const pendingRequest = user ? getUserVerificationStatus(user.id) : null;

  const handleSubmit = async () => {
    if (!user || !reason.trim()) {
      Alert.alert(t('common.error'), t('verification.errorReasonRequired'));
      return;
    }
    try {
      await submitVerification({ userId: user.id, userName: user.fullName, userEmail: user.email, userAvatar: user.avatar, reason: reason.trim() });
      Alert.alert(t('common.success'), t('verification.requestSent'));
      setReason('');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  if (user?.isVerified || isAdmin) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
              <Text style={styles.headerTitle}>{t('verification.title')}</Text>
              <View style={styles.placeholder} />
            </View>
            <View style={styles.centerContent}>
              <View style={styles.verifiedBadge}><CheckCircle size={64} color={Colors.primary.blue} /></View>
              <Text style={styles.verifiedTitle}>{isAdmin ? t('verification.verifiedAdmin') : t('verification.verifiedAccount')}</Text>
              <Text style={styles.verifiedText}>{t('verification.verifiedCongrats')}</Text>
              <Card style={styles.benefitsCard}>
                <Text style={styles.benefitsTitle}>{t('verification.benefitsTitle')}</Text>
                <View style={styles.benefitItem}><Shield size={18} color={Colors.status.success} /><Text style={styles.benefitText}>{t('verification.benefitTrust')}</Text></View>
                <View style={styles.benefitItem}><Users size={18} color={Colors.primary.blue} /><Text style={styles.benefitText}>{t('verification.benefitPriority')}</Text></View>
                <View style={styles.benefitItem}><Trophy size={18} color={Colors.primary.orange} /><Text style={styles.benefitText}>{t('verification.benefitBadge')}</Text></View>
                <View style={styles.benefitItem}><Award size={18} color="#8B5CF6" /><Text style={styles.benefitText}>{t('verification.benefitTournaments')}</Text></View>
              </Card>
            </View>
          </SafeAreaView>
        </View>
      </>
    );
  }

  if (pendingRequest) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
              <Text style={styles.headerTitle}>{t('verification.title')}</Text>
              <View style={styles.placeholder} />
            </View>
            <View style={styles.centerContent}>
              <View style={styles.pendingBadge}><Clock size={64} color={Colors.primary.orange} /></View>
              <Text style={styles.pendingTitle}>{t('verification.pendingTitle')}</Text>
              <Text style={styles.pendingText}>{t('verification.pendingText')}</Text>
              <Card style={styles.requestCard}>
                <Text style={styles.requestLabel}>{t('verification.requestLabel')}</Text>
                <Text style={styles.requestReason}>{pendingRequest.reason}</Text>
                <Text style={styles.requestDate}>{t('verification.submittedOn', { 
                  date: (() => {
                    const date = pendingRequest.createdAt ? new Date(pendingRequest.createdAt) : new Date();
                    return isNaN(date.getTime()) ? new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR') : date.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR');
                  })()
                })}</Text>
              </Card>
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
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle}>{t('verification.requestTitle')}</Text>
            <View style={styles.placeholder} />
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 30}>
          <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: 320 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <View style={styles.profilePreview}>
              <Avatar uri={user?.avatar} name={user?.fullName || ''} size="xlarge" />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.fullName}</Text>
                <Text style={styles.profileUsername}>@{user?.username}</Text>
              </View>
              <View style={styles.badgePreview}><CheckCircle size={18} color={Colors.primary.blue} /></View>
            </View>

            <Card style={styles.infoCard}>
              <Text style={styles.infoTitle}>{t('verification.whatIsTitle')}</Text>
              <Text style={styles.infoText}>{t('verification.whatIsText')}</Text>
            </Card>

            <Card style={styles.benefitsCard}>
              <Text style={styles.benefitsTitle}>{t('verification.benefitsShortTitle')}</Text>
              <View style={styles.benefitItem}><Shield size={18} color={Colors.status.success} /><Text style={styles.benefitText}>{t('verification.benefitTrustStrong')}</Text></View>
              <View style={styles.benefitItem}><Users size={18} color={Colors.primary.blue} /><Text style={styles.benefitText}>{t('verification.benefitJoinPriority')}</Text></View>
              <View style={styles.benefitItem}><Trophy size={18} color={Colors.primary.orange} /><Text style={styles.benefitText}>{t('verification.benefitBadgeProfile')}</Text></View>
              <View style={styles.benefitItem}><Award size={18} color="#8B5CF6" /><Text style={styles.benefitText}>{t('verification.benefitTournaments')}</Text></View>
            </Card>

            <Card style={styles.criteriaCard}>
              <Text style={styles.criteriaTitle}>{t('verification.criteriaTitle')}</Text>
              <Text style={styles.criteriaText}>{t('verification.criteriaText')}</Text>
            </Card>

            <Text style={styles.formLabel}>{t('verification.reasonLabel')}</Text>
            <View ref={textAreaContainerRef} collapsable={false}>
              <TextInput style={styles.textArea} placeholder={t('verification.reasonPlaceholder')} placeholderTextColor={Colors.text.muted} value={reason} onChangeText={setReason} onFocus={scrollToFocusedInput} multiline numberOfLines={5} textAlignVertical="top" maxLength={500} />
            </View>
            <Text style={styles.charCount}>{reason.length}/500</Text>

            <Button title={t('verification.submit')} onPress={handleSubmit} loading={isSubmittingVerification} variant="primary" disabled={!reason.trim()} style={styles.submitBtn} />
            <View style={styles.bottomSpacer} />
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  verifiedBadge: { width: 120, height: 120, borderRadius: 60, backgroundColor: `${Colors.primary.blue}20`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  verifiedTitle: { color: Colors.text.primary, fontSize: 24, fontWeight: '700' as const, marginBottom: 12 },
  verifiedText: { color: Colors.text.secondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  pendingBadge: { width: 120, height: 120, borderRadius: 60, backgroundColor: `${Colors.primary.orange}20`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  pendingTitle: { color: Colors.text.primary, fontSize: 24, fontWeight: '700' as const, marginBottom: 12 },
  pendingText: { color: Colors.text.secondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  requestCard: { width: '100%', marginTop: 16 },
  requestLabel: { color: Colors.text.muted, fontSize: 12, marginBottom: 8 },
  requestReason: { color: Colors.text.primary, fontSize: 14, lineHeight: 20 },
  requestDate: { color: Colors.text.muted, fontSize: 12, marginTop: 12 },
  profilePreview: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  profileInfo: { flex: 1 },
  profileName: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  profileUsername: { color: Colors.text.muted, fontSize: 14, marginTop: 2 },
  badgePreview: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${Colors.primary.blue}20`, alignItems: 'center', justifyContent: 'center' },
  infoCard: { marginBottom: 16 },
  infoTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 8 },
  infoText: { color: Colors.text.secondary, fontSize: 14, lineHeight: 20 },
  benefitsCard: { marginBottom: 16 },
  benefitsTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 12 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  benefitText: { color: Colors.text.secondary, fontSize: 14 },
  criteriaCard: { marginBottom: 24 },
  criteriaTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 8 },
  criteriaText: { color: Colors.text.secondary, fontSize: 14, lineHeight: 24 },
  formLabel: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const, marginBottom: 10 },
  textArea: { backgroundColor: Colors.background.card, borderRadius: 12, padding: 16, color: Colors.text.primary, fontSize: 15, minHeight: 120 },
  charCount: { color: Colors.text.muted, fontSize: 12, textAlign: 'right', marginTop: 8, marginBottom: 20 },
  submitBtn: { marginBottom: 16 },
  bottomSpacer: { height: 40 },
});
