import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { QrCode } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { Booking } from '@/types';
import { BookingQRCode } from './BookingQRCode';
import { useAuth } from '@/contexts/AuthContext';

interface ShowQRButtonProps {
  booking: Booking;
  venueName: string;
}

export function ShowQRButton({ booking, venueName }: ShowQRButtonProps) {
  const [showQR, setShowQR] = useState(false);
  const { user } = useAuth();

  // Only show for confirmed bookings with a valid token AND only for the booking owner
  if (booking.status !== 'confirmed' || !booking.checkInToken || booking.userId !== user?.id) {
    return null;
  }

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setShowQR(true)}>
        <QrCode size={18} color={Colors.primary.orange} />
        <Text style={styles.text}>Afficher QR Code</Text>
      </TouchableOpacity>

      <BookingQRCode
        booking={booking}
        venueName={venueName}
        visible={showQR}
        onClose={() => setShowQR(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background.cardLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  text: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
