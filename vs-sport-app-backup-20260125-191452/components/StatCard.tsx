import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  variant?: 'default' | 'blue' | 'orange';
}

export function StatCard({ label, value, icon, variant = 'default' }: StatCardProps) {
  const getGradientColors = (): [string, string] => {
    switch (variant) {
      case 'blue':
        return ['rgba(21, 101, 192, 0.3)', 'rgba(13, 71, 161, 0.3)'];
      case 'orange':
        return ['rgba(255, 107, 0, 0.3)', 'rgba(230, 81, 0, 0.3)'];
      default:
        return [Colors.gradient.cardStart, Colors.gradient.cardEnd];
    }
  };

  return (
    <LinearGradient
      colors={getGradientColors()}
      style={styles.container}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  iconContainer: {
    marginBottom: 8,
  },
  value: {
    color: Colors.text.primary,
    fontSize: 24,
    fontWeight: '700' as const,
  },
  label: {
    color: Colors.text.secondary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});