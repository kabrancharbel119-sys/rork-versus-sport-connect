import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Skeleton width={48} height={48} borderRadius={24} />
        <View style={styles.cardHeaderText}>
          <Skeleton width={120} height={16} />
          <Skeleton width={80} height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <Skeleton height={14} style={{ marginTop: 12 }} />
      <Skeleton width="70%" height={14} style={{ marginTop: 8 }} />
    </View>
  );
}

export function MatchCardSkeleton() {
  return (
    <View style={styles.matchCard}>
      <View style={styles.matchHeader}>
        <Skeleton width={60} height={20} borderRadius={4} />
        <Skeleton width={80} height={14} />
      </View>
      <View style={styles.matchTeams}>
        <View style={styles.team}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <Skeleton width={70} height={14} style={{ marginTop: 8 }} />
        </View>
        <Skeleton width={30} height={20} />
        <View style={styles.team}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <Skeleton width={70} height={14} style={{ marginTop: 8 }} />
        </View>
      </View>
      <Skeleton height={12} style={{ marginTop: 12 }} />
    </View>
  );
}

export function TeamCardSkeleton() {
  return (
    <View style={styles.teamCard}>
      <Skeleton width={56} height={56} borderRadius={28} />
      <View style={styles.teamInfo}>
        <Skeleton width={100} height={16} />
        <Skeleton width={60} height={12} style={{ marginTop: 6 }} />
        <View style={styles.teamStats}>
          <Skeleton width={40} height={10} />
          <Skeleton width={40} height={10} />
        </View>
      </View>
    </View>
  );
}

export function ChatItemSkeleton() {
  return (
    <View style={styles.chatItem}>
      <Skeleton width={52} height={52} borderRadius={26} />
      <View style={styles.chatContent}>
        <Skeleton width={120} height={16} />
        <Skeleton width="80%" height={14} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={40} height={12} />
    </View>
  );
}

export function ProfileSkeleton() {
  return (
    <View style={styles.profile}>
      <Skeleton width={100} height={100} borderRadius={50} />
      <Skeleton width={150} height={20} style={{ marginTop: 16 }} />
      <Skeleton width={100} height={14} style={{ marginTop: 8 }} />
      <View style={styles.profileStats}>
        <View style={styles.profileStat}>
          <Skeleton width={40} height={24} />
          <Skeleton width={50} height={12} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.profileStat}>
          <Skeleton width={40} height={24} />
          <Skeleton width={50} height={12} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.profileStat}>
          <Skeleton width={40} height={24} />
          <Skeleton width={50} height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.background.elevated,
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  matchCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchTeams: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 16,
  },
  team: {
    alignItems: 'center',
  },
  teamCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamInfo: {
    marginLeft: 12,
    flex: 1,
  },
  teamStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.elevated,
  },
  chatContent: {
    flex: 1,
    marginLeft: 12,
  },
  profile: {
    alignItems: 'center',
    padding: 24,
  },
  profileStats: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 32,
  },
  profileStat: {
    alignItems: 'center',
  },
});
