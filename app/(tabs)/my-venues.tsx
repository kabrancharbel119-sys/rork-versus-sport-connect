import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

export default function MyVenuesTabScreen() {
  const router = useRouter();
  const { isVenueManager } = useAuth();

  useEffect(() => {
    if (isVenueManager) {
      router.replace('/venue-manager' as any);
    }
  }, [isVenueManager]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary.orange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
