// Mirrors the CSS variables in src/app/globals.css (DESIGN.md › Color).
// Use in places CSS can't reach, such as three.js materials.
export const tokens = {
  bg: "#07070C",
  surface: "#11121C",
  line: "#262838",
  text: "#F2F4FF",
  muted: "#8A90B2",
  cyan: "#22E4FF",
  lime: "#B6FF3B",
  amber: "#FFB020",
  red: "#FF3B5C",
  gold: "#FFD54A",
} as const;

export type TokenName = keyof typeof tokens;

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two #RRGGBB colors. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
