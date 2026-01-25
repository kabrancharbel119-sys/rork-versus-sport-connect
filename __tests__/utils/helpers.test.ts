describe('Helper Functions', () => {
  describe('Distance Calculation', () => {
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + 
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    it('calculates distance between same point as 0', () => {
      const distance = calculateDistance(5.36, -4.01, 5.36, -4.01);
      expect(distance).toBe(0);
    });

    it('calculates distance between Abidjan and Yamoussoukro', () => {
      const distance = calculateDistance(5.36, -4.01, 6.82, -5.27);
      expect(distance).toBeGreaterThan(200);
      expect(distance).toBeLessThan(300);
    });

    it('handles negative coordinates', () => {
      const distance = calculateDistance(-5.36, -4.01, 5.36, 4.01);
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('Score Formatting', () => {
    const formatScore = (home: number, away: number): string => {
      return `${home} - ${away}`;
    };

    it('formats scores correctly', () => {
      expect(formatScore(2, 1)).toBe('2 - 1');
      expect(formatScore(0, 0)).toBe('0 - 0');
      expect(formatScore(10, 5)).toBe('10 - 5');
    });
  });

  describe('Name Initials', () => {
    const getInitials = (name: string): string => {
      if (!name) return '?';
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    it('extracts initials from full name', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Jean Pierre')).toBe('JP');
    });

    it('handles single name', () => {
      expect(getInitials('John')).toBe('J');
    });

    it('handles empty string', () => {
      expect(getInitials('')).toBe('?');
    });

    it('handles three-part names', () => {
      expect(getInitials('Jean Pierre Dupont')).toBe('JP');
    });

    it('handles lowercase names', () => {
      expect(getInitials('john doe')).toBe('JD');
    });
  });

  describe('Time Formatting', () => {
    const formatMatchTime = (date: Date): string => {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatMatchDate = (date: Date): string => {
      return date.toLocaleDateString('fr-FR', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
      });
    };

    it('formats time correctly', () => {
      const date = new Date('2024-03-15T14:30:00');
      const formatted = formatMatchTime(date);
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });

    it('formats date correctly', () => {
      const date = new Date('2024-03-15T14:30:00');
      const formatted = formatMatchDate(date);
      expect(formatted).toContain('15');
    });
  });

  describe('Skill Level Mapping', () => {
    const skillLevelLabels: Record<string, string> = {
      beginner: 'Débutant',
      intermediate: 'Intermédiaire',
      advanced: 'Avancé',
      expert: 'Expert',
    };

    const getSkillLabel = (level: string): string => {
      return skillLevelLabels[level] || level;
    };

    it('maps skill levels to French labels', () => {
      expect(getSkillLabel('beginner')).toBe('Débutant');
      expect(getSkillLabel('intermediate')).toBe('Intermédiaire');
      expect(getSkillLabel('advanced')).toBe('Avancé');
      expect(getSkillLabel('expert')).toBe('Expert');
    });

    it('returns original value for unknown level', () => {
      expect(getSkillLabel('unknown')).toBe('unknown');
    });
  });

  describe('Sport Emoji Mapping', () => {
    const sportEmojis: Record<string, string> = {
      football: '⚽',
      basketball: '🏀',
      volleyball: '🏐',
      tennis: '🎾',
      running: '🏃',
      swimming: '🏊',
      boxing: '🥊',
      cycling: '🚴',
    };

    const getSportEmoji = (sport: string): string => {
      return sportEmojis[sport] || '🏅';
    };

    it('returns correct emoji for sports', () => {
      expect(getSportEmoji('football')).toBe('⚽');
      expect(getSportEmoji('basketball')).toBe('🏀');
      expect(getSportEmoji('tennis')).toBe('🎾');
    });

    it('returns default emoji for unknown sport', () => {
      expect(getSportEmoji('unknown')).toBe('🏅');
    });
  });

  describe('Match Status', () => {
    const getStatusColor = (status: string): string => {
      const colors: Record<string, string> = {
        open: '#22C55E',
        confirmed: '#3B82F6',
        in_progress: '#F59E0B',
        completed: '#6B7280',
        cancelled: '#EF4444',
      };
      return colors[status] || '#6B7280';
    };

    const getStatusLabel = (status: string): string => {
      const labels: Record<string, string> = {
        open: 'Ouvert',
        confirmed: 'Confirmé',
        in_progress: 'En cours',
        completed: 'Terminé',
        cancelled: 'Annulé',
      };
      return labels[status] || status;
    };

    it('returns correct colors for status', () => {
      expect(getStatusColor('open')).toBe('#22C55E');
      expect(getStatusColor('completed')).toBe('#6B7280');
      expect(getStatusColor('cancelled')).toBe('#EF4444');
    });

    it('returns correct labels for status', () => {
      expect(getStatusLabel('open')).toBe('Ouvert');
      expect(getStatusLabel('completed')).toBe('Terminé');
      expect(getStatusLabel('in_progress')).toBe('En cours');
    });

    it('handles unknown status gracefully', () => {
      expect(getStatusColor('unknown')).toBe('#6B7280');
      expect(getStatusLabel('unknown')).toBe('unknown');
    });
  });

  describe('Array Utils', () => {
    const shuffleArray = <T>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const uniqueById = <T extends { id: string }>(array: T[]): T[] => {
      const seen = new Set<string>();
      return array.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    };

    it('shuffles array without losing elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);
      expect(shuffled.length).toBe(original.length);
      expect(shuffled.sort()).toEqual(original.sort());
    });

    it('removes duplicate objects by id', () => {
      const items = [
        { id: '1', name: 'First' },
        { id: '2', name: 'Second' },
        { id: '1', name: 'Duplicate' },
      ];
      const unique = uniqueById(items);
      expect(unique.length).toBe(2);
      expect(unique[0].name).toBe('First');
    });

    it('handles empty array', () => {
      expect(shuffleArray([])).toEqual([]);
      expect(uniqueById([])).toEqual([]);
    });
  });
});
