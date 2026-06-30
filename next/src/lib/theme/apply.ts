import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PALETTE,
  type ThemeMode,
  type ThemePaletteId,
  THEME_PALETTES,
} from '@/lib/theme/tokens'

export function applyThemeToDocument(mode: ThemeMode, palette: ThemePaletteId): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const tokens = THEME_PALETTES[palette] ?? THEME_PALETTES[DEFAULT_THEME_PALETTE]
  const slate = mode === 'light' ? tokens.light : tokens.dark

  root.classList.remove('light', 'dark')
  root.classList.add(mode)
  root.setAttribute('data-palette', palette)
  root.style.colorScheme = mode

  for (const [step, value] of Object.entries(slate)) {
    root.style.setProperty(`--slate-${step}`, value)
  }
  for (const [step, value] of Object.entries(tokens.accent)) {
    root.style.setProperty(`--accent-${step}`, value)
  }

  root.style.setProperty('--foreground-rgb', mode === 'light' ? slate[100] : slate[100])
  root.style.setProperty('--background-rgb', mode === 'light' ? slate[950] : slate[950])
  root.style.setProperty('--scrollbar-thumb', mode === 'light' ? '161 161 170' : '51 65 85')
  root.style.setProperty('--scrollbar-track', mode === 'light' ? slate[900] : slate[950])
}

export function readThemeFromStorage(): { mode: ThemeMode; palette: ThemePaletteId } {
  if (typeof window === 'undefined') {
    return { mode: DEFAULT_THEME_MODE, palette: DEFAULT_THEME_PALETTE }
  }
  try {
    const mode = localStorage.getItem('mdl_theme_mode') === 'light' ? 'light' : 'dark'
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
