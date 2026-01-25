import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'card' | 'primary' | 'orange';
}

export function GradientBackground({ children, style, variant = 'default' }: GradientBackgroundProps) {
  const getColors = (): [string, string, ...string[]] => {
    switch (variant) {
      case 'card':
        return [Colors.gradient.cardStart, Colors.gradient.cardEnd];
      case 'primary':
        return [Colors.gradient.blueStart, Colors.gradient.blueEnd];
      case 'orange':
        return [Colors.gradient.orangeStart, Colors.gradient.orangeEnd];
      default:
        return [Colors.background.dark, '#0D1420'];
    }
  };

  return (
    <LinearGradient colors={getColors()} style={[styles.container, style]}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});