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
};

export const Typography = {
  display: {
    fontSize: 32,
    fontWeight: '600' as const,
    color: Palette.ink,
    letterSpacing: -0.8,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: Palette.ink,
    letterSpacing: -0.4,
  },
  subheading: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: Palette.bodyStrong,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: Palette.body,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Palette.muted,
  },
  mono: {
    fontSize: 14,
    fontWeight: '500' as const,
    letterSpacing: -0.3,
  },
};
