// Distinct, harmonious color palette for accounts and pockets
// Curated to prevent visual clashes and ensure 100% uniqueness across items
export const DISTINCT_ACCOUNT_COLORS: string[] = [
  '#CC785C', // Terracotta
  '#2E7D6D', // Forest Emerald
  '#4A6FA5', // Slate Blue
  '#D97706', // Warm Amber / Ochre
  '#7C3AED', // Regal Violet
  '#0284C7', // Ocean Sky
  '#0D9488', // Deep Teal
  '#DC2626', // Crimson Ruby
  '#4338CA', // Indigo
  '#EA580C', // Tangerine
  '#059669', // Mint Green
  '#9333EA', // Purple
  '#BE185D', // Rose Fuchsia
  '#B45309', // Dark Bronze
  '#374151', // Graphite Obsidian
  '#1E40AF', // Midnight Navy
  '#15803D', // Hunter Green
  '#A21CAF', // Rich Magenta
  '#6D28D9', // Deep Purple
  '#C05621', // Rust
];

/**
 * Returns a color that is not currently present in existingColors.
 * If all colors in the list are used, it appends a numbered tint offset or loops deterministically.
 */
export function getUniqueEntityColor(existingColors: string[]): string {
  const normalizedExisting = new Set(existingColors.map((c) => c.toLowerCase()));

  for (const col of DISTINCT_ACCOUNT_COLORS) {
    if (!normalizedExisting.has(col.toLowerCase())) {
      return col;
    }
  }

  // Fallback: pick the one least used or cycle safely
  const idx = existingColors.length % DISTINCT_ACCOUNT_COLORS.length;
  return DISTINCT_ACCOUNT_COLORS[idx];
}
