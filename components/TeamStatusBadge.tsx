import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { CheckCircle, Clock, AlertCircle, XCircle, Ban } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { TournamentTeamStatus } from '@/types';

interface TeamStatusBadgeProps {
  status: TournamentTeamStatus;
  size?: 'small' | 'medium' | 'large';
}

const STATUS_CONFIG: Record<TournamentTeamStatus, {
  label: string;
  color: string;
  icon: React.ReactNode;
  emoji: string;
}> = {
  pending_payment: {
    label: 'En attente paiement',
    color: Colors.status.warning,
    icon: <Clock size={14} color={Colors.status.warning} />,
    emoji: '🟡',
  },
  payment_submitted: {
    label: 'Paiement soumis',
    color: Colors.primary.orange,
    icon: <AlertCircle size={14} color={Colors.primary.orange} />,
    emoji: '🟠',
  },
  confirmed: {
    label: 'Paiement confirmé',
    color: Colors.status.success,
    icon: <CheckCircle size={14} color={Colors.status.success} />,
    emoji: '🟢',
  },
  rejected: {
    label: 'Rejeté',
    color: Colors.status.error,
    icon: <XCircle size={14} color={Colors.status.error} />,
    emoji: '🔴',
  },
  cancelled: {
    label: 'Annulé',
    color: Colors.text.muted,
    icon: <Ban size={14} color={Colors.text.muted} />,
    emoji: '⚫',
  },
};

export function TeamStatusBadge({ status, size = 'medium' }: TeamStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  
  const sizeStyles = {
    small: { paddingHorizontal: 8, paddingVertical: 3 },
    medium: { paddingHorizontal: 10, paddingVertical: 5 },
    large: { paddingHorizontal: 12, paddingVertical: 6 },
  };

  const textSizes = {
    small: 10,
    medium: 11,
    large: 12,
  };

  return (
    <View style={[
      styles.badge,
      { backgroundColor: config.color + '20', borderColor: config.color + '40' },
      sizeStyles[size],
    ]}>
      {config.icon}
      <Text style={[styles.label, { color: config.color, fontSize: textSizes[size] }]}>
        {config.label}
      </Text>
    </View>
  );
}

export function getStatusConfig(status: TournamentTeamStatus) {
  return STATUS_CONFIG[status];
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  label: {
    fontWeight: '700',
  },
});
