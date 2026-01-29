import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  textContentType?: 'none' | 'telephoneNumber' | 'emailAddress' | 'password' | 'newPassword' | 'name' | 'username';
  autoComplete?: 'tel' | 'email' | 'password' | 'password-new' | 'name' | 'username' | 'off';
  error?: string;
  style?: ViewStyle;
  multiline?: boolean;
  numberOfLines?: number;
  icon?: React.ReactNode;
  editable?: boolean;
  maxLength?: number;
  testID?: string;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  textContentType,
  autoComplete,
  error,
  style,
  multiline = false,
  numberOfLines = 1,
  icon,
  editable = true,
  maxLength,
  testID,
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focused,
          error && styles.errorBorder,
          !editable && styles.disabled,
        ]}
      >
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <TextInput
          testID={testID}
          style={[
            styles.input,
            multiline && styles.multiline,
            icon ? styles.inputWithIcon : undefined,
          ]}
          placeholder={placeholder}
          placeholderTextColor={Colors.text.muted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          textContentType={textContentType}
          autoComplete={autoComplete}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          maxLength={maxLength}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
          >
            {showPassword ? (
              <EyeOff size={20} color={Colors.text.muted} />
            ) : (
              <Eye size={20} color={Colors.text.muted} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  focused: {
    borderColor: Colors.primary.blue,
  },
  errorBorder: {
    borderColor: Colors.status.error,
  },
  disabled: {
    opacity: 0.6,
  },
  iconContainer: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  inputWithIcon: {
    paddingLeft: 12,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  eyeButton: {
    padding: 14,
  },
  error: {
    color: Colors.status.error,
    fontSize: 12,
    marginTop: 4,
  },
});