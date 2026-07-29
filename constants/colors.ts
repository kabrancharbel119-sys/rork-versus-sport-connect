export const Colors = {
  primary: {
    blue: '#1565C0',
    blueLight: '#42A5F5',
    blueDark: '#0D47A1',
    orange: '#FF6B00',
    orangeLight: '#FF9100',
    orangeDark: '#E65100',
  },
  background: {
    dark: '#0d111d',
    card: '#121829',
    cardLight: '#161d33',
    elevated: '#1A2340',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#C4D0E0',
    muted: '#8B98AC',
    accent: '#FF9100',
  },
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  gradient: {
    blueStart: '#1565C0',
    blueEnd: '#0D47A1',
    orangeStart: '#FF9100',
    orangeEnd: '#FF6B00',
    cardStart: 'rgba(30, 42, 69, 0.8)',
    cardEnd: 'rgba(20, 27, 45, 0.9)',
  },
  border: {
    light: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.16)',
  },
};

/* ════ Design System — Spacing & Radius ════ */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const CARD_RADIUS = 24;
export const BUTTON_RADIUS = 18;
export const TAG_RADIUS = 15;
export const TAG_HEIGHT = 30;
export const BUTTON_HEIGHT = 56;
export const CARD_INNER_PAD = 20;
export const OUTER_PAD = 24;
export const SECTION_GAP = 32;
export const CARD_GAP = 16;

/* Soft glow shadow — never black */
export const softShadow = {
  shadowColor: '#FF6B00',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 1,
} as const;

export const cardGlow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 8,
  elevation: 1,
} as const;

export default Colors;