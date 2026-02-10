// Steampunk Forensic Lab Theme
// A blend of Victorian-era mechanical aesthetics with modern forensic technology

export const STEAMPUNK_COLORS = {
  // Base backgrounds - deep mahogany and iron tones
  bgDark: '#0d0907',      // Darkest - like coal/iron
  bgPanel: '#1a120e',     // Panel backgrounds - dark mahogany
  bgCard: '#251a14',      // Card surfaces - weathered wood
  bgHighlight: '#2d1f17', // Elevated surfaces
  
  // Primary accents - brass and copper
  brass: '#cd9b3e',       // Primary brass accent
  brassLight: '#e6b84d',  // Highlighted brass
  brassDark: '#a67c2e',   // Shadowed brass
  copper: '#b87333',      // Copper accent
  copperGlow: 'rgba(205, 155, 62, 0.15)', // Subtle brass glow
  
  // Secondary accents - steam and light
  steam: '#94a3b8',       // Cool steam/metal
  steamLight: '#c0d4e8',  // Lit steam
  teal: '#2dd4bf',        // Modern tech accent
  amber: '#f59e0b',       // Warning amber
  
  // Status colors
  success: '#10b981',     // Emerald - positive match
  danger: '#dc2626',      // Deep red - negative match
  warning: '#f59e0b',     // Amber - caution
  
  // Text colors
  text: '#e8dfd4',        // Primary text - aged parchment
  textDim: '#9c8b7a',     // Secondary text - faded ink
  textMuted: '#6b5a4a',   // Muted text
  
  // Borders and details
  border: '#3d2a1e',      // Dark wood border
  borderLight: '#5c4332', // Lighter border
  rivet: '#8b7355',       // Rivet/bolt color
  
  // Special effects
  glowBrass: 'rgba(205, 155, 62, 0.3)',
  glowTeal: 'rgba(45, 212, 191, 0.2)',
};

// Typography constants
export const TYPOGRAPHY = {
  fontMono: {
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  },
};

// Common component styles
export const COMMON_STYLES = {
  // Container styles
  screenContainer: {
    flex: 1,
    backgroundColor: STEAMPUNK_COLORS.bgDark,
  },
  
  // Card styles
  card: {
    backgroundColor: STEAMPUNK_COLORS.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: STEAMPUNK_COLORS.border,
  },
  
  // Panel styles  
  panel: {
    backgroundColor: STEAMPUNK_COLORS.bgPanel,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: STEAMPUNK_COLORS.border,
  },
  
  // Button styles
  primaryButton: {
    backgroundColor: STEAMPUNK_COLORS.brass,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: STEAMPUNK_COLORS.brassLight,
  },
  
  secondaryButton: {
    backgroundColor: STEAMPUNK_COLORS.bgCard,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: STEAMPUNK_COLORS.brass,
  },
  
  // Text styles
  headerText: {
    color: STEAMPUNK_COLORS.text,
    fontWeight: '700' as const,
    letterSpacing: 2,
  },
  
  labelText: {
    color: STEAMPUNK_COLORS.brass,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  
  bodyText: {
    color: STEAMPUNK_COLORS.text,
    fontSize: 14,
  },
  
  mutedText: {
    color: STEAMPUNK_COLORS.textDim,
    fontSize: 12,
  },
};

// Decorative elements
export const DECORATIVE = {
  // Rivet/bolt decoration
  rivet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: STEAMPUNK_COLORS.rivet,
    borderWidth: 1,
    borderColor: STEAMPUNK_COLORS.brassDark,
  },
  
  // Gear icon tint
  gearTint: STEAMPUNK_COLORS.brass,
  
  // Border with rivets
  rivetedBorder: {
    borderWidth: 2,
    borderColor: STEAMPUNK_COLORS.border,
    borderStyle: 'solid' as const,
  },
};

export default {
  colors: STEAMPUNK_COLORS,
  typography: TYPOGRAPHY,
  styles: COMMON_STYLES,
  decorative: DECORATIVE,
};
