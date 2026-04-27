import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, ScanLine, User, Calendar, Clock, CheckCircle, X, Shield, MapPin, DollarSign, BadgeCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { venuesApi } from '@/lib/api/venues';
import { useAuth } from '@/contexts/AuthContext';
import type { Booking } from '@/types';

interface ScannedUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  completed_bookings_count: number;
  total_bookings_count: number;
  member_since: string;
}

interface ScannedBooking {
  booking: Booking;
  user: ScannedUser;
}

export default function ScanQRScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [validating, setValidating] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedBooking | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [scannedToken, setScannedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // Parse QR data format: booking_id|token
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || !scanning) return;
    
    setScanned(true);
    setScanning(false);
    
    console.log('[ScanQR] Raw QR data:', data);

    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Support both | and : separators for backward compat
      // UUIDs have 5 groups separated by -, so we look for pattern: uuid|uuid or uuid:uuid
      // Split on | first, fallback: last 36 chars = token, first 36 chars = bookingId
      let bookingId: string;
      let token: string;

      if (data.includes('|')) {
        const parts = data.split('|');
        if (parts.length !== 2) throw new Error('Format QR code invalide');
        [bookingId, token] = parts;
      } else if (data.length === 73 && data[36] === ':') {
        // Old format: uuid:uuid (36 + 1 + 36 = 73 chars)
        bookingId = data.slice(0, 36);
        token = data.slice(37);
      } else {
        throw new Error('Format QR code invalide');
      }

      console.log('[ScanQR] Parsed bookingId:', bookingId, 'token:', token);

      if (!uuidRegex.test(bookingId) || !uuidRegex.test(token)) {
        throw new Error('QR code corrompu ou expiré');
      }
      
      // Fetch booking details with user info
      const bookingData = await venuesApi.getBookingByToken(token);
      
      if (bookingData.id !== bookingId) {
        throw new Error('Token ne correspond pas à la réservation');
      }
      
      // Store the token for validation
      setScannedToken(token);

      const rawUser = (bookingData as any).user;
      const scannedUser: ScannedUser = {
        id: rawUser?.id ?? bookingData.userId,
        username: rawUser?.username ?? rawUser?.full_name ?? 'Utilisateur',
        full_name: rawUser?.full_name ?? rawUser?.username ?? 'Utilisateur',
        avatar_url: rawUser?.avatar ?? undefined,
        completed_bookings_count: rawUser?.completed_bookings_count ?? 0,
        total_bookings_count: rawUser?.total_bookings_count ?? 0,
        member_since: rawUser?.created_at ?? rawUser?.member_since ?? new Date().toISOString(),
      };
      
      setScannedData({
        booking: bookingData,
        user: scannedUser,
      });
      
      setShowConfirmation(true);
    } catch (error: any) {
      Alert.alert('Erreur de scan', error.message || 'Impossible de lire ce QR code');
      setTimeout(() => {
        setScanned(false);
        setScanning(true);
      }, 2000);
    }
  };

  const handleValidate = async () => {
    if (!scannedData || !user?.id || !scannedToken) return;
    
    setValidating(true);
    
    try {
      console.log('[ScanQR] Validating:', {
        bookingId: scannedData.booking.id,
        token: scannedToken,
        managerId: user.id,
      });

      await venuesApi.validateCheckIn(
        scannedData.booking.id,
        scannedToken,
        user.id
      );
      
      setValidating(false);
      setShowConfirmation(false);
      setTimeout(() => {
        Alert.alert(
          '✅ Validation réussie',
          'La réservation a été marquée comme complétée.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }, 400);
    } catch (error: any) {
      console.error('[ScanQR] Validation error:', error);
      const msg: string = error.message || '';
      let title = 'Erreur de validation';
      let body = msg;
      if (error.code === 'TOO_EARLY') {
        title = '⏳ Trop tôt';
        body = 'Ce match commence dans plus de 2h. Revenez plus tard pour valider.';
      } else if (error.code === 'TOO_LATE') {
        title = '⌛ Délai dépassé';
        body = 'Délai de validation dépassé (max 2h après la fin du match).';
      } else if (error.code === 'INVALID_TICKET') {
        title = '🚫 Ticket invalide';
        if (msg.includes('completed')) {
          title = 'Réservation déjà validée';
          body = 'Ce QR Code a déjà été scanné et validé.';
        } else if (msg.includes('Token invalide') || msg.includes('ne correspond pas')) {
          body = 'Ce QR Code ne correspond pas à cette réservation.';
        } else if (msg.includes('non confirmée')) {
          body = 'Cette réservation ne peut pas être validée dans son état actuel.';
        }
      }
      setValidating(false);
      setShowConfirmation(false);
      setTimeout(() => Alert.alert(title, body), 400);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setScannedData(null);
    setScanned(false);
    setScanning(true);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    // Handle ISO timestamp: '2026-05-01T09:00:00+00:00'
    const t = timeStr.includes('T') ? timeStr.split('T')[1] : timeStr;
    const hour = parseInt(t.split(':')[0], 10);
    return `${hour}h`;
  };

  const calculateMemberDuration = (memberSince: string) => {
    const start = new Date(memberSince);
    const now = new Date();
    const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 1) return '1 jour';
    return `${days} jour${days > 1 ? 's' : ''}`;
  };

  if (!permission?.granted) {
    return (
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            L'accès à la caméra est nécessaire pour scanner les QR codes.
          </Text>
          <Button
            title="Autoriser la caméra"
            onPress={requestPermission}
            variant="orange"
          />
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Camera */}
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanning && !scanned ? handleBarCodeScanned : undefined}
      >
        {/* Overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.7)']}
          style={styles.overlay}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan QR Code</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Scan Frame */}
          <View style={styles.scanFrameContainer}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              
              {scanning && !scanned && (
                <View style={styles.scanLineContainer}>
                  <ScanLine size={200} color={Colors.primary.orange} strokeWidth={1} />
                </View>
              )}
              
              {scanned && (
                <View style={styles.scannedIndicator}>
                  <ActivityIndicator color={Colors.primary.orange} />
                </View>
              )}
            </View>
            
            <Text style={styles.scanInstructions}>
              Positionnez le QR code dans le cadre
            </Text>
          </View>

          {/* Bottom Info */}
          <View style={styles.bottomInfo}>
            <Shield size={20} color={Colors.text.muted} />
            <Text style={styles.bottomText}>
              Validation sécurisée des réservations
            </Text>
          </View>
        </LinearGradient>
      </CameraView>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmation}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Handle bar */}
            <View style={styles.modalHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <BadgeCheck size={20} color={Colors.primary.orange} />
                <Text style={styles.modalTitle}>Valider la réservation</Text>
              </View>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <X size={20} color={Colors.text.muted} />
              </TouchableOpacity>
            </View>

            {scannedData && (
              <>
                {/* User Card */}
                <View style={styles.userCard}>
                  {/* Avatar */}
                  <View style={styles.userHeader}>
                    {scannedData.user.avatar_url ? (
                      <Image source={{ uri: scannedData.user.avatar_url }} style={styles.userAvatar} />
                    ) : (
                      <LinearGradient
                        colors={[Colors.primary.orange, Colors.primary.orangeDark]}
                        style={styles.userAvatar}
                      >
                        <Text style={styles.userAvatarText}>
                          {(scannedData.user.full_name || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                    )}
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{scannedData.user.full_name}</Text>
                      <Text style={styles.userUsername}>@{scannedData.user.username}</Text>
                    </View>
                    <View style={styles.confirmedBadge}>
                      <CheckCircle size={14} color={Colors.status.success} />
                      <Text style={styles.confirmedText}>Confirmée</Text>
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={styles.cardDivider} />

                  {/* Stats */}
                  <View style={styles.userStats}>
                    <View style={styles.statItem}>
                      <CheckCircle size={14} color={Colors.status.success} />
                      <Text style={styles.statValue}>
                        {scannedData.user.completed_bookings_count}
                        <Text style={styles.statLabel}>/{scannedData.user.total_bookings_count} résa. honorée{scannedData.user.completed_bookings_count > 1 ? 's' : ''}</Text>
                      </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Calendar size={14} color={Colors.text.muted} />
                      <Text style={styles.statValue}>
                        {calculateMemberDuration(scannedData.user.member_since)}
                        <Text style={styles.statLabel}> sur VS</Text>
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Booking Info */}
                <View style={styles.bookingCard}>
                  <View style={styles.bookingRow}>
                    <View style={styles.bookingIconWrap}>
                      <Calendar size={14} color={Colors.primary.orange} />
                    </View>
                    <Text style={styles.bookingText}>{formatDate(scannedData.booking.date)}</Text>
                  </View>
                  <View style={styles.bookingRow}>
                    <View style={styles.bookingIconWrap}>
                      <Clock size={14} color={Colors.primary.orange} />
                    </View>
                    <Text style={styles.bookingText}>
                      {formatTime(scannedData.booking.startTime)} — {formatTime(scannedData.booking.endTime)}
                    </Text>
                  </View>
                  {scannedData.booking.venueId && (
                    <View style={styles.bookingRow}>
                      <View style={styles.bookingIconWrap}>
                        <MapPin size={14} color={Colors.primary.orange} />
                      </View>
                      <Text style={styles.bookingText} numberOfLines={1}>
                        {(scannedData.booking as any).venue?.name ?? 'Terrain'}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.bookingRow, styles.priceRow]}>
                    <View style={styles.bookingIconWrap}>
                      <DollarSign size={14} color={Colors.status.success} />
                    </View>
                    <Text style={styles.priceText}>
                      {scannedData.booking.totalPrice.toLocaleString()} FCFA
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.validateButton, validating && { opacity: 0.7 }]}
                    onPress={handleValidate}
                    disabled={validating}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[Colors.primary.orange, Colors.primary.orangeDark]}
                      style={styles.validateButtonGradient}
                    >
                      {validating
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <CheckCircle size={20} color="#fff" />
                      }
                      <Text style={styles.validateButtonText}>
                        {validating ? 'Validation en cours...' : 'Confirmer la validation'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancel}
                    disabled={validating}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.dark,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    marginBottom: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
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
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 16,
  },
  scanLineContainer: {
    position: 'absolute',
    opacity: 0.6,
  },
  scannedIndicator: {
    padding: 20,
  },
  scanInstructions: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
    marginTop: 30,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 40,
  },
  bottomText: {
    color: Colors.text.muted,
    fontSize: 13,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 20,
  },
  permissionText: {
    color: Colors.text.primary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.background.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.light,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCard: {
    backgroundColor: Colors.background.cardLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.status.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confirmedText: {
    color: Colors.status.success,
    fontSize: 11,
    fontWeight: '600',
  },
  userName: {
    color: Colors.text.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  userUsername: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginVertical: 12,
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  statLabel: {
    color: Colors.text.secondary,
    fontSize: 13,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border.light,
  },
  bookingCard: {
    backgroundColor: Colors.background.cardLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bookingIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primary.orange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    paddingTop: 10,
    marginTop: 2,
  },
  bookingText: {
    color: Colors.text.primary,
    fontSize: 14,
    flex: 1,
  },
  priceText: {
    color: Colors.status.success,
    fontSize: 16,
    fontWeight: '700',
  },
  actionButtons: {
    gap: 12,
  },
  validateButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  validateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  validateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: Colors.background.cardLight,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  cancelButtonText: {
    color: Colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
