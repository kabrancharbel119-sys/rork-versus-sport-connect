import React from 'react';
import { StyleSheet, View, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'gradient';
  accessibilityRole?: 'button' | 'link' | 'none';
  accessibilityLabel?: string;
}

export function Card({ children, style, onPress, variant = 'default', accessibilityRole, accessibilityLabel }: CardProps) {
  const content = variant === 'gradient' ? (
    <LinearGradient
      colors={[Colors.gradient.cardStart, Colors.gradient.cardEnd]}
      style={[styles.card, styles.gradient, style]}
    >
      {children}
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.card,
        variant === 'elevated' && styles.elevated,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole={accessibilityRole || 'button'} accessibilityLabel={accessibilityLabel}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  elevated: {
    backgroundColor: Colors.background.elevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  gradient: {
    borderWidth: 0,
  },
});