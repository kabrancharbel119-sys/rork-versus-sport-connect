import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, ScanLine, X, CheckCircle, XCircle, Keyboard, Calendar, MapPin, User, Ticket as TicketIcon, Clock, TrendingUp, History, DollarSign } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';
import { ticketsApi } from '@/lib/api/tickets';
import type { TicketEventType } from '@/types';

interface ScanResultData {
  success: boolean;
  error?: string;
  ticketCode?: string;
  ticketTypeName?: string;
  buyerName?: string;
  holderName?: string;
  pricePaid?: number;
  eventName?: string;
  eventType?: string;
  eventDate?: string;
  eventLocation?: string;
  usedAt?: string;
}

export default function ScanTicketsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const scanHistoryQuery = useQuery({
    queryKey: ['scanHistory', user?.id],
    queryFn: () => ticketsApi.getScanHistory(user!.id),
    enabled: !!user?.id,
  });

  const validateMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!user) throw new Error('Non connecté');
      const trimmed = code.trim();
      if (!trimmed) throw new Error('Entrez un code de billet');
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
      if (isUuid) {
        return ticketsApi.validateTicket(trimmed, user.id);
      }
      return ticketsApi.validateTicketByCode(trimmed, user.id);
    },
    onSuccess: (result) => {
      setScanResult({
        success: result.success,
        error: result.error,
        ticketCode: result.ticketCode,
        ticketTypeName: result.ticketTypeName,
        buyerName: result.buyerName,
        holderName: result.holderName,
        pricePaid: result.pricePaid,
        eventName: result.eventName,
        eventType: result.eventType,
        eventDate: result.eventDate,
        eventLocation: result.eventLocation,
        usedAt: result.usedAt,
      });
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['scanHistory', user?.id] });
      }
      setScanning(false);
    },
    onError: (error: Error) => {
      setScanResult({
        success: false,
        error: error.message,
      });
      setScanning(false);
    },
  });

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (!scanning) return;
    setScanning(false);
    validateMutation.mutate(data);
  };

  const handleManualEntry = () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Code requis', 'Veuillez saisir le code du billet.');
      return;
    }
    setManualLoading(true);
    validateMutation.mutate(code, {
      onSettled: () => setManualLoading(false),
    });
  };

  const resetScan = () => {
    setScanResult(null);
    setManualCode('');
    setScanning(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await scanHistoryQuery.refetch();
    setRefreshing(false);
  };

  const scanHistory = scanHistoryQuery.data ?? [];
  const usedCount = scanHistory.filter(t => t.status === 'used').length;
  const validCount = scanHistory.filter(t => t.status === 'valid').length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />

        {/* Camera */}
        {permission?.granted ? (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.9)']}
              style={styles.cameraOverlay}
            >
              <SafeAreaView style={styles.cameraSafeArea}>
                {/* Header */}
                <View style={styles.cameraHeader}>
                  <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/(home)' as any); }} style={styles.cameraBackBtn}>
                    <ArrowLeft size={24} color={Colors.text.primary} />
                  </TouchableOpacity>
                  <Text style={styles.cameraHeaderTitle}>Scanner un billet</Text>
                  <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.cameraBackBtn}>
                    <History size={22} color={Colors.text.primary} />
                  </TouchableOpacity>
                </View>

                {/* Scan Frame */}
                <View style={styles.scanFrameContainer}>
                  <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                    {scanning && (
                      <View style={styles.scanLineContainer}>
                        <ScanLine size={200} color={Colors.primary.orange} strokeWidth={1} />
                      </View>
                    )}
                    {!scanning && !scanResult && (
                      <View style={styles.scannedIndicator}>
                        <ActivityIndicator color={Colors.primary.orange} size="large" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.scanInstructions}>
                    Positionnez le QR code du billet dans le cadre
                  </Text>
                </View>

                {/* Stats */}
                <View style={styles.cameraStatsRow}>
                  <View style={styles.cameraStatItem}>
                    <CheckCircle size={16} color={Colors.status.success} />
                    <Text style={styles.cameraStatValue}>{usedCount}</Text>
                    <Text style={styles.cameraStatLabel}>Validés</Text>
                  </View>
                  <View style={styles.cameraStatItem}>
                    <TicketIcon size={16} color={Colors.primary.orange} />
                    <Text style={styles.cameraStatValue}>{validCount}</Text>
                    <Text style={styles.cameraStatLabel}>En attente</Text>
                  </View>
                </View>

                {/* Bottom */}
                <View style={styles.cameraBottomInfo}>
                  <TouchableOpacity
                    style={styles.manualEntryBtn}
                    onPress={() => setShowManualEntry(true)}
                    activeOpacity={0.85}
                  >
                    <Keyboard size={18} color={Colors.primary.orange} />
                    <Text style={styles.manualEntryText}>Saisir le code manuellement</Text>
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </LinearGradient>
          </View>
        ) : (
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.cameraHeader}>
              <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/(home)' as any); }} style={styles.cameraBackBtn}>
                <ArrowLeft size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.cameraHeaderTitle}>Scanner un billet</Text>
              <View style={{ width: 44 }} />
            </View>
            <View style={styles.permissionContainer}>
              <ScanLine size={48} color={Colors.text.muted} />
              <Text style={styles.permissionText}>
                L'accès à la caméra est nécessaire pour scanner les QR codes des billets.
              </Text>
              <Button title="Autoriser la caméra" onPress={requestPermission} variant="orange" />
              <TouchableOpacity
                style={styles.manualEntryBtn}
                onPress={() => setShowManualEntry(true)}
                activeOpacity={0.85}
              >
                <Keyboard size={18} color={Colors.primary.orange} />
                <Text style={styles.manualEntryText}>Saisir le code manuellement</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}

        {/* Scan result overlay */}
        {scanResult && (
          <View style={styles.scanResultOverlay}>
            <View style={styles.scanResultCard}>
              {/* Header avec gradient */}
              <LinearGradient
                colors={scanResult.success
                  ? [Colors.status.success, '#0E8A4F']
                  : [Colors.status.error, '#C0392B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.scanResultGradientHeader}
              >
                <View style={styles.scanResultIconCircle}>
                  {scanResult.success
                    ? <CheckCircle size={40} color="#FFF" />
                    : <XCircle size={40} color="#FFF" />}
                </View>
                <Text style={styles.scanResultGradientTitle}>
                  {scanResult.success ? 'Billet validé !' : 'Billet invalide'}
                </Text>
                <Text style={styles.scanResultGradientSub}>
                  {scanResult.success ? 'Accès autorisé' : scanResult.error || 'Ce billet ne peut pas être utilisé'}
                </Text>
                <TouchableOpacity onPress={resetScan} style={styles.scanResultCloseBtn}>
                  <X size={20} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </LinearGradient>

              {scanResult.success ? (
                <View style={styles.scanResultContent}>
                  {/* Section Événement */}
                  {scanResult.eventName && (
                    <View style={styles.scanResultSection}>
                      <View style={styles.scanResultSectionHeader}>
                        <TicketIcon size={14} color={Colors.primary.orange} />
                        <Text style={styles.scanResultSectionTitle}>Événement</Text>
                      </View>
                      <Text style={styles.scanResultEventName}>{scanResult.eventName}</Text>
                      {scanResult.ticketTypeName && (
                        <View style={styles.scanResultTypeBadge}>
                          <Text style={styles.scanResultTypeText}>{scanResult.ticketTypeName}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Section Détails */}
                  <View style={styles.scanResultDetailsGrid}>
                    {scanResult.buyerName && (
                      <View style={styles.scanResultDetailCell}>
                        <User size={14} color={Colors.text.muted} />
                        <Text style={styles.scanResultDetailLabel}>Acheteur</Text>
                        <Text style={styles.scanResultDetailValue}>{scanResult.buyerName}</Text>
                      </View>
                    )}
                    {scanResult.holderName && (
                      <View style={styles.scanResultDetailCell}>
                        <User size={14} color={Colors.text.muted} />
                        <Text style={styles.scanResultDetailLabel}>Titulaire</Text>
                        <Text style={styles.scanResultDetailValue}>{scanResult.holderName}</Text>
                      </View>
                    )}
                    {scanResult.eventDate && (
                      <View style={styles.scanResultDetailCell}>
                        <Calendar size={14} color={Colors.text.muted} />
                        <Text style={styles.scanResultDetailLabel}>Date</Text>
                        <Text style={styles.scanResultDetailValue}>{formatDate(scanResult.eventDate)}</Text>
                        <Text style={styles.scanResultDetailSub}>{formatTime(scanResult.eventDate)}</Text>
                      </View>
                    )}
                    {scanResult.eventLocation && (
                      <View style={styles.scanResultDetailCell}>
                        <MapPin size={14} color={Colors.text.muted} />
                        <Text style={styles.scanResultDetailLabel}>Lieu</Text>
                        <Text style={styles.scanResultDetailValue} numberOfLines={2}>{scanResult.eventLocation}</Text>
                      </View>
                    )}
                    {scanResult.pricePaid !== undefined && (
                      <View style={styles.scanResultDetailCell}>
                        <DollarSign size={14} color={Colors.text.muted} />
                        <Text style={styles.scanResultDetailLabel}>Prix</Text>
                        <Text style={styles.scanResultDetailValue}>
                          {scanResult.pricePaid === 0 ? 'Gratuit' : `${scanResult.pricePaid.toLocaleString()} F`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Code du billet */}
                  {scanResult.ticketCode && (
                    <View style={styles.scanResultCodeBox}>
                      <Text style={styles.scanResultCodeLabel}>Code du billet</Text>
                      <Text style={styles.scanResultCodeValue}>{scanResult.ticketCode}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.scanResultErrorContent}>
                  {scanResult.ticketCode && (
                    <View style={styles.scanResultCodeBox}>
                      <Text style={styles.scanResultCodeLabel}>Code du billet</Text>
                      <Text style={styles.scanResultCodeValue}>{scanResult.ticketCode}</Text>
                    </View>
                  )}
                  {scanResult.eventName && (
                    <Text style={styles.scanResultErrorEvent}>{scanResult.eventName}</Text>
                  )}
                </View>
              )}

              <View style={styles.scanResultActions}>
                <Button
                  title="Scanner un autre"
                  onPress={resetScan}
                  variant="outline"
                  size="medium"
                  style={{ flex: 1 }}
                />
                <Button
                  title="Fermer"
                  onPress={() => { resetScan(); if (router.canGoBack()) router.back(); else router.replace('/(tabs)/(home)' as any); }}
                  variant="ghost"
                  size="medium"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        )}

        {/* Manual entry modal */}
        <Modal visible={showManualEntry} transparent animationType="slide" onRequestClose={() => setShowManualEntry(false)}>
          <View style={styles.manualOverlay}>
            <View style={styles.manualCard}>
              <View style={styles.manualHeader}>
                <Text style={styles.manualTitle}>Saisir le code du billet</Text>
                <TouchableOpacity onPress={() => { setShowManualEntry(false); setManualCode(''); }} style={styles.manualCloseBtn}>
                  <X size={20} color={Colors.text.muted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.manualSubtitle}>
                Demandez au participant de vous communiquer le code affiché sous son QR code.
              </Text>
              <TextInput
                style={styles.manualInput}
                value={manualCode}
                onChangeText={(text) => setManualCode(text.toUpperCase())}
                placeholder="Ex: VS-A1B2C3D4"
                placeholderTextColor={Colors.text.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleManualEntry}
              />
              <TouchableOpacity
                style={styles.manualSubmitBtn}
                onPress={handleManualEntry}
                disabled={manualLoading || !manualCode.trim()}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.primary.orange, Colors.primary.orangeDark]}
                  style={styles.manualSubmitGradient}
                >
                  {manualLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.manualSubmitText}>Valider le billet</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* History modal */}
        <Modal visible={showHistory} animationType="slide" onRequestClose={() => setShowHistory(false)}>
          <View style={styles.historyContainer}>
            <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.historyHeader}>
                <TouchableOpacity onPress={() => setShowHistory(false)} style={styles.cameraBackBtn}>
                  <ArrowLeft size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.historyTitle}>Historique des scans</Text>
                <View style={{ width: 44 }} />
              </View>

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
              >
                <View style={styles.historyStats}>
                  <View style={styles.historyStatItem}>
                    <CheckCircle size={18} color={Colors.status.success} />
                    <Text style={styles.historyStatValue}>{usedCount}</Text>
                    <Text style={styles.historyStatLabel}>Billets validés</Text>
                  </View>
                  <View style={styles.historyStatItem}>
                    <TicketIcon size={18} color={Colors.primary.orange} />
                    <Text style={styles.historyStatValue}>{validCount}</Text>
                    <Text style={styles.historyStatLabel}>Non scannés</Text>
                  </View>
                </View>

                {scanHistoryQuery.isLoading ? (
                  <ActivityIndicator size="large" color={Colors.primary.orange} style={{ marginTop: 40 }} />
                ) : scanHistory.length === 0 ? (
                  <View style={styles.emptyState}>
                    <History size={40} color={Colors.text.muted} />
                    <Text style={styles.emptyTitle}>Aucun billet</Text>
                    <Text style={styles.emptyText}>Les billets que vous validez apparaîtront ici.</Text>
                  </View>
                ) : (
                  scanHistory.map((t) => (
                    <View key={t.id} style={[styles.historyCard, t.status === 'used' && { borderLeftColor: Colors.status.success }]}>
                      <View style={styles.historyCardLeft}>
                        <View style={[styles.historyStatusDot, { backgroundColor: t.status === 'used' ? Colors.status.success : Colors.primary.orange }]} />
                        <View style={styles.historyCardInfo}>
                          <Text style={styles.historyCardCode}>{t.ticketCode}</Text>
                          <Text style={styles.historyCardType}>{t.ticketTypeName}</Text>
                          <Text style={styles.historyCardBuyer}>{t.buyerName}</Text>
                        </View>
                      </View>
                      <View style={styles.historyCardRight}>
                        {t.usedAt ? (
                          <>
                            <Clock size={12} color={Colors.text.muted} />
                            <Text style={styles.historyCardTime}>
                              {new Date(t.usedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.historyCardPending}>En attente</Text>
                        )}
                      </View>
                    </View>
                  ))
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.dark },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flex: 1,
  },
  cameraSafeArea: { flex: 1 },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cameraBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraHeaderTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  scanFrameContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanFrame: {
    width: 240,
    height: 240,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: Colors.primary.orange,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 12 },
  scanLineContainer: { position: 'absolute' },
  scannedIndicator: { position: 'absolute' },
  scanInstructions: {
    color: Colors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 32,
  },
  cameraStatsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 16,
  },
  cameraStatItem: { alignItems: 'center', gap: 2 },
  cameraStatValue: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  cameraStatLabel: { color: Colors.text.muted, fontSize: 11 },
  cameraBottomInfo: { paddingBottom: 24, alignItems: 'center' },
  manualEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  manualEntryText: { color: Colors.primary.orange, fontSize: 14, fontWeight: '600' as const },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 20,
  },
  permissionText: {
    color: Colors.text.muted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },

  // Scan result
  scanResultOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scanResultCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
  },
  scanResultGradientHeader: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  scanResultIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  scanResultGradientTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800' as const,
  },
  scanResultGradientSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  scanResultCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanResultContent: {
    padding: 20,
  },
  scanResultSection: {
    marginBottom: 16,
  },
  scanResultSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  scanResultSectionTitle: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  scanResultEventName: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 24,
  },
  scanResultTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: `${Colors.primary.orange}20`,
    alignSelf: 'flex-start',
  },
  scanResultTypeText: {
    color: Colors.primary.orange,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  scanResultDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 16,
  },
  scanResultDetailCell: {
    flex: 1,
    minWidth: '45%' as any,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  scanResultDetailLabel: {
    color: Colors.text.muted,
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
  scanResultDetailValue: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  scanResultDetailSub: {
    color: Colors.text.muted,
    fontSize: 11,
  },
  scanResultCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  scanResultCodeLabel: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  scanResultCodeValue: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '800' as const,
    fontFamily: 'monospace' as any,
    letterSpacing: 1,
  },
  scanResultErrorContent: {
    padding: 20,
  },
  scanResultErrorEvent: {
    color: Colors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  scanResultActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 20 },

  // Manual entry
  manualOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  manualCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  manualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manualTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  manualCloseBtn: { padding: 4 },
  manualSubtitle: {
    color: Colors.text.muted,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  manualInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text.primary,
    fontSize: 16,
    fontFamily: 'monospace' as any,
    marginBottom: 16,
  },
  manualSubmitBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  manualSubmitGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  manualSubmitText: { color: '#FFF', fontSize: 15, fontWeight: '700' as const },

  // History
  historyContainer: { flex: 1, backgroundColor: Colors.background.dark },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  historyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 20,
  },
  historyStatItem: { alignItems: 'center', gap: 4 },
  historyStatValue: { color: Colors.text.primary, fontSize: 24, fontWeight: '800' as const },
  historyStatLabel: { color: Colors.text.muted, fontSize: 12 },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const, marginTop: 16 },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary.orange,
  },
  historyCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  historyStatusDot: { width: 8, height: 8, borderRadius: 4 },
  historyCardInfo: { flex: 1 },
  historyCardCode: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' as const, fontFamily: 'monospace' as any },
  historyCardType: { color: Colors.text.secondary, fontSize: 12, marginTop: 2 },
  historyCardBuyer: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },
  historyCardRight: { alignItems: 'flex-end', gap: 2 },
  historyCardTime: { color: Colors.text.muted, fontSize: 11 },
  historyCardPending: { color: Colors.primary.orange, fontSize: 11, fontWeight: '600' as const },
});
