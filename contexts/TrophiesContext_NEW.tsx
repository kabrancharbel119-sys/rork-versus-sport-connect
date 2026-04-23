import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { trophiesApi, type UserTrophy, type TrophyDefinition } from '@/lib/api/trophies';

export type TrophyRarity = 'common' | 'rare' | 'epic' | 'legendary';

// Keep trophy definitions local (they're static reference data)
export const ALL_TROPHIES: TrophyDefinition[] = [
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
  const [lastUnlocked, setLastUnlocked] = useState<TrophyDefinition[]>([]);

  // Load user trophies from Supabase
  const loadUserTrophies = useCallback(async (userId: string) => {
    try {
      const trophies = await trophiesApi.getUserTrophies(userId);
      setUserTrophies(prev => ({ ...prev, [userId]: trophies }));
      return trophies;
    } catch (e) {
      console.error('[Trophies] Failed to load:', e);
      return [];
    }
  }, []);

  const checkAndUnlockTrophies = useCallback(async (userId: string, stats: { 
    matchesPlayed: number; 
    wins: number; 
    goalsScored: number; 
    assists: number; 
    mvpAwards: number; 
    tournamentWins: number; 
    followers: number; 
    isVerified: boolean; 
    isPremium: boolean; 
    isCaptain: boolean; 
    fairPlayScore: number; 
    hasTeam?: boolean; 
    profileComplete?: boolean;
  }) => {
    try {
      const updatedTrophies = await trophiesApi.checkAndUnlockTrophies(userId, stats);
      
      // Reload user's trophies
      await loadUserTrophies(userId);

      // Find newly unlocked trophies
      const newlyUnlocked = updatedTrophies.filter(t => t.progress >= 100 && t.unlockedAt);
      if (newlyUnlocked.length > 0) {
        const unlockedDefinitions = newlyUnlocked
          .map(ut => ALL_TROPHIES.find(t => t.id === ut.trophyId))
          .filter((t): t is TrophyDefinition => !!t);
        
        setLastUnlocked(unlockedDefinitions);

        // Show alert
        if (unlockedDefinitions.length === 1) {
          const trophy = unlockedDefinitions[0];
          Alert.alert('🏆 Trophée débloqué !', `${trophy.icon} ${trophy.name}\n\n${trophy.description}\n\n+${trophy.xpReward} XP`, [{ text: 'Super !' }]);
        } else if (unlockedDefinitions.length > 1) {
          const totalXP = unlockedDefinitions.reduce((sum, t) => sum + t.xpReward, 0);
          Alert.alert('🏆 Trophées débloqués !', `Vous avez débloqué ${unlockedDefinitions.length} trophées !\n\n${unlockedDefinitions.map(t => `${t.icon} ${t.name}`).join('\n')}\n\n+${totalXP} XP au total`, [{ text: 'Super !' }]);
        }

        return unlockedDefinitions;
      }
      return [];
    } catch (e) {
      console.error('[Trophies] Failed to check/unlock:', e);
      return [];
    }
  }, [loadUserTrophies]);

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

  const getNextTrophies = useCallback(async (userId: string, limit = 3) => {
    try {
      return await trophiesApi.getInProgressTrophies(userId, limit);
    } catch (e) {
      // Fallback to local data
      const trophies = userTrophies[userId] || [];
      const inProgress = trophies
        .filter(t => t.progress > 0 && t.progress < 100)
        .sort((a, b) => b.progress - a.progress)
        .slice(0, limit);
      return inProgress.map(ut => ({
        ...ut,
        trophy: ALL_TROPHIES.find(t => t.id === ut.trophyId),
      })).filter(t => t.trophy);
    }
  }, [userTrophies]);

  return {
    userTrophies,
    allTrophies: ALL_TROPHIES,
    isLoading: false,
    lastUnlocked,
    checkAndUnlockTrophies,
    getUserTrophies,
    getUnlockedCount,
    getTotalXP,
    getNextTrophies,
    loadUserTrophies,
  };
});
