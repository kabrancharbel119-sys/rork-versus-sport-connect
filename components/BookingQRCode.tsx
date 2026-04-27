import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { X, Clock, MapPin, Calendar } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { Booking } from '@/types';

interface BookingQRCodeProps {
  booking: Booking;
  venueName: string;
  visible: boolean;
  onClose: () => void;
}

export function BookingQRCode({ booking, venueName, visible, onClose }: BookingQRCodeProps) {
  if (!booking.checkInToken || booking.checkInToken === 'undefined') return null;

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  // Format time — handles both "09:00" and ISO "2026-05-02T09:00:00+00:00"
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const t = timeStr.includes('T') ? timeStr.split('T')[1] : timeStr;
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const min = parseInt(m, 10);
    return min > 0 ? `${hour}h${String(min).padStart(2, '0')}` : `${hour}h`;
  };

  // QR Code data format: booking_id|token
  const qrData = `${booking.id}|${booking.checkInToken}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>QR Code de validation</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Info Réservation */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <MapPin size={16} color={Colors.primary.orange} />
              <Text style={styles.venueName}>{venueName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Calendar size={16} color={Colors.text.secondary} />
              <Text style={styles.infoText}>{formatDate(booking.date)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Clock size={16} color={Colors.text.secondary} />
              <Text style={styles.infoText}>
                {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
              </Text>
            </View>
          </View>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <View style={styles.qrBackground}>
              <QRCode
                value={qrData}
                size={200}
                color={Colors.text.primary}
                backgroundColor={Colors.background.card}
                logo={require('@/assets/images/icon.png')}
                logoSize={40}
                logoBackgroundColor={Colors.background.card}
              />
            </View>
            <Text style={styles.qrInstructions}>
              Présentez ce QR code au gestionnaire du terrain pour validation
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Réservation #{booking.id.slice(0, 8).toUpperCase()}
            </Text>
            <Text style={styles.statusText}>
              Statut: {booking.status === 'confirmed' ? 'Confirmée' : booking.status}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
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
  infoSection: {
    backgroundColor: Colors.background.cardLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  venueName: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  infoText: {
    color: Colors.text.secondary,
    fontSize: 14,
    flex: 1,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrBackground: {
    backgroundColor: Colors.background.cardLight,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  qrInstructions: {
    color: Colors.text.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    paddingTop: 16,
  },
  footerText: {
    color: Colors.text.muted,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  statusText: {
    color: Colors.status.success,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
});
