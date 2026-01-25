import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LucideIcon, Inbox, Users, Trophy, MessageCircle, Calendar, Search } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

type EmptyStateType = 'default' | 'matches' | 'teams' | 'chat' | 'trophies' | 'search' | 'notifications';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  message?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

const defaultConfigs: Record<EmptyStateType, { icon: LucideIcon; title: string; message: string }> = {
  default: {
    icon: Inbox,
    title: 'Aucun élément',
    message: 'Il n\'y a rien à afficher pour le moment.',
  },
  matches: {
    icon: Calendar,
    title: 'Aucun match',
    message: 'Aucun match disponible pour le moment. Créez-en un ou rejoignez une équipe !',
  },
  teams: {
    icon: Users,
    title: 'Aucune équipe',
    message: 'Vous n\'avez pas encore rejoint d\'équipe. Créez ou rejoignez une équipe !',
  },
  chat: {
    icon: MessageCircle,
    title: 'Aucune conversation',
    message: 'Commencez à discuter avec d\'autres joueurs ou équipes.',
  },
  trophies: {
    icon: Trophy,
    title: 'Aucun trophée',
    message: 'Participez à des matchs pour gagner vos premiers trophées !',
  },
  search: {
    icon: Search,
    title: 'Aucun résultat',
    message: 'Aucun résultat ne correspond à votre recherche. Essayez avec d\'autres termes.',
  },
  notifications: {
    icon: Inbox,
    title: 'Aucune notification',
    message: 'Vous êtes à jour ! Aucune nouvelle notification.',
  },
};

export function EmptyState({ type = 'default', title, message, icon, actionLabel, onAction }: EmptyStateProps) {
  const config = defaultConfigs[type];
  const Icon = icon || config.icon;
  const displayTitle = title || config.title;
  const displayMessage = message || config.message;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon size={40} color={Colors.text.muted} />
      </View>
      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.message}>{displayMessage}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.actionText}>{actionLabel}</Text>
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
    minHeight: 300,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.background.elevated,
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
  },
  actionButton: {
    marginTop: 20,
    backgroundColor: Colors.primary.orange,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
