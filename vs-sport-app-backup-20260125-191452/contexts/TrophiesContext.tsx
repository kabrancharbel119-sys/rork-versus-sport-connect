import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';

const USER_TROPHIES_KEY = 'vs_user_trophies';

export type TrophyRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Trophy {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: TrophyRarity;
  category: 'matches' | 'wins' | 'goals' | 'assists' | 'mvp' | 'tournaments' | 'social' | 'special';
  requirement: number;
  xpReward: number;
}

export interface UserTrophy {
  oderId?: string;
  userId?: string;
  trophyId: string;
  unlockedAt: Date;
  progress: number;
}

export const ALL_TROPHIES: Trophy[] = [
  { id: 'first-match', name: 'Premier Pas', description: 'Jouer votre premier match', icon: '⚽', rarity: 'common', category: 'matches', requirement: 1, xpReward: 50 },
  { id: 'matches-10', name: 'Régulier', description: 'Jouer 10 matchs', icon: '🏃', rarity: 'common', category: 'matches', requirement: 10, xpReward: 100 },
  { id: 'matches-50', name: 'Vétéran', description: 'Jouer 50 matchs', icon: '🎖️', rarity: 'rare', category: 'matches', requirement: 50, xpReward: 300 },
  { id: 'matches-100', name: 'Légende du Terrain', description: 'Jouer 100 matchs', icon: '🏆', rarity: 'epic', category: 'matches', requirement: 100, xpReward: 500 },
  { id: 'matches-500', name: 'Immortel', description: 'Jouer 500 matchs', icon: '👑', rarity: 'legendary', category: 'matches', requirement: 500, xpReward: 1500 },
  { id: 'first-win', name: 'Première Victoire', description: 'Gagner votre premier match', icon: '✌️', rarity: 'common', category: 'wins', requirement: 1, xpReward: 75 },
  { id: 'wins-10', name: 'Gagnant', description: 'Gagner 10 matchs', icon: '🥇', rarity: 'common', category: 'wins', requirement: 10, xpReward: 150 },
  { id: 'wins-25', name: 'Champion', description: 'Gagner 25 matchs', icon: '🏅', rarity: 'rare', category: 'wins', requirement: 25, xpReward: 350 },
  { id: 'wins-50', name: 'Dominateur', description: 'Gagner 50 matchs', icon: '💪', rarity: 'epic', category: 'wins', requirement: 50, xpReward: 600 },
  { id: 'wins-100', name: 'Invincible', description: 'Gagner 100 matchs', icon: '🔥', rarity: 'legendary', category: 'wins', requirement: 100, xpReward: 2000 },
  { id: 'first-goal', name: 'Premier But', description: 'Marquer votre premier but', icon: '🥅', rarity: 'common', category: 'goals', requirement: 1, xpReward: 50 },
  { id: 'goals-10', name: 'Buteur', description: 'Marquer 10 buts', icon: '⚡', rarity: 'common', category: 'goals', requirement: 10, xpReward: 120 },
  { id: 'goals-50', name: 'Machine à Buts', description: 'Marquer 50 buts', icon: '💥', rarity: 'rare', category: 'goals', requirement: 50, xpReward: 400 },
  { id: 'goals-100', name: 'Légende Offensive', description: 'Marquer 100 buts', icon: '🎯', rarity: 'epic', category: 'goals', requirement: 100, xpReward: 800 },
  { id: 'first-assist', name: 'Passeur Décisif', description: 'Faire votre première passe décisive', icon: '🤝', rarity: 'common', category: 'assists', requirement: 1, xpReward: 50 },
  { id: 'assists-25', name: 'Créateur', description: 'Faire 25 passes décisives', icon: '🎨', rarity: 'rare', category: 'assists', requirement: 25, xpReward: 350 },
  { id: 'assists-50', name: 'Maestro', description: 'Faire 50 passes décisives', icon: '🎼', rarity: 'epic', category: 'assists', requirement: 50, xpReward: 600 },
  { id: 'first-mvp', name: 'MVP', description: 'Être élu MVP d\'un match', icon: '⭐', rarity: 'rare', category: 'mvp', requirement: 1, xpReward: 200 },
  { id: 'mvp-5', name: 'Star', description: 'Être MVP 5 fois', icon: '🌟', rarity: 'epic', category: 'mvp', requirement: 5, xpReward: 500 },
  { id: 'mvp-10', name: 'Superstar', description: 'Être MVP 10 fois', icon: '💫', rarity: 'legendary', category: 'mvp', requirement: 10, xpReward: 1000 },
  { id: 'first-tournament', name: 'Compétiteur', description: 'Participer à un tournoi', icon: '🏟️', rarity: 'common', category: 'tournaments', requirement: 1, xpReward: 100 },
  { id: 'tournament-win', name: 'Champion de Tournoi', description: 'Gagner un tournoi', icon: '🏆', rarity: 'epic', category: 'tournaments', requirement: 1, xpReward: 750 },
  { id: 'tournament-wins-3', name: 'Triple Champion', description: 'Gagner 3 tournois', icon: '👑', rarity: 'legendary', category: 'tournaments', requirement: 3, xpReward: 2000 },
  { id: 'followers-10', name: 'Influenceur', description: 'Avoir 10 followers', icon: '📱', rarity: 'common', category: 'social', requirement: 10, xpReward: 100 },
  { id: 'followers-50', name: 'Populaire', description: 'Avoir 50 followers', icon: '🔔', rarity: 'rare', category: 'social', requirement: 50, xpReward: 300 },
  { id: 'followers-100', name: 'Célébrité', description: 'Avoir 100 followers', icon: '📢', rarity: 'epic', category: 'social', requirement: 100, xpReward: 600 },
  { id: 'verified', name: 'Vérifié', description: 'Obtenir le badge vérifié', icon: '✅', rarity: 'rare', category: 'special', requirement: 1, xpReward: 250 },
  { id: 'premium', name: 'Premium', description: 'Devenir membre premium', icon: '💎', rarity: 'epic', category: 'special', requirement: 1, xpReward: 500 },
  { id: 'team-captain', name: 'Leader', description: 'Devenir capitaine d\'une équipe', icon: '🎖️', rarity: 'rare', category: 'special', requirement: 1, xpReward: 300 },
  { id: 'fair-play', name: 'Fair Play', description: 'Avoir un score Fair Play de 4.5+', icon: '🤗', rarity: 'rare', category: 'special', requirement: 1, xpReward: 250 },
  { id: 'profile-complete', name: 'Profil Complet', description: 'Compléter votre profil à 100%', icon: '📝', rarity: 'common', category: 'special', requirement: 1, xpReward: 75 },
  { id: 'first-team', name: 'Esprit d\'Équipe', description: 'Rejoindre votre première équipe', icon: '👥', rarity: 'common', category: 'social', requirement: 1, xpReward: 100 },
];

export const RARITY_COLORS: Record<TrophyRarity, string> = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
};

export const [TrophiesProvider, useTrophies] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [userTrophies, setUserTrophies] = useState<Record<string, UserTrophy[]>>({});
  const [lastUnlocked, setLastUnlocked] = useState<Trophy[]>([]);

  const trophiesQuery = useQuery({
    queryKey: ['trophies'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(USER_TROPHIES_KEY);
      return stored ? JSON.parse(stored) : {};
    },
  });

  useEffect(() => { if (trophiesQuery.data) setUserTrophies(trophiesQuery.data); }, [trophiesQuery.data]);

  const saveTrophies = useCallback(async (updated: Record<string, UserTrophy[]>) => {
    await AsyncStorage.setItem(USER_TROPHIES_KEY, JSON.stringify(updated));
    setUserTrophies(updated);
    queryClient.invalidateQueries({ queryKey: ['trophies'] });
  }, [queryClient]);

  const checkAndUnlockTrophies = useCallback(async (userId: string, stats: { matchesPlayed: number; wins: number; goalsScored: number; assists: number; mvpAwards: number; tournamentWins: number; followers: number; isVerified: boolean; isPremium: boolean; isCaptain: boolean; fairPlayScore: number; hasTeam?: boolean; profileComplete?: boolean }) => {
    const currentTrophies = userTrophies[userId] || [];
    const unlockedIds = currentTrophies.filter(t => t.progress >= 100).map(t => t.trophyId);
    const newUnlocks: UserTrophy[] = [];
    const updatedTrophies: UserTrophy[] = [...currentTrophies];
    
    const checkTrophy = (trophy: Trophy, value: number) => {
      if (unlockedIds.includes(trophy.id)) return;
      const progress = Math.min((value / trophy.requirement) * 100, 100);
      const existingIndex = updatedTrophies.findIndex(t => t.trophyId === trophy.id);
      
      if (progress >= 100) {
        if (existingIndex === -1) {
          const newTrophy: UserTrophy = { oderId: userId, userId: userId, trophyId: trophy.id, unlockedAt: new Date(), progress: 100 };
          updatedTrophies.push(newTrophy);
          newUnlocks.push(newTrophy);
        } else if (updatedTrophies[existingIndex].progress < 100) {
          updatedTrophies[existingIndex] = { ...updatedTrophies[existingIndex], progress: 100, unlockedAt: new Date() };
          newUnlocks.push(updatedTrophies[existingIndex]);
        }
      } else if (progress > 0) {
        if (existingIndex === -1) {
          updatedTrophies.push({ oderId: userId, userId: userId, trophyId: trophy.id, unlockedAt: new Date(), progress });
        } else if (updatedTrophies[existingIndex].progress < progress) {
          updatedTrophies[existingIndex] = { ...updatedTrophies[existingIndex], progress };
        }
      }
    };

    ALL_TROPHIES.forEach(trophy => {
      switch (trophy.category) {
        case 'matches': checkTrophy(trophy, stats.matchesPlayed); break;
        case 'wins': checkTrophy(trophy, stats.wins); break;
        case 'goals': checkTrophy(trophy, stats.goalsScored); break;
        case 'assists': checkTrophy(trophy, stats.assists); break;
        case 'mvp': checkTrophy(trophy, stats.mvpAwards); break;
        case 'tournaments': checkTrophy(trophy, stats.tournamentWins); break;
        case 'social':
          if (trophy.id === 'first-team' && stats.hasTeam) checkTrophy(trophy, 1);
          else checkTrophy(trophy, stats.followers);
          break;
        case 'special':
          if (trophy.id === 'verified' && stats.isVerified) checkTrophy(trophy, 1);
          if (trophy.id === 'premium' && stats.isPremium) checkTrophy(trophy, 1);
          if (trophy.id === 'team-captain' && stats.isCaptain) checkTrophy(trophy, 1);
          if (trophy.id === 'fair-play' && stats.fairPlayScore >= 4.5) checkTrophy(trophy, 1);
          if (trophy.id === 'profile-complete' && stats.profileComplete) checkTrophy(trophy, 1);
          break;
      }
    });

    const hasChanges = JSON.stringify(currentTrophies) !== JSON.stringify(updatedTrophies);
    if (hasChanges) {
      await saveTrophies({ ...userTrophies, [userId]: updatedTrophies });
    }

    if (newUnlocks.length > 0) {
      const unlockedTrophies = newUnlocks.map(ut => ALL_TROPHIES.find(t => t.id === ut.trophyId)!).filter(Boolean);
      setLastUnlocked(unlockedTrophies);
      
      if (unlockedTrophies.length === 1) {
        const trophy = unlockedTrophies[0];
        Alert.alert('🏆 Trophée débloqué !', `${trophy.icon} ${trophy.name}\n\n${trophy.description}\n\n+${trophy.xpReward} XP`, [{ text: 'Super !' }]);
      } else if (unlockedTrophies.length > 1) {
        const totalXP = unlockedTrophies.reduce((sum, t) => sum + t.xpReward, 0);
        Alert.alert('🏆 Trophées débloqués !', `Vous avez débloqué ${unlockedTrophies.length} trophées !\n\n${unlockedTrophies.map(t => `${t.icon} ${t.name}`).join('\n')}\n\n+${totalXP} XP au total`, [{ text: 'Super !' }]);
      }
      
      return unlockedTrophies;
    }
    return [];
  }, [userTrophies, saveTrophies]);

  const getUserTrophies = useCallback((userId: string) => {
    const trophies = userTrophies[userId] || [];
    return trophies.map(ut => ({ ...ut, trophy: ALL_TROPHIES.find(t => t.id === ut.trophyId) })).filter(t => t.trophy);
  }, [userTrophies]);

  const getUnlockedCount = useCallback((userId: string) => {
    const trophies = userTrophies[userId] || [];
    return trophies.filter(t => t.progress >= 100).length;
  }, [userTrophies]);

  const getTotalXP = useCallback((userId: string) => {
    const trophies = userTrophies[userId] || [];
    return trophies.filter(t => t.progress >= 100).reduce((sum, ut) => {
      const trophy = ALL_TROPHIES.find(t => t.id === ut.trophyId);
      return sum + (trophy?.xpReward || 0);
    }, 0);
  }, [userTrophies]);

  const getNextTrophies = useCallback((userId: string, limit = 3) => {
    const trophies = userTrophies[userId] || [];
    const unlockedIds = trophies.filter(t => t.progress >= 100).map(t => t.trophyId);
    const inProgress = trophies.filter(t => t.progress > 0 && t.progress < 100).sort((a, b) => b.progress - a.progress);
    
    return inProgress.slice(0, limit).map(ut => ({
      ...ut,
      trophy: ALL_TROPHIES.find(t => t.id === ut.trophyId),
    })).filter(t => t.trophy);
  }, [userTrophies]);

  return {
    userTrophies, allTrophies: ALL_TROPHIES, isLoading: trophiesQuery.isLoading, lastUnlocked,
    checkAndUnlockTrophies, getUserTrophies, getUnlockedCount, getTotalXP, getNextTrophies,
  };
});
