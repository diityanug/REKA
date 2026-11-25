// Design Tokens for AES based on Claude DESIGN.md
// Warm-canvas editorial interface with bronze/terracotta and sage accents

export const Palette = {
  // Brand & Accents
  primary: '#CC785C',          // Warm Terracotta / Bronze (Aes copper roots)
  primaryActive: '#A9583E',
  primaryDisabled: '#E6DFD8',
  accentTeal: '#5DB8A6',       // Muted Sage / Balance / Income
  accentAmber: '#E8A55A',      // Warm Ochre / Warning / Pending
  success: '#5DB872',          // Positive cashflow
  error: '#C64545',            // Expense alert
  
  // Ink & Text
  ink: '#141413',              // Primary text (warm near-black)
  bodyStrong: '#252523',
  body: '#3D3D3A',             // Standard body text
  muted: '#6C6A64',            // Secondary labels
  mutedSoft: '#8E8B82',        // Tertiary notes
  
  // Surfaces & Backgrounds
  canvas: '#FAF9F5',           // Editorial tinted cream (not blinding white)
  surfaceSoft: '#F5F0E8',      // Slightly deeper cream for containers
  surfaceCard: '#EFE9DE',      // Elevated cards
  surfaceCreamStrong: '#E8E0D2',
  
  // Hairlines & Borders
  hairline: '#E6DFD8',         // Subtle container borders
  hairlineSoft: '#EBE6DF',
  
  // Dark Contrast (for sheets, modal pills, or status chips)
  surfaceDark: '#181715',
  surfaceDarkElevated: '#252320',
  onDark: '#FAF9F5',
  onDarkSoft: '#A09D96',
  white: '#FFFFFF',

  // Semantic tints — prefer these over new raw hex literals in components
  tintExpense: '#FDF0ED',
  tintExpenseBorder: '#F9DCD5',
  tintIncome: '#EBF7F4',
  tintIncomeBorder: '#CDEBE3',
  tintWarning: '#FFFBEB',
  tintWarningBorder: '#FCE8B2',
  tintInfo: '#EDF5FF',
  tintInfoBorder: '#D0E4FF',
};

// Spacing scale (4pt grid) — keeps padding consistent across screens
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Editorial 3-Voice Typography Families (loaded via expo-font multi-face in App.tsx)
export const FontFamily = {
  editorial: 'PlayfairDisplay',
  sans: 'PlusJakartaSans',
  mono: 'JetBrainsMono',
} as const;

export const Typography = {
  editorialTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: 22,
    fontWeight: '600' as const,
    color: Palette.ink,
    letterSpacing: -0.15,
  },
  display: {
    fontFamily: FontFamily.sans,
    fontSize: 30,
    fontWeight: '600' as const,
    color: Palette.ink,
    letterSpacing: -0.7,
    fontVariant: ['tabular-nums' as const],
  },
  heading: {
    fontFamily: FontFamily.sans,
    fontSize: 19,
    fontWeight: '600' as const,
    color: Palette.ink,
    letterSpacing: -0.3,
  },
  subheading: {
    fontFamily: FontFamily.sans,
    fontSize: 15,
    fontWeight: '500' as const,
    color: Palette.bodyStrong,
    letterSpacing: -0.15,
  },
  body: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    fontWeight: '400' as const,
    color: Palette.body,
    lineHeight: 20,
  },
  label: {
    fontFamily: FontFamily.sans,
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.45,
    textTransform: 'uppercase' as const,
    color: Palette.muted,
  },
  caption: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    fontWeight: '400' as const,
    color: Palette.muted,
  },
  // Clean tabular numerals in Plus Jakarta Sans so wide currency strings (e.g. Rp 12.500.000) stay airy & aligned
  mono: {
    fontFamily: FontFamily.sans,
    fontSize: 13.5,
    fontWeight: '600' as const,
    letterSpacing: -0.25,
    fontVariant: ['tabular-nums' as const],
  },
  // Dedicated JetBrains Mono strictly for compact micro-data (times, currency tags, percentages, account numbers)
  code: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums' as const],
  },
};
