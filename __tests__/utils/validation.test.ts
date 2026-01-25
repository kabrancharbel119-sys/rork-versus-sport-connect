describe('Validation Utils', () => {
  describe('Email Validation', () => {
    const isValidEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it('validates correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
    });

    it('rejects invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@.com')).toBe(false);
    });
  });

  describe('Phone Validation', () => {
    const isValidPhone = (phone: string): boolean => {
      const cleaned = phone.replace(/\D/g, '');
      return cleaned.length >= 8 && cleaned.length <= 15;
    };

    it('validates correct phone numbers', () => {
      expect(isValidPhone('+225 07 12 34 56 78')).toBe(true);
      expect(isValidPhone('0712345678')).toBe(true);
      expect(isValidPhone('+33612345678')).toBe(true);
    });

    it('rejects invalid phone numbers', () => {
      expect(isValidPhone('')).toBe(false);
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('12345678901234567890')).toBe(false);
    });
  });

  describe('Username Validation', () => {
    const isValidUsername = (username: string): boolean => {
      if (username.length < 3 || username.length > 20) return false;
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      return usernameRegex.test(username);
    };

    it('validates correct usernames', () => {
      expect(isValidUsername('john_doe')).toBe(true);
      expect(isValidUsername('Player123')).toBe(true);
      expect(isValidUsername('user_name_99')).toBe(true);
    });

    it('rejects invalid usernames', () => {
      expect(isValidUsername('')).toBe(false);
      expect(isValidUsername('ab')).toBe(false);
      expect(isValidUsername('user name')).toBe(false);
      expect(isValidUsername('user@name')).toBe(false);
      expect(isValidUsername('a'.repeat(21))).toBe(false);
    });
  });

  describe('Password Validation', () => {
    const isValidPassword = (password: string): boolean => {
      return password.length >= 6;
    };

    it('validates correct passwords', () => {
      expect(isValidPassword('password123')).toBe(true);
      expect(isValidPassword('secure!')).toBe(true);
      expect(isValidPassword('123456')).toBe(true);
    });

    it('rejects invalid passwords', () => {
      expect(isValidPassword('')).toBe(false);
      expect(isValidPassword('12345')).toBe(false);
      expect(isValidPassword('abc')).toBe(false);
    });
  });
});

describe('Data Formatting', () => {
  describe('Date Formatting', () => {
    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    it('formats dates correctly', () => {
      const date = new Date('2024-03-15');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });

  describe('Number Formatting', () => {
    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF',
        minimumFractionDigits: 0,
      }).format(amount);
    };

    it('formats currency correctly', () => {
      const formatted = formatCurrency(10000);
      expect(formatted).toContain('10');
      expect(formatted).toContain('000');
    });
  });

  describe('Score Calculations', () => {
    const calculateWinRate = (wins: number, total: number): number => {
      if (total === 0) return 0;
      return Math.round((wins / total) * 100);
    };

    it('calculates win rate correctly', () => {
      expect(calculateWinRate(5, 10)).toBe(50);
      expect(calculateWinRate(3, 4)).toBe(75);
      expect(calculateWinRate(0, 10)).toBe(0);
    });

    it('handles edge cases', () => {
      expect(calculateWinRate(0, 0)).toBe(0);
      expect(calculateWinRate(10, 10)).toBe(100);
    });
  });
});
