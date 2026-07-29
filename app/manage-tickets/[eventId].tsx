import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Pressable, RefreshControl, ActivityIndicator, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ArrowLeft, Plus, Ticket as TicketIcon, TrendingUp, ScanLine, X, CheckCircle, XCircle, Trash2, Power, Keyboard } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';
import { ticketsApi } from '@/lib/api/tickets';
import { tournamentsApi } from '@/lib/api/tournaments';
import { matchesApi } from '@/lib/api/matches';
import type { TicketType, TicketEventType } from '@/types';

export default function ManageTicketsScreen() {
  const { eventId, type, eventName } = useLocalSearchParams<{ eventId: string; type: string; eventName?: string }>();
  const eventType = (type === 'tournament' ? 'tournament' : 'match') as TicketEventType;
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanCode, setScanCode] = useState('');
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const scanningRef = useRef(true);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);

  // Access control: creator/manager can manage, admin can monitor (read-only)
  const ownershipQuery = useQuery({
    queryKey: ['event-ownership', eventType, eventId],
    queryFn: async () => {
      if (!user || !eventId) return { authorized: false, readOnly: false };
      if (isAdmin) {
        return { authorized: true, readOnly: true };
      }
      if (eventType === 'tournament') {
        const t = await tournamentsApi.getById(eventId);
        const authorized = t.createdBy === user.id || (t.managers ?? []).includes(user.id);
        return { authorized, readOnly: false, name: t.name };
      } else {
        const m = await matchesApi.getById(eventId);
        const authorized = m.createdBy === user.id;
        return { authorized, readOnly: false, name: `${m.sport} match` };
      }
    },
    enabled: !!eventId && !!user,
  });

  const isAuthorized = ownershipQuery.data?.authorized ?? false;
  const isReadOnly = ownershipQuery.data?.readOnly ?? false;

  // Fetch tournament details to compute event days for multi-day ticket selection
  const tournamentDetailsQuery = useQuery({
    queryKey: ['tournamentDetails', eventId],
    queryFn: () => tournamentsApi.getById(eventId!),
    enabled: eventType === 'tournament' && !!eventId,
  });

  const eventDays = useMemo(() => {
    if (eventType !== 'tournament' || !tournamentDetailsQuery.data) return [];
    const t = tournamentDetailsQuery.data;
    if (!t.startDate || !t.endDate) return [];
    const start = new Date(t.startDate);
    const end = new Date(t.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
    const days: { date: string; label: string }[] = [];
    const cur = new Date(start);
    let dayNum = 1;
    while (cur <= end) {
      const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      const label = `Jour ${dayNum} - ${cur.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`;
      days.push({ date: dateStr, label });
      cur.setDate(cur.getDate() + 1);
      dayNum++;
    }
    return days;
  }, [eventType, tournamentDetailsQuery.data]);

  useEffect(() => {
    if (showScanModal && !cameraPermission?.granted) {
      requestCameraPermission();
    }
  }, [showScanModal, cameraPermission]);

  // Formulaire création
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formMaxPerUser, setFormMaxPerUser] = useState('10');
  const [formValidDays, setFormValidDays] = useState<string[] | null>(null);

  const ticketTypesQuery = useQuery({
    queryKey: ['ticketTypes', eventType, eventId],
    queryFn: () => ticketsApi.getTicketTypesForEvent(eventType, eventId!),
    enabled: !!eventId,
  });

  const statsQuery = useQuery({
    queryKey: ['ticketStats', eventType, eventId],
    queryFn: () => ticketsApi.getEventSalesStats(eventType, eventId!),
    enabled: !!eventId,
  });

  const ticketTypes = ticketTypesQuery.data ?? [];
  const stats = statsQuery.data;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      const name = formName.trim();
      const price = parseInt(formPrice, 10);
      const quantity = parseInt(formQuantity, 10);
      const maxPerUser = parseInt(formMaxPerUser, 10) || 10;
      if (!name) throw new Error('Le nom du billet est requis');
      if (isNaN(price) || price < 0) throw new Error('Prix invalide');
      if (isNaN(quantity) || quantity <= 0) throw new Error('Quantité invalide');

      return ticketsApi.createTicketType({
        eventType,
        eventId: eventId!,
        name,
        description: formDescription.trim() || undefined,
        price,
        quantityTotal: quantity,
        maxPerUser,
        validDays: formValidDays,
        createdBy: user.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticketTypes', eventType, eventId] });
      queryClient.invalidateQueries({ queryKey: ['ticketStats', eventType, eventId] });
      setShowCreateModal(false);
      setFormName('');
      setFormDescription('');
      setFormPrice('');
      setFormQuantity('');
      setFormMaxPerUser('10');
      setFormValidDays(null);
      Alert.alert('Succès', 'Type de billet créé. La vente est ouverte !');
    },
    onError: (error: Error) => {
      Alert.alert('Erreur', error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (tt: TicketType) => ticketsApi.updateTicketType(tt.id, { isActive: !tt.isActive }),
    onSuccess: (_data, tt) => {
      queryClient.invalidateQueries({ queryKey: ['ticketTypes', eventType, eventId] });
      Alert.alert('Succès', tt.isActive ? 'Vente de billets désactivée.' : 'Vente de billets activée.');
    },
    onError: (error: Error) => Alert.alert('Erreur', error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (ticketTypeId: string) => ticketsApi.deleteTicketType(ticketTypeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticketTypes', eventType, eventId] });
      queryClient.invalidateQueries({ queryKey: ['ticketStats', eventType, eventId] });
      Alert.alert('Succès', 'Type de billet supprimé.');
    },
    onError: (error: Error) => Alert.alert('Erreur', error.message),
  });

  const validateMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!user) throw new Error('Non connecté');
      const trimmed = code.trim();
      if (!trimmed) throw new Error('Entrez un code de billet');
      // Accepte soit un code VS-XXXX soit un QR token (UUID)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
      if (isUuid) {
        return ticketsApi.validateTicket(trimmed, user.id, eventId, eventType);
      }
      return ticketsApi.validateTicketByCode(trimmed, user.id, eventId, eventType);
    },
    onSuccess: (result) => {
      if (result.success) {
        const lines = [`✅ Billet valide !`];
        if (result.eventName) lines.push(`Événement: ${result.eventName}`);
        if (result.ticketTypeName) lines.push(`Type: ${result.ticketTypeName}`);
        if (result.buyerName) lines.push(`Acheteur: ${result.buyerName}`);
        if (result.holderName) lines.push(`Titulaire: ${result.holderName}`);
        if (result.ticketCode) lines.push(`Code: ${result.ticketCode}`);
        if (result.pricePaid !== undefined) lines.push(`Prix: ${result.pricePaid === 0 ? 'Gratuit' : `${result.pricePaid.toLocaleString()} FCFA`}`);
        setScanResult({
          success: true,
          message: lines.join('\n'),
        });
        queryClient.invalidateQueries({ queryKey: ['ticketStats', eventType, eventId] });
        queryClient.invalidateQueries({ queryKey: ['myTickets'] });
      } else {
        const lines = [`❌ ${result.error || 'Billet invalide'}`];
        if (result.ticketCode) lines.push(`Code: ${result.ticketCode}`);
        if (result.eventName) lines.push(`Événement: ${result.eventName}`);
        setScanResult({ success: false, message: lines.join('\n') });
      }
      setScanCode('');
      setScanning(false);
    },
    onError: (error: Error) => {
      setScanResult({ success: false, message: `❌ ${error.message}` });
      setScanning(false);
    },
  });

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (!scanningRef.current) return;
    scanningRef.current = false;
    setScanning(false);
    validateMutation.mutate(data);
  };

  const handleManualEntry = () => {
    const code = scanCode.trim().toUpperCase();
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
    setScanCode('');
    scanningRef.current = true;
    setScanning(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([ticketTypesQuery.refetch(), statsQuery.refetch()]);
    setRefreshing(false);
  };

  const handleDelete = (tt: TicketType) => {
    if (tt.quantitySold > 0) {
      Alert.alert('Impossible', 'Des billets ont déjà été vendus pour ce type. Désactivez-le plutôt.');
      return;
    }
    Alert.alert(
      'Supprimer',
      `Supprimer le type de billet "${tt.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteMutation.mutate(tt.id) },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/tournaments' as any); }}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Billetterie</Text>
              {!!eventName && <Text style={styles.headerSubtitle} numberOfLines={1}>{eventName}</Text>}
            </View>
            {!isReadOnly && (
            <TouchableOpacity style={styles.scanButton} onPress={() => { setScanResult(null); scanningRef.current = true; setScanning(true); setShowScanModal(true); }} disabled={!isAuthorized}>
              <ScanLine size={22} color={isAuthorized ? Colors.primary.orange : Colors.text.muted} />
            </TouchableOpacity>
            )}
          </View>

          {ownershipQuery.isLoading ? (
            <View style={styles.accessDeniedWrap}>
              <ActivityIndicator size="large" color={Colors.primary.orange} />
              <Text style={styles.accessDeniedText}>Vérification des accès…</Text>
            </View>
          ) : !isAuthorized ? (
            <View style={styles.accessDeniedWrap}>
              <XCircle size={48} color={Colors.status.error} />
              <Text style={styles.accessDeniedTitle}>Accès refusé</Text>
              <Text style={styles.accessDeniedText}>
                Seul le créateur de l'événement ou un gestionnaire autorisé peut gérer la billetterie.
              </Text>
              <Button title="Retour" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/tournaments' as any); }} variant="outline" size="medium" style={{ marginTop: 20 }} />
            </View>
          ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.blue} />}
          >
            {/* Stats de vente */}
            {stats && (
              <View style={styles.statsCard}>
                <View style={styles.statsHeader}>
                  <TrendingUp size={18} color={Colors.primary.orange} />
                  <Text style={styles.statsTitle}>Ventes</Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.totalSold}</Text>
                    <Text style={styles.statLabel}>Vendus</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.totalUsed}</Text>
                    <Text style={styles.statLabel}>Utilisés</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.totalRevenue.toLocaleString()}</Text>
                    <Text style={styles.statLabel}>FCFA</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Liste des types de billets */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Types de billets</Text>
              {!isReadOnly && (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
                <Plus size={18} color="#FFF" />
                <Text style={styles.addBtnText}>Créer</Text>
              </TouchableOpacity>
              )}
            </View>

            {ticketTypesQuery.isLoading ? (
              <ActivityIndicator size="large" color={Colors.primary.blue} style={{ marginTop: 24 }} />
            ) : ticketTypes.length === 0 ? (
              <View style={styles.emptyState}>
                <TicketIcon size={40} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>Aucun billet créé</Text>
                <Text style={styles.emptyText}>Créez un type de billet pour ouvrir la vente (ex: Entrée standard, VIP).</Text>
              </View>
            ) : (
              ticketTypes.map(tt => (
                <View key={tt.id} style={[styles.typeCard, !tt.isActive && { opacity: 0.55 }]}>
                  <View style={styles.typeInfo}>
                    <Text style={styles.typeName}>{tt.name}</Text>
                    {!!tt.description && <Text style={styles.typeDescription}>{tt.description}</Text>}
                    <Text style={styles.typePrice}>
                      {tt.price === 0 ? 'Gratuit' : `${tt.price.toLocaleString()} FCFA`}
                    </Text>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(100, (tt.quantitySold / tt.quantityTotal) * 100)}%` }]} />
                    </View>
                    <Text style={styles.typeSold}>{tt.quantitySold} / {tt.quantityTotal} vendus</Text>
                    {tt.validDays && tt.validDays.length > 0 && (
                      <Text style={styles.typeValidDays}>
                        Jours: {tt.validDays.map(d => {
                          const date = new Date(d + 'T00:00:00');
                          return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                        }).join(', ')}
                      </Text>
                    )}
                    {tt.validDays === null && (
                      <Text style={styles.typeAllDays}>Tous les jours</Text>
                    )}
                  </View>
                  <View style={styles.typeActions}>
                    <View style={styles.switchRow}>
                      <Power size={14} color={tt.isActive ? Colors.status.success : Colors.text.muted} />
                      <Switch
                        value={tt.isActive}
                        onValueChange={() => toggleActiveMutation.mutate(tt)}
                        disabled={isReadOnly}
                        trackColor={{ false: 'rgba(255,255,255,0.15)', true: `${Colors.status.success}80` }}
                        thumbColor={tt.isActive ? Colors.status.success : Colors.text.muted}
                      />
                    </View>
                    {tt.quantitySold === 0 && !isReadOnly && (
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(tt)}>
                        <Trash2 size={16} color={Colors.status.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}

            {/* Détails ventes par type */}
            {stats && stats.byType.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Détail par type</Text>
                {stats.byType.map(bt => (
                  <View key={bt.ticketTypeId} style={styles.detailRow}>
                    <Text style={styles.detailName}>{bt.name}</Text>
                    <Text style={styles.detailValues}>
                      {bt.sold}/{bt.total} vendus · {bt.used} scannés · {bt.revenue.toLocaleString()} F
                    </Text>
                  </View>
                ))}
              </>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
          )}
        </SafeAreaView>
      </View>

      {/* Modal création de type de billet */}
      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreateModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%' }}
          >
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouveau type de billet</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)} style={{ padding: 4 }}>
                  <X size={22} color={Colors.text.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 500 }}
              >
                <Text style={styles.inputLabel}>Nom *</Text>
                <TextInput
                  style={styles.input}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="Ex: Entrée standard, VIP..."
                  placeholderTextColor={Colors.text.muted}
                />

                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.input}
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder="Ex: Accès tribune principale"
                  placeholderTextColor={Colors.text.muted}
                />

                <View style={styles.inputRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Prix (FCFA) *</Text>
                    <TextInput
                      style={styles.input}
                      value={formPrice}
                      onChangeText={setFormPrice}
                      placeholder="0 = gratuit"
                      placeholderTextColor={Colors.text.muted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Quantité *</Text>
                    <TextInput
                      style={styles.input}
                      value={formQuantity}
                      onChangeText={setFormQuantity}
                      placeholder="Ex: 100"
                      placeholderTextColor={Colors.text.muted}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Max par personne</Text>
                <TextInput
                  style={styles.input}
                  value={formMaxPerUser}
                  onChangeText={setFormMaxPerUser}
                  placeholder="10"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="numeric"
                />

                {eventDays.length > 1 && (
                  <View style={styles.formDaysSection}>
                    <Text style={styles.formDaysLabel}>Jours de validité</Text>
                    <View style={styles.formDaysRow}>
                      <TouchableOpacity
                        style={[styles.formDayChip, formValidDays === null && styles.formDayChipActive]}
                        onPress={() => setFormValidDays(null)}
                      >
                        <Text style={[styles.formDayChipText, formValidDays === null && styles.formDayChipTextActive]}>Tous les jours</Text>
                      </TouchableOpacity>
                      {eventDays.map((d) => {
                        const isSelected = formValidDays !== null && formValidDays.includes(d.date);
                        return (
                          <TouchableOpacity
                            key={d.date}
                            style={[styles.formDayChip, isSelected && styles.formDayChipActive]}
                            onPress={() => {
                              if (formValidDays === null) {
                                setFormValidDays([d.date]);
                              } else if (isSelected) {
                                const filtered = formValidDays.filter(dd => dd !== d.date);
                                setFormValidDays(filtered.length === 0 ? null : filtered);
                              } else {
                                setFormValidDays([...formValidDays, d.date]);
                              }
                            }}
                          >
                            <Text style={[styles.formDayChipText, isSelected && styles.formDayChipTextActive]}>{d.label.split(' - ')[0]}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {formValidDays !== null && formValidDays.length > 0 && (
                      <Text style={styles.formDaysSelected}>
                        Valide: {formValidDays.map(d => eventDays.find(ed => ed.date === d)?.label ?? d).join(', ')}
                      </Text>
                    )}
                  </View>
                )}

                <Button
                  title="Créer le billet"
                  onPress={() => createMutation.mutate()}
                  variant="orange"
                  disabled={createMutation.isPending}
                  style={{ marginTop: 16, marginBottom: 8 }}
                />
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Modal scan / validation — full-screen camera */}
      <Modal visible={showScanModal} animationType="slide" onRequestClose={() => { setShowScanModal(false); resetScan(); }}>
        <View style={styles.scanModalContainer}>
          <Stack.Screen options={{ headerShown: false }} />

          {/* Camera or permission prompt */}
          {cameraPermission?.granted ? (
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.7)']}
                style={styles.cameraOverlay}
              >
                {/* Header */}
                <View style={styles.cameraHeader}>
                  <TouchableOpacity onPress={() => { setShowScanModal(false); resetScan(); }} style={styles.cameraBackBtn}>
                    <ArrowLeft size={24} color={Colors.text.primary} />
                  </TouchableOpacity>
                  <Text style={styles.cameraHeaderTitle}>Scanner un billet</Text>
                  <View style={{ width: 44 }} />
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
                    {!scanning && (
                      <View style={styles.scannedIndicator}>
                        <ActivityIndicator color={Colors.primary.orange} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.scanInstructions}>
                    Positionnez le QR code du billet dans le cadre
                  </Text>
                </View>

                {/* Bottom info */}
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
              </LinearGradient>
            </View>
          ) : (
            <View style={styles.permissionContainer}>
              <Stack.Screen options={{ headerShown: false }} />
              <View style={styles.cameraHeader}>
                <TouchableOpacity onPress={() => setShowScanModal(false)} style={styles.cameraBackBtn}>
                  <ArrowLeft size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.cameraHeaderTitle}>Scanner un billet</Text>
                <View style={{ width: 44 }} />
              </View>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 20 }}>
                <ScanLine size={48} color={Colors.text.muted} />
                <Text style={styles.permissionText}>
                  L'accès à la caméra est nécessaire pour scanner les QR codes des billets.
                </Text>
                <Button
                  title="Autoriser la caméra"
                  onPress={requestCameraPermission}
                  variant="orange"
                />
                <TouchableOpacity
                  style={styles.manualEntryBtn}
                  onPress={() => setShowManualEntry(true)}
                  activeOpacity={0.85}
                >
                  <Keyboard size={18} color={Colors.primary.orange} />
                  <Text style={styles.manualEntryText}>Saisir le code manuellement</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Scan result overlay */}
          {scanResult && (
            <View style={styles.scanResultOverlay}>
              <View style={styles.scanResultCard}>
                <View style={styles.scanResultHeader}>
                  {scanResult.success
                    ? <CheckCircle size={28} color={Colors.status.success} />
                    : <XCircle size={28} color={Colors.status.error} />}
                  <Text style={[styles.scanResultTitle, { color: scanResult.success ? Colors.status.success : Colors.status.error }]}>
                    {scanResult.success ? 'Billet validé !' : 'Billet invalide'}
                  </Text>
                  <TouchableOpacity onPress={resetScan} style={styles.scanResultClose}>
                    <X size={20} color={Colors.text.muted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.scanResultMessage}>{scanResult.message}</Text>
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
                    onPress={() => { setShowScanModal(false); resetScan(); }}
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
                  <TouchableOpacity onPress={() => { setShowManualEntry(false); setScanCode(''); }} style={styles.manualCloseBtn}>
                    <X size={20} color={Colors.text.muted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.manualSubtitle}>
                  Demandez au participant de vous communiquer le code affiché sous son QR code.
                </Text>
                <TextInput
                  style={styles.manualInput}
                  value={scanCode}
                  onChangeText={(text) => setScanCode(text.toUpperCase())}
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
                  disabled={manualLoading || !scanCode.trim()}
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
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.dark },
  safeArea: { flex: 1 },
  accessDeniedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  accessDeniedTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700', marginTop: 16 },
  accessDeniedText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: { flex: 1, marginLeft: 12 },
  headerTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  headerSubtitle: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  scanButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,107,0,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  statsCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  statsTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const },
  statsRow: { flexDirection: 'row' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: Colors.text.primary, fontSize: 22, fontWeight: '800' as const },
  statLabel: { color: Colors.text.muted, fontSize: 12, marginTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text.secondary,
    fontSize: 14,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary.orange,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' as const },
  emptyState: { alignItems: 'center', marginTop: 32, paddingHorizontal: 32 },
  emptyTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const, marginTop: 12 },
  emptyText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  typeCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  typeInfo: { flex: 1 },
  typeName: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const },
  typeDescription: { color: Colors.text.secondary, fontSize: 13, marginTop: 2 },
  typePrice: { color: Colors.primary.orange, fontSize: 16, fontWeight: '800' as const, marginTop: 6 },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 10,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.primary.orange,
  },
  typeSold: { color: Colors.text.muted, fontSize: 12, marginTop: 6 },
  typeValidDays: { color: Colors.primary.blue, fontSize: 11, marginTop: 4, fontWeight: '500' as const },
  typeAllDays: { color: Colors.text.muted, fontSize: 11, marginTop: 4, fontStyle: 'italic' as const },
  typeActions: { alignItems: 'center', justifyContent: 'space-between', marginLeft: 12 },
  switchRow: { alignItems: 'center', gap: 4 },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(239,68,68,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  detailName: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const, flex: 1 },
  detailValues: { color: Colors.text.muted, fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  inputLabel: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text.primary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputRow: { flexDirection: 'row', gap: 12 },
  scanResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  scanResultText: { fontSize: 13, fontWeight: '600' as const, flex: 1, lineHeight: 19 },
  scanHint: { color: Colors.text.muted, fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 17 },
  // Camera scanner styles
  scanModalContainer: { flex: 1, backgroundColor: Colors.background.dark },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flex: 1,
    padding: 20,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    marginBottom: 40,
  },
  cameraBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraHeaderTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  scanFrameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderRadius: 20,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: Colors.primary.orange,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 16 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 16 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 16 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 16 },
  scanLineContainer: { position: 'absolute', opacity: 0.6 },
  scannedIndicator: { padding: 20 },
  scanInstructions: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '500' as const,
    marginTop: 30,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cameraBottomInfo: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  manualEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  manualEntryText: {
    color: Colors.primary.orange,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.background.dark,
  },
  permissionText: {
    color: Colors.text.primary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Scan result overlay
  scanResultOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 24,
  },
  scanResultCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 24,
  },
  scanResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  scanResultTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    flex: 1,
  },
  scanResultClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanResultMessage: {
    color: Colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  scanResultActions: {
    flexDirection: 'row',
    gap: 8,
  },
  // Manual entry modal
  manualOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  manualCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 20,
  },
  manualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manualTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  manualCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualSubtitle: {
    color: Colors.text.muted,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  manualInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: Colors.text.primary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  manualSubmitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  manualSubmitGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  manualSubmitText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  formDaysSection: {
    marginTop: 12,
  },
  formDaysLabel: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  formDaysRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  formDayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.background.card,
  },
  formDayChipActive: {
    borderColor: Colors.primary.orange,
    backgroundColor: Colors.primary.orange + '20',
  },
  formDayChipText: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  formDayChipTextActive: {
    color: Colors.primary.orange,
  },
  formDaysSelected: {
    color: Colors.text.muted,
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic' as const,
  },
});
