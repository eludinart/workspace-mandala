export type ThemeMode = 'light' | 'dark'

export type ThemePaletteId =
  | 'violet'
  | 'indigo'
  | 'ocean'
  | 'forest'
  | 'amber'
  | 'rose'
  | 'stone'
  | 'fuchsia'

export type SlateScale = {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950: string
}

export type AccentScale = {
  400: string
  500: string
  600: string
  700: string
}

export type PaletteTokens = {
  dark: SlateScale
  light: SlateScale
  accent: AccentScale
  /** Couleur d’aperçu du sélecteur */
  swatch: string
  label: string
}

const darkBase: SlateScale = {
  50: '248 250 252',
  100: '241 245 249',
  200: '226 232 240',
  300: '203 213 225',
  400: '148 163 184',
  500: '100 116 139',
  600: '71 85 105',
  700: '51 65 85',
  800: '30 41 59',
  900: '15 23 42',
  950: '2 6 23',
}

/** Échelle inversée sémantiquement : bg-slate-950 → fond clair, text-slate-100 → texte foncé */
const lightBase: SlateScale = {
  50: '9 9 11',
  100: '24 24 27',
  200: '39 39 42',
  300: '63 63 70',
  400: '82 82 91',
  500: '113 113 122',
  600: '161 161 170',
  700: '212 212 216',
  800: '228 228 231',
  900: '244 244 245',
  950: '250 250 252',
}

function tint(scale: SlateScale, bg950: string, bg900: string, border800: string): SlateScale {
  return { ...scale, 950: bg950, 900: bg900, 800: border800, 700: border800 }
}

export const THEME_PALETTES: Record<ThemePaletteId, PaletteTokens> = {
  violet: {
    label: 'Violine',
    swatch: '#8b5cf6',
    accent: { 400: '167 139 250', 500: '139 92 246', 600: '124 58 237', 700: '109 40 217' },
    dark: tint(darkBase, '10 8 22', '18 14 36', '38 32 68'),
    light: tint(lightBase, '250 248 255', '243 240 255', '224 216 248'),
  },
  indigo: {
    label: 'Indigo',
    swatch: '#6366f1',
    accent: { 400: '129 140 248', 500: '99 102 241', 600: '79 70 229', 700: '67 56 202' },
    dark: tint(darkBase, '8 10 26', '14 18 40', '32 38 72'),
    light: tint(lightBase, '248 248 255', '238 242 255', '210 214 250'),
  },
  ocean: {
    label: 'Océan',
    swatch: '#0ea5e9',
    accent: { 400: '56 189 248', 500: '14 165 233', 600: '2 132 226', 700: '3 105 161' },
    dark: tint(darkBase, '6 14 24', '10 22 38', '22 48 72'),
    light: tint(lightBase, '248 252 255', '240 249 255', '186 224 245'),
  },
  forest: {
    label: 'Forêt',
    swatch: '#10b981',
    accent: { 400: '52 211 153', 500: '16 185 129', 600: '5 150 105', 700: '4 120 87' },
    dark: tint(darkBase, '6 16 14', '10 26 22', '22 52 44'),
    light: tint(lightBase, '248 255 252', '236 253 245', '186 230 210'),
  },
  amber: {
    label: 'Ambre',
    swatch: '#f59e0b',
    accent: { 400: '251 191 36', 500: '245 158 11', 600: '217 119 6', 700: '180 83 9' },
    dark: tint(darkBase, '18 14 8', '28 22 12', '58 44 24'),
    light: tint(lightBase, '255 251 245', '255 247 237', '245 222 190'),
  },
  rose: {
    label: 'Rose',
    swatch: '#f43f5e',
    accent: { 400: '251 113 133', 500: '244 63 94', 600: '225 29 72', 700: '190 18 60' },
    dark: tint(darkBase, '20 8 14', '32 14 22', '68 28 44'),
    light: tint(lightBase, '255 248 250', '255 241 245', '245 198 210'),
  },
  stone: {
    label: 'Ardoise',
    swatch: '#78716c',
    accent: { 400: '168 162 158', 500: '120 113 108', 600: '87 83 78', 700: '68 64 60' },
    dark: tint(darkBase, '12 12 14', '20 20 22', '42 42 46'),
    light: tint(lightBase, '250 250 249', '245 245 244', '220 218 214'),
  },
  fuchsia: {
    label: 'Fuchsia',
    swatch: '#d946ef',
    accent: { 400: '232 121 249', 500: '217 70 239', 600: '192 38 211', 700: '162 28 175' },
    dark: tint(darkBase, '18 8 22', '28 12 34', '58 24 68'),
    light: tint(lightBase, '253 248 255', '250 232 255', '232 198 245'),
  },
}

export const THEME_PALETTE_IDS = Object.keys(THEME_PALETTES) as ThemePaletteId[]

export const DEFAULT_THEME_MODE: ThemeMode = 'dark'
export const DEFAULT_THEME_PALETTE: ThemePaletteId = 'violet'

export const THEME_STORAGE_MODE = 'mdl_theme_mode'
export const THEME_STORAGE_PALETTE = 'mdl_theme_palette'

export function parseThemeMode(raw: unknown): ThemeMode {
  return raw === 'light' ? 'light' : 'dark'
}

export function parseThemePalette(raw: unknown): ThemePaletteId {
  const s = String(raw ?? '').toLowerCase()
  if (s in THEME_PALETTES) return s as ThemePaletteId
  return DEFAULT_THEME_PALETTE
}
