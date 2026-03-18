import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import * as Haptics from 'expo-haptics';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'orange';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  testID,
}: ButtonProps) {
  const handlePress = () => {
    if (!disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 16 };
      case 'large':
        return { paddingVertical: 18, paddingHorizontal: 32 };
      default:
        return { paddingVertical: 14, paddingHorizontal: 24 };
    }
  };

  const getTextSize = (): TextStyle => {
    switch (size) {
      case 'small':
        return { fontSize: 14 };
      case 'large':
        return { fontSize: 18 };
      default:
        return { fontSize: 16 };
    }
  };

  const isGradient = variant === 'primary' || variant === 'orange';
  const gradientColors: [string, string] = variant === 'orange' 
    ? [Colors.gradient.orangeStart, Colors.gradient.orangeEnd]
    : [Colors.gradient.blueStart, Colors.gradient.blueEnd];

  if (isGradient) {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={[styles.buttonWrapper, style]}
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
      >
        <LinearGradient
          colors={disabled ? ['#4A5568', '#2D3748'] : gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, getSizeStyles()]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              {icon}
              <Text style={[styles.gradientText, getTextSize(), textStyle]}>{title}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      testID={testID}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        getSizeStyles(),
        variant === 'secondary' && styles.secondary,
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary.blue : '#FFFFFF'} 
          size="small" 
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              getTextSize(),
              (variant === 'outline' || variant === 'ghost') && styles.outlineText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  secondary: {
    backgroundColor: Colors.background.cardLight,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary.blue,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  gradientText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  outlineText: {
    color: Colors.primary.blue,
  },
});