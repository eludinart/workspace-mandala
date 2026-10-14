import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PALETTE,
  THEME_FORCE_LIGHT_STAMP,
  type AccentScale,
  type SlateScale,
  type ThemeMode,
  type ThemePaletteId,
  THEME_PALETTES,
} from '@/lib/theme/tokens'

export type ThemeTokenSet = {
  accent: AccentScale
  light: SlateScale
  dark: SlateScale
}

export function applyThemeTokens(
  mode: ThemeMode,
  tokens: ThemeTokenSet,
  paletteAttr: string,
): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const slate = mode === 'light' ? tokens.light : tokens.dark

  root.classList.remove('light', 'dark')
  root.classList.add(mode)
  root.setAttribute('data-palette', paletteAttr)
  root.style.colorScheme = mode

  for (const [step, value] of Object.entries(slate)) {
    root.style.setProperty(`--slate-${step}`, value)
  }
  for (const [step, value] of Object.entries(tokens.accent)) {
    root.style.setProperty(`--accent-${step}`, value)
  }

  root.style.setProperty('--foreground-rgb', slate[100])
  root.style.setProperty('--background-rgb', slate[950])
  root.style.setProperty('--scrollbar-thumb', mode === 'light' ? '161 161 170' : '51 65 85')
  root.style.setProperty('--scrollbar-track', mode === 'light' ? slate[900] : slate[950])
}

export function applyThemeToDocument(mode: ThemeMode, palette: ThemePaletteId): void {
  const tokens = THEME_PALETTES[palette] ?? THEME_PALETTES[DEFAULT_THEME_PALETTE]
  applyThemeTokens(mode, tokens, palette)
}

export function readThemeFromStorage(): { mode: ThemeMode; palette: ThemePaletteId } {
  if (typeof window === 'undefined') {
    return { mode: DEFAULT_THEME_MODE, palette: DEFAULT_THEME_PALETTE }
  }
  try {
    if (localStorage.getItem('mdl_theme_force_light') !== THEME_FORCE_LIGHT_STAMP) {
      localStorage.setItem('mdl_theme_force_light', THEME_FORCE_LIGHT_STAMP)
      localStorage.setItem('mdl_theme_mode', 'light')
    }
    const storedMode = localStorage.getItem('mdl_theme_mode')
    const mode = storedMode === 'dark' ? 'dark' : storedMode === 'light' ? 'light' : DEFAULT_THEME_MODE
    const paletteRaw = localStorage.getItem('mdl_theme_palette') ?? DEFAULT_THEME_PALETTE
    const palette = paletteRaw in THEME_PALETTES ? (paletteRaw as ThemePaletteId) : DEFAULT_THEME_PALETTE
    return { mode, palette }
  } catch {
    return { mode: DEFAULT_THEME_MODE, palette: DEFAULT_THEME_PALETTE }
  }
}

export function writeThemeToStorage(mode: ThemeMode, palette: ThemePaletteId): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('mdl_theme_mode', mode)
    localStorage.setItem('mdl_theme_palette', palette)
  } catch {
    /* ignore */
  }
}
