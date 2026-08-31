/**
 * Luxora AI Chatbot Design Tokens
 * Derived directly from the existing Luxora website design system.
 */

export const colors = {
  // Brand Gold Accents
  gold: '#C9A84C',
  goldLight: '#E8C96B',
  goldBtn: '#D4A843',
  goldDark: '#8C6D23',
  goldMuted: 'rgba(201, 168, 76, 0.15)',
  goldMutedBorder: 'rgba(201, 168, 76, 0.25)',
  goldGlow: 'rgba(201, 168, 76, 0.35)',

  // Dark Luxury Backgrounds & Surfaces
  dark: '#0F0F0F',
  darkSecondary: '#1A1A1A',
  darkCard: '#1C1C1C',
  darkBorder: '#2A2A2A',
  surface: '#121212',
  surfaceRaised: '#181818',
  line: 'rgba(255, 255, 255, 0.09)',

  // Text & Neutrals
  white: '#FFFFFF',
  offWhite: '#F5F5F0',
  textLight: '#CCCCCC',
  textMuted: '#888888',

  // Status Colors
  success: '#5FBD8B',
  successMuted: 'rgba(95, 189, 139, 0.15)',
  danger: '#DF7A78',
  dangerMuted: 'rgba(223, 122, 120, 0.15)',
  warning: '#E8C96B',
  warningMuted: 'rgba(232, 201, 107, 0.15)'
}

export const typography = {
  fontPrimary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontDisplay: "'Playfair Display', Georgia, serif",
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800
  },
  sizes: {
    eyebrow: '0.68rem',
    badge: '0.67rem',
    caption: '0.75rem',
    sm: '0.82rem',
    base: '0.92rem',
    body: '0.95rem',
    md: '1.05rem',
    title: '1.25rem',
    heading: '1.65rem'
  },
  letterSpacing: {
    tight: '-0.02em',
    normal: '0em',
    wide: '0.08em',
    eyebrow: '0.18em'
  }
}

export const radii = {
  xs: '4px',
  sm: '6px',
  button: '9px',
  md: '12px',
  card: '18px',
  window: '20px',
  full: '999px',
  bubbleUser: '18px 18px 4px 18px',
  bubbleBot: '18px 18px 18px 4px'
}

export const shadows = {
  goldGlow: '0 0 30px rgba(201, 168, 76, 0.15)',
  card: '0 18px 40px rgba(0, 0, 0, 0.18)',
  window: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(201, 168, 76, 0.25)',
  button: '0 4px 16px rgba(201, 168, 76, 0.22)',
  floatingTrigger: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(201, 168, 76, 0.35)'
}

export const transitions = {
  default: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  fast: 'all 0.18s ease',
  spring: 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
}

export const gradients = {
  card: 'linear-gradient(145deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.012))',
  goldButton: 'linear-gradient(135deg, #E8C96B 0%, #D4A843 50%, #C9A84C 100%)',
  headerDark: 'linear-gradient(180deg, rgba(26, 26, 26, 0.95) 0%, rgba(18, 18, 18, 0.95) 100%)',
  accentSubtle: 'linear-gradient(145deg, rgba(201, 168, 76, 0.08) 0%, rgba(201, 168, 76, 0.02) 100%)'
}

export default {
  colors,
  typography,
  radii,
  shadows,
  transitions,
  gradients
}
