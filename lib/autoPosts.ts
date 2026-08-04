import { postsApi } from '@/lib/api/posts';
import { logger } from '@/lib/logger';
import type { AutoPostType, Sport } from '@/types';

export async function createAutoPost(
  authorId: string,
  autoType: AutoPostType,
  content: string,
  options?: {
    sportTag?: string;
    teamTag?: string;
    matchTag?: string;
    tournamentTag?: string;
  }
): Promise<void> {
  try {
    await postsApi.createAutoPost({
      authorId,
      content,
      autoType,
      sportTag: options?.sportTag,
      teamTag: options?.teamTag,
      matchTag: options?.matchTag,
      tournamentTag: options?.tournamentTag,
    });
    logger.debug('AutoPost', `Created ${autoType} post for user ${authorId}`);
  } catch (error) {
    logger.error('AutoPost', `Failed to create ${autoType} post:`, error);
  }
}

export const autoPostMessages = {
  matchCreated: (sport: string, format: string) =>
    `Nouveau match de ${sport} (${format}) créé ! Qui relève le défi ? ⚔️`,
  matchWon: (sport: string) =>
    `Victoire en ${sport} ! 🏆 Une belle performance d'équipe.`,
  tournamentWon: (tournamentName: string) =>
    `CHAMPION ! 🏆 J'ai remporté le tournoi ${tournamentName} ! Merci à toute l'équipe.`,
  teamJoined: (teamName: string) =>
    `Je viens de rejoindre l'équipe ${teamName} ! Excité pour cette nouvelle aventure. 💪`,
  teamCreated: (teamName: string, sport: string) =>
    `Nouvelle équipe créée : ${teamName} (${sport}) ! On recrute, rejoignez-nous. 🔥`,
  venueCreated: (venueName: string, city: string) =>
    `Nouveau terrain disponible : ${venueName} à ${city} ! Réservez votre créneau. 📍`,
  tournamentCreated: (tournamentName: string, sport: string) =>
    `Nouveau tournoi lancé : ${tournamentName} (${sport}) ! Inscrivez votre équipe vite. 🏆`,
};
