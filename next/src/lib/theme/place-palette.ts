import { normalizeAccentColor } from '@/lib/place-accent'
import type { ThemeTokenSet } from '@/lib/theme/apply'
import {
  darkBase,
  lightBase,
  THEME_PALETTES,
  type AccentScale,
  type SlateScale,
  type ThemePaletteId,
} from '@/lib/theme/tokens'

/** Choix explicite de l’utilisateur, par lieu (une palette du sélecteur). */
export const PLACE_PALETTE_CHOICE_KEY = 'mdl_place_palette_choice'
/** Dernière couleur appliquée, pour peindre l’app avant le chargement des lieux. */
export const PLACE_PALETTE_CACHE_KEY = 'mdl_place_palette_cache'
export const ACTIVE_PLACE_STORAGE_KEY = 'mandala_active_community'

export type PlacePaletteInput = {
  slug: string
  accent_color?: string | null
}

export type CachedPlaceTheme = ThemeTokenSet & {
  id: string
  swatch: string
}

type Rgb = { r: number; g: number; b: number }

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex(c: Rgb): string {
  return `#${[c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function channel(c: Rgb): string {
  return `${c.r} ${c.g} ${c.b}`
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  }
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0)
  else if (max === G) h = (B - R) / d + 2
  else h = (R - G) / d + 4
  return { h: h / 6, s, l }
}

function hue2rgb(p: number, q: number, t: number): number {
  let x = t
  if (x < 0) x += 1
  if (x > 1) x -= 1
  if (x < 1 / 6) return p + (q - p) * 6 * x
  if (x < 1 / 2) return q
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  }
}

function rotateHue(hex: string, degrees: number): string {
  const { r, g, b } = hexToRgb(hex)
  const hsl = rgbToHsl(r, g, b)
  const h = (hsl.h + degrees / 360) % 1
  return rgbToHex(hslToRgb(h < 0 ? h + 1 : h, hsl.s, hsl.l))
}

/** Même couleur sur deux lieux : on décale la teinte pour qu’ils ne se confondent pas. */
export function distinctPlaceAccent(place: PlacePaletteInput, places: PlacePaletteInput[]): string {
  const mine = normalizeAccentColor(place.accent_color)
  const same = places
    .filter((item) => normalizeAccentColor(item.accent_color) === mine)
    .sort((a, b) => a.slug.localeCompare(b.slug, 'fr'))
  const index = same.findIndex((item) => item.slug === place.slug)
  if (index <= 0) return mine
  return rotateHue(mine, index * 36)
}

function tintScale(base: SlateScale, bg950: string, bg900: string, border800: string): SlateScale {
  return { ...base, 950: bg950, 900: bg900, 800: border800, 700: border800 }
}

/** Fonds et boutons dérivés de la couleur du lieu. */
export function buildPlaceTheme(accent?: string | null): CachedPlaceTheme {
  const hex = normalizeAccentColor(accent)
  const base = hexToRgb(hex)
  const hsl = rgbToHsl(base.r, base.g, base.b)
  const sat = Math.min(0.9, Math.max(0.4, hsl.s))
  const bright = hslToRgb(hsl.h, sat, Math.min(0.74, Math.max(0.52, hsl.l + 0.08)))
  const button = hslToRgb(hsl.h, sat, Math.min(0.42, Math.max(0.28, hsl.l * 0.62)))
  const deep = hslToRgb(hsl.h, Math.min(sat, 0.75), Math.min(0.32, Math.max(0.2, hsl.l * 0.45)))
  const accentScale: AccentScale = {
    400: channel(bright),
    500: channel(base),
    600: channel(button),
    700: channel(deep),
  }

  const lightBg = { r: 255, g: 255, b: 255 }
  const darkInk = { r: 8, g: 10, b: 16 }
  const light: SlateScale = tintScale(
    lightBase,
    channel(mix(lightBg, base, 0.07)),
    channel(mix(lightBg, base, 0.14)),
    channel(mix(lightBg, base, 0.28)),
  )
  const dark: SlateScale = tintScale(
    darkBase,
    channel(mix(darkInk, base, 0.22)),
    channel(mix({ r: 14, g: 16, b: 24 }, base, 0.28)),
    channel(mix({ r: 24, g: 28, b: 38 }, base, 0.38)),
  )

  return {
    id: 'place',
    swatch: hex,
    accent: accentScale,
    light,
    dark,
  }
}

function readJsonMap(key: string): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeJsonMap(key: string, value: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / navigation privée */
  }
}

function asPalette(value: unknown): ThemePaletteId | null {
  if (typeof value === 'string' && value in THEME_PALETTES) return value as ThemePaletteId
  return null
}

function isCachedTheme(value: unknown): value is CachedPlaceTheme {
  if (!value || typeof value !== 'object') return false
  const entry = value as CachedPlaceTheme
  return Boolean(entry.accent && entry.light && entry.dark && entry.swatch)
}

export function readPlacePaletteChoices(): Partial<Record<string, ThemePaletteId>> {
  const raw = readJsonMap(PLACE_PALETTE_CHOICE_KEY)
  const out: Partial<Record<string, ThemePaletteId>> = {}
  for (const [slug, value] of Object.entries(raw)) {
    const palette = asPalette(value)
    if (slug && palette) out[slug] = palette
  }
  return out
}

export function writePlacePaletteCache(slug: string, theme: CachedPlaceTheme): void {
  const cache = readJsonMap(PLACE_PALETTE_CACHE_KEY)
  cache[slug] = theme
  writeJsonMap(PLACE_PALETTE_CACHE_KEY, cache)
}

export function cachedThemeFromPalette(palette: ThemePaletteId): CachedPlaceTheme {
  const tokens = THEME_PALETTES[palette]
  return {
    id: palette,
    swatch: tokens.swatch,
    accent: tokens.accent,
    light: tokens.light,
    dark: tokens.dark,
  }
}

export function writePlacePaletteChoice(slug: string, palette: ThemePaletteId): void {
  const choices = readJsonMap(PLACE_PALETTE_CHOICE_KEY)
  choices[slug] = palette
  writeJsonMap(PLACE_PALETTE_CHOICE_KEY, choices)
  writePlacePaletteCache(slug, cachedThemeFromPalette(palette))
}

export function readCachedPlaceTheme(): CachedPlaceTheme | null {
  if (typeof window === 'undefined') return null
  const slug = localStorage.getItem(ACTIVE_PLACE_STORAGE_KEY)
  if (!slug) return null
  const entry = readJsonMap(PLACE_PALETTE_CACHE_KEY)[slug]
  if (isCachedTheme(entry)) return entry
  const palette = asPalette(entry)
  return palette ? cachedThemeFromPalette(palette) : null
}

export function isMandalaAppPath(pathname?: string): boolean {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')
  return path === '/app' || path.startsWith('/app/')
}

export type ResolvedPlaceChrome =
  | { kind: 'preset'; palette: ThemePaletteId; theme: CachedPlaceTheme }
  | { kind: 'accent'; theme: CachedPlaceTheme }

/** Couleur d’interface du lieu : choix du sélecteur, sinon la couleur propre du lieu. */
export function resolvePlaceChrome(
  place: PlacePaletteInput,
  places: PlacePaletteInput[],
  choices: Partial<Record<string, ThemePaletteId>> = readPlacePaletteChoices(),
): ResolvedPlaceChrome {
  const choice = choices[place.slug]
  if (choice) {
    return { kind: 'preset', palette: choice, theme: cachedThemeFromPalette(choice) }
  }
  const list = places.some((item) => item.slug === place.slug) ? places : [...places, place]
  return { kind: 'accent', theme: buildPlaceTheme(distinctPlaceAccent(place, list)) }
}
