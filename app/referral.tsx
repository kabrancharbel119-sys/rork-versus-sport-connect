import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Gift, Users, Copy, Share2, Trophy, CheckCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useReferral } from '@/contexts/ReferralContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import * as Haptics from 'expo-haptics';

export default function ReferralScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { referrals, getReferralCode, shareCode, applyCode, getTotalRewards, isSharing, isApplying } = useReferral();
  const [inputCode, setInputCode] = useState('');
  const myCode = getReferralCode();
  const totalRewards = getTotalRewards();

  const handleCopyCode = async () => {
    if (!myCode) return;
    try {
      if (Platform.OS === 'web') await navigator.clipboard.writeText(myCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copié!', 'Votre code a été copié dans le presse-papier.');
    } catch (e) { console.log('[Referral] Copy error:', e); }
  };

  const handleShare = async () => {
    try { await shareCode(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } 
    catch (e) { console.log('[Referral] Share error:', e); }
  };

  const handleApplyCode = async () => {
    if (!inputCode.trim()) { Alert.alert('Erreur', 'Entrez un code de parrainage.'); return; }
    try {
      const result = await applyCode(inputCode.trim().toUpperCase());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Félicitations!', `Code appliqué! Vous avez reçu ${result.reward} FCFA de bonus.`);
      setInputCode('');
    } catch (e: any) { Alert.alert('Erreur', e.message || 'Code invalide.'); }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Retour"><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Parrainage</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <LinearGradient colors={[Colors.primary.orange, '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
              <Gift size={48} color="#FFF" />
              <Text style={styles.heroTitle}>Invitez vos amis!</Text>
              <Text style={styles.heroSubtitle}>Gagnez 100 FCFA pour chaque ami qui s{"'"}inscrit avec votre code. Vos amis reçoivent aussi 50 FCFA de bonus!</Text>
            </LinearGradient>

            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Users size={24} color={Colors.primary.blue} />
                <Text style={styles.statValue}>{referrals.length}</Text>
                <Text style={styles.statLabel}>Filleuls</Text>
              </Card>
              <Card style={styles.statCard}>
                <Trophy size={24} color={Colors.primary.orange} />
                <Text style={styles.statValue}>{totalRewards}</Text>
                <Text style={styles.statLabel}>FCFA gagnés</Text>
              </Card>
            </View>

            <Text style={styles.sectionTitle}>Votre code de parrainage</Text>
            <Card style={styles.codeCard}>
              <View style={styles.codeContainer}>
                <Text style={styles.codeText}>{myCode || '------'}</Text>
              </View>
              <View style={styles.codeActions}>
                <TouchableOpacity style={styles.codeButton} onPress={handleCopyCode} accessibilityLabel="Copier le code">
                  <Copy size={20} color={Colors.text.primary} />
                  <Text style={styles.codeButtonText}>Copier</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.codeButton, styles.shareButton]} onPress={handleShare} disabled={isSharing} accessibilityLabel="Partager le code">
                  <Share2 size={20} color="#FFF" />
                  <Text style={[styles.codeButtonText, styles.shareButtonText]}>{isSharing ? '...' : 'Partager'}</Text>
                </TouchableOpacity>
              </View>
            </Card>

            <Text style={styles.sectionTitle}>Utiliser un code</Text>
            <Card style={styles.inputCard}>
              <TextInput style={styles.input} placeholder="Entrez un code (ex: VS123ABC)" placeholderTextColor={Colors.text.muted} value={inputCode} onChangeText={setInputCode} autoCapitalize="characters" maxLength={12} />
              <Button title={isApplying ? 'Application...' : 'Appliquer'} onPress={handleApplyCode} loading={isApplying} variant="primary" size="medium" />
            </Card>

            {referrals.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Vos filleuls ({referrals.length})</Text>
                {referrals.map(ref => (
                  <Card key={ref.id} style={styles.referralCard}>
                    <Avatar name={ref.referredUsername || 'Filleul'} size="small" />
                    <View style={styles.referralInfo}>
                      <Text style={styles.referralName}>{ref.referredUsername || 'Filleul'}</Text>
                      <Text style={styles.referralDate}>{new Date(ref.createdAt).toLocaleDateString('fr-FR')}</Text>
                    </View>
                    <View style={styles.rewardBadge}>
                      <Text style={styles.rewardText}>+{ref.reward} FCFA</Text>
                      {ref.status === 'completed' && <CheckCircle size={14} color={Colors.status.success} />}
                    </View>
                  </Card>
                ))}
              </>
            )}

            <Card style={styles.howItWorksCard}>
              <Text style={styles.howItWorksTitle}>Comment ça marche?</Text>
              <View style={styles.step}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View><Text style={styles.stepText}>Partagez votre code avec vos amis</Text></View>
              <View style={styles.step}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View><Text style={styles.stepText}>Ils s{"'"}inscrivent avec votre code</Text></View>
              <View style={styles.step}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View><Text style={styles.stepText}>Vous recevez 100 FCFA, ils reçoivent 50 FCFA</Text></View>
            </Card>
            <View style={styles.bottomSpacer} />
          </ScrollView>
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
  heroCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20 },
  heroTitle: { color: '#FFF', fontSize: 24, fontWeight: '700' as const, marginTop: 16 },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 20 },
  statValue: { color: Colors.text.primary, fontSize: 28, fontWeight: '700' as const, marginTop: 8 },
  statLabel: { color: Colors.text.muted, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 12 },
  codeCard: { marginBottom: 24 },
  codeContainer: { backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16 },
  codeText: { color: Colors.text.primary, fontSize: 28, fontWeight: '700' as const, letterSpacing: 4 },
  codeActions: { flexDirection: 'row', gap: 12 },
  codeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.background.cardLight, paddingVertical: 12, borderRadius: 12 },
  shareButton: { backgroundColor: Colors.primary.blue },
  codeButtonText: { color: Colors.text.primary, fontSize: 14, fontWeight: '500' as const },
  shareButtonText: { color: '#FFF' },
  inputCard: { marginBottom: 24 },
  input: { backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 16, color: Colors.text.primary, fontSize: 16, marginBottom: 12, textAlign: 'center', letterSpacing: 2 },
  referralCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  referralInfo: { flex: 1 },
  referralName: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  referralDate: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  rewardBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  rewardText: { color: Colors.status.success, fontSize: 13, fontWeight: '600' as const },
  howItWorksCard: { marginTop: 8 },
  howItWorksTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 16 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#FFF', fontSize: 14, fontWeight: '700' as const },
  stepText: { flex: 1, color: Colors.text.secondary, fontSize: 14 },
  bottomSpacer: { height: 20 },
});
