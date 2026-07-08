/** Styles dérivés de la couleur d'accent d'un lieu (cartes mur, badges). */

const DEFAULT_ACCENT = '#7c3aed'

export function normalizeAccentColor(raw?: string | null): string {
  const s = raw?.trim() ?? ''
  if (/^#[0-9a-f]{6}$/i.test(s)) return s
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    const h = s.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
  }
  return DEFAULT_ACCENT
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function accentRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(normalizeAccentColor(hex))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export type PlaceAccentSurface = {
  accent: string
  headerBg: string
  cardBg: string
  cardBorder: string
  chipBg: string
  chipBorder: string
}

export function placeAccentSurface(accent?: string | null): PlaceAccentSurface {
  const a = normalizeAccentColor(accent)
  return {
    accent: a,
    headerBg: accentRgba(a, 0.22),
    cardBg: accentRgba(a, 0.1),
    cardBorder: accentRgba(a, 0.38),
    chipBg: accentRgba(a, 0.16),
    chipBorder: accentRgba(a, 0.45),
  }
}
