import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface NetworkErrorProps {
  onRetry?: () => void;
  message?: string;
  isRetrying?: boolean;
}

export function NetworkError({ onRetry, message, isRetrying = false }: NetworkErrorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <WifiOff size={36} color={Colors.status.warning} />
      </View>
      <Text style={styles.title}>Problème de connexion</Text>
      <Text style={styles.message}>
        {message || 'Impossible de charger les données. Vérifiez votre connexion internet et réessayez.'}
      </Text>
      {onRetry && (
        <TouchableOpacity 
          style={[styles.retryButton, isRetrying && styles.retryButtonDisabled]} 
          onPress={onRetry} 
          activeOpacity={0.8}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <RefreshCw size={18} color="#FFFFFF" />
              <Text style={styles.retryText}>Réessayer</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 280,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: 4,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary.orange,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 16,
  },
  retryButtonDisabled: {
    opacity: 0.6,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
