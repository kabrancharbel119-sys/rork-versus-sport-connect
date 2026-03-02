import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Trophy, TrendingUp, TrendingDown, Award, Crown, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { PlayerRanking } from '@/types/ranking';

interface RankingNotificationProps {
  ranking: PlayerRanking;
  previousRanking?: PlayerRanking;
  onClose: () => void;
  visible: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export function RankingNotification({ ranking, previousRanking, onClose, visible }: RankingNotificationProps) {
  const [slideAnim] = useState(new Animated.Value(-300));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible && ranking) {
      // Animation d'entrée
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-fermeture après 5 secondes
      const timer = setTimeout(() => {
        hideNotification();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [visible, ranking]);

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible || !ranking) return null;

  const rankChange = previousRanking ? previousRanking.rank - ranking.rank : 0;
  const eloChange = previousRanking ? ranking.eloRating - previousRanking.eloRating : 0;
  const isNewRank = ranking.rank <= 3 && (!previousRanking || previousRanking.rank > 3);

  const getNotificationType = () => {
    if (isNewRank) return 'podium';
    if (rankChange > 0) return 'rank_up';
    if (rankChange < 0) return 'rank_down';
    if (eloChange > 20) return 'elo_big_gain';
    if (eloChange < -20) return 'elo_big_loss';
    return 'normal';
  };

  const getNotificationContent = () => {
    const type = getNotificationType();
    
    switch (type) {
      case 'podium':
        return {
          icon: ranking.rank === 1 ? Crown : Trophy,
          color: '#FFD700',
          title: '🎉 Nouveau record !',
          message: `Vous êtes maintenant #${ranking.rank} au classement mondial !`,
          bgColor: 'rgba(255, 215, 0, 0.1)',
          borderColor: '#FFD700',
        };
      
      case 'rank_up':
        return {
          icon: TrendingUp,
          color: Colors.status.success,
          title: '🚀 Progression !',
          message: `Vous avez gagné ${rankChange} place${rankChange > 1 ? 's' : ''} au classement !`,
          bgColor: 'rgba(16, 185, 129, 0.1)',
          borderColor: Colors.status.success,
        };
      
      case 'rank_down':
        return {
          icon: TrendingDown,
          color: Colors.status.error,
          title: '📉 Baisse',
          message: `Vous avez perdu ${Math.abs(rankChange)} place${Math.abs(rankChange) > 1 ? 's' : ''} au classement`,
          bgColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: Colors.status.error,
        };
      
      case 'elo_big_gain':
        return {
          icon: Award,
          color: Colors.primary.orange,
          title: '⚡ Performance exceptionnelle !',
          message: `+${eloChange} points ELO !`,
          bgColor: 'rgba(251, 146, 60, 0.1)',
          borderColor: Colors.primary.orange,
        };
      
      case 'elo_big_loss':
        return {
          icon: Trophy,
          color: Colors.status.error,
          title: 'Défaite difficile',
          message: `-${Math.abs(eloChange)} points ELO`,
          bgColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: Colors.status.error,
        };
      
      default:
        return {
          icon: Trophy,
          color: Colors.primary.blue,
          title: 'Classement mis à jour',
          message: `ELO: ${ranking.eloRating} • Rang: #${ranking.rank}`,
          bgColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: Colors.primary.blue,
        };
    }
  };

  const content = getNotificationContent();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
          backgroundColor: content.bgColor,
          borderColor: content.borderColor,
        },
      ]}
    >
      <TouchableOpacity style={styles.closeButton} onPress={hideNotification}>
        <X size={16} color={Colors.text.muted} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: content.color + '20' }]}>
          <content.icon size={20} color={content.color} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.message}>{content.message}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{ranking.eloRating}</Text>
              <Text style={styles.statLabel}>ELO</Text>
              {eloChange !== 0 && (
                <Text style={[styles.statChange, { color: eloChange > 0 ? Colors.status.success : Colors.status.error }]}>
                  {eloChange > 0 ? '+' : ''}{eloChange}
                </Text>
              )}
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Text style={styles.statValue}>#{ranking.rank}</Text>
              <Text style={styles.statLabel}>Rang</Text>
              {rankChange !== 0 && (
                <Text style={[styles.statChange, { color: rankChange > 0 ? Colors.status.success : Colors.status.error }]}>
                  {rankChange > 0 ? '+' : ''}{rankChange}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.actionButton} onPress={() => {/* Navigation vers classements */}}>
        <Text style={styles.actionButtonText}>Voir classement</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.background.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  statChange: {
    fontSize: 10,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border.light,
  },
  actionButton: {
    marginTop: 12,
    backgroundColor: Colors.primary.blue,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
