import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useOffline } from '@/contexts/OfflineContext';
import { Colors } from '@/constants/colors';

export function OfflineBanner() {
  const { isOnline } = useOffline();
  if (isOnline) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLabel="Pas de connexion internet">
      <WifiOff size={18} color="#FFF" />
      <Text style={styles.text}>Pas de connexion</Text>
      <Text style={styles.sub}>Certaines données peuvent être obsolètes.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.status.warning,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  sub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
  },
});
