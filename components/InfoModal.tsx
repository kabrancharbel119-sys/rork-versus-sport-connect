import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { CheckCircle, XCircle, X } from 'lucide-react-native';

interface InfoModalProps {
  visible: boolean;
  title: string;
  message?: string;
  variant?: 'success' | 'error';
  buttonText?: string;
  onClose: () => void;
  onAction?: () => void;
  actionText?: string;
}

export function InfoModal({
  visible,
  title,
  message,
  variant = 'success',
  buttonText = 'OK',
  onClose,
  onAction,
  actionText,
}: InfoModalProps) {
  const color = variant === 'success' ? Colors.status.success : Colors.status.error;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: `${color}20` }]}>
              {variant === 'success' ? <CheckCircle size={24} color={color} /> : <XCircle size={24} color={color} />}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            {onAction && actionText ? (
              <>
                <Button title={buttonText} onPress={onClose} variant="secondary" size="medium" style={{ flex: 1 }} />
                <Button title={actionText} onPress={onAction} variant={variant === 'success' ? 'primary' : 'orange'} size="medium" style={{ flex: 1 }} />
              </>
            ) : (
              <Button title={buttonText} onPress={onClose} variant="primary" size="medium" style={{ flex: 1 }} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    color: Colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
