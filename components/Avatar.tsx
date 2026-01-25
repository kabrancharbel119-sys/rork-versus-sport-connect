import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/colors';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  style?: ViewStyle;
  showBadge?: boolean;
  badgeColor?: string;
  testID?: string;
}

export function Avatar({ uri, name, size = 'medium', style, showBadge, badgeColor, testID }: AvatarProps) {
  const getSize = () => {
    switch (size) {
      case 'small':
        return 32;
      case 'large':
        return 64;
      case 'xlarge':
        return 100;
      default:
        return 48;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 12;
      case 'large':
        return 24;
      case 'xlarge':
        return 36;
      default:
        return 18;
    }
  };

  const dimension = getSize();
  const initials = name
    ? name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <View style={[styles.container, { width: dimension, height: dimension }, style]} testID={testID}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            { width: dimension, height: dimension, borderRadius: dimension / 2 },
          ]}
        >
          <Text style={[styles.initials, { fontSize: getFontSize() }]}>{initials}</Text>
        </View>
      )}
      {showBadge && (
        <View
          style={[
            styles.badge,
            { backgroundColor: badgeColor || Colors.status.success },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    backgroundColor: Colors.background.card,
  },
  placeholder: {
    backgroundColor: Colors.primary.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.text.primary,
    fontWeight: '600' as const,
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.background.dark,
  },
});