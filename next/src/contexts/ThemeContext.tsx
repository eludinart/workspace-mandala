'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '@/api/auth'
import { useAuth } from '@/contexts/AuthContext'
import {
  applyThemeToDocument,
  applyThemeTokens,
  readThemeFromStorage,
  writeThemeToStorage,
  type ThemeTokenSet,
} from '@/lib/theme/apply'
import {
  isMandalaAppPath,
  readCachedPlaceTheme,
  resolvePlaceChrome,
  writePlacePaletteCache,
  writePlacePaletteChoice,
  type PlacePaletteInput,
} from '@/lib/theme/place-palette'
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PALETTE,
  parseThemeMode,
  parseThemePalette,
  THEME_PALETTES,
  type ThemeMode,
  type ThemePaletteId,
} from '@/lib/theme/tokens'

type ThemeContextValue = {
  mode: ThemeMode
  palette: ThemePaletteId
  /** Vrai quand la couleur affichée est celle du lieu actif. */
  placeBound: boolean
  /** Pastille affichée dans le sélecteur. */
  placeSwatch: string | null
  /** Vrai quand la couleur suit le lieu, sans palette choisie à la main. */
  customPlaceColor: boolean
  setMode: (mode: ThemeMode) => void
  setPalette: (palette: ThemePaletteId) => void
  applyTheme: (mode: ThemeMode, palette: ThemePaletteId) => void
  syncActivePlaceTheme: (
    loading: boolean,
    places: PlacePaletteInput[],
    activeSlug: string | null,
  ) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function themeFromUser(user: Record<string, unknown> | null): {
  mode: ThemeMode
  palette: ThemePaletteId
} {
  if (!user) return readThemeFromStorage()
  return {
    mode: parseThemeMode(user.theme_mode),
    palette: parseThemePalette(user.theme_palette),
  }
}

function paintBootTheme(mode: ThemeMode, globalPalette: ThemePaletteId): CachedBoot | null {
  if (!isMandalaAppPath()) {
    applyThemeToDocument(mode, globalPalette)
    return null
  }
  const cached = readCachedPlaceTheme()
  if (!cached) {
    applyThemeToDocument(mode, globalPalette)
    return null
  }
  applyThemeTokens(mode, cached, cached.id)
  return { swatch: cached.swatch, custom: cached.id === 'place', id: cached.id }
}

type CachedBoot = { swatch: string; custom: boolean; id: string }

function writeThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('mdl_theme_mode', mode)
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth()
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE)
  const [palette, setPaletteState] = useState<ThemePaletteId>(DEFAULT_THEME_PALETTE)
  const [placeBound, setPlaceBound] = useState(false)
  const [placeSwatch, setPlaceSwatch] = useState<string | null>(null)
  const [customPlaceColor, setCustomPlaceColor] = useState(false)
  const syncedUserIdRef = useRef<number | null>(null)
  const modeRef = useRef(mode)
  const paletteRef = useRef(palette)
  const boundSlugRef = useRef<string | null>(null)
  const tokensRef = useRef<ThemeTokenSet | null>(null)
  const paletteAttrRef = useRef<string>(DEFAULT_THEME_PALETTE)
  modeRef.current = mode
  paletteRef.current = palette

  const paintTokens = useCallback((nextMode: ThemeMode, tokens: ThemeTokenSet, paletteAttr: string) => {
    tokensRef.current = tokens
    paletteAttrRef.current = paletteAttr
    applyThemeTokens(nextMode, tokens, paletteAttr)
  }, [])

  const persistGlobal = useCallback(
    async (nextMode: ThemeMode, nextPalette: ThemePaletteId) => {
      writeThemeToStorage(nextMode, nextPalette)
      if (user) {
        try {
          await authApi.updateMyProfile({
            theme_mode: nextMode,
            theme_palette: nextPalette,
          })
          await refreshUser()
        } catch {
          /* préférence locale conservée */
        }
      }
    },
    [user, refreshUser]
  )

  const persistMode = useCallback(
    async (nextMode: ThemeMode) => {
      writeThemeMode(nextMode)
      if (user) {
        try {
          await authApi.updateMyProfile({ theme_mode: nextMode })
          await refreshUser()
        } catch {
          /* préférence locale conservée */
        }
      }
    },
    [user, refreshUser]
  )

  const applyTheme = useCallback(
    (nextMode: ThemeMode, nextPalette: ThemePaletteId) => {
      setModeState(nextMode)
      setPaletteState(nextPalette)
      modeRef.current = nextMode
      paletteRef.current = nextPalette
      const preset = THEME_PALETTES[nextPalette]
      paintTokens(nextMode, preset, nextPalette)
      const slug = boundSlugRef.current
      if (slug) {
        writePlacePaletteChoice(slug, nextPalette)
        setPlaceSwatch(preset.swatch)
        setCustomPlaceColor(false)
        void persistMode(nextMode)
        return
      }
      void persistGlobal(nextMode, nextPalette)
    },
    [paintTokens, persistGlobal, persistMode]
  )

  const syncActivePlaceTheme = useCallback(
    (loading: boolean, places: PlacePaletteInput[], activeSlug: string | null) => {
      if (loading) return
      if (!activeSlug) {
        boundSlugRef.current = null
        setPlaceBound(false)
        setPlaceSwatch(null)
        setCustomPlaceColor(false)
        const stored = readThemeFromStorage()
        paletteRef.current = stored.palette
        setPaletteState(stored.palette)
        paintTokens(modeRef.current, THEME_PALETTES[stored.palette], stored.palette)
        return
      }
      const place = places.find((item) => item.slug === activeSlug) ?? { slug: activeSlug }
      const chrome = resolvePlaceChrome(place, places.length > 0 ? places : [place])
      boundSlugRef.current = activeSlug
      setPlaceBound(true)
      setPlaceSwatch(chrome.theme.swatch)
      setCustomPlaceColor(chrome.kind === 'accent')
      if (chrome.kind === 'preset') {
        paletteRef.current = chrome.palette
        setPaletteState(chrome.palette)
      }
      paintTokens(modeRef.current, chrome.theme, chrome.theme.id)
      writePlacePaletteCache(activeSlug, chrome.theme)
    },
    [paintTokens],
  )

  // Préférence locale immédiate (avant chargement auth).
  // Dans l'app, on reprend la couleur du dernier lieu pour éviter un flash.
  useEffect(() => {
    const stored = readThemeFromStorage()
    const boot = paintBootTheme(stored.mode, stored.palette)
    setModeState(stored.mode)
    modeRef.current = stored.mode
    if (boot?.id && boot.id in THEME_PALETTES) {
      const id = boot.id as ThemePaletteId
      setPaletteState(id)
      paletteRef.current = id
    } else {
      setPaletteState(stored.palette)
      paletteRef.current = stored.palette
    }
    if (boot) {
      setPlaceSwatch(boot.swatch)
      setCustomPlaceColor(boot.custom)
      tokensRef.current = readCachedPlaceTheme()
      paletteAttrRef.current = boot.id
    }
  }, [])

  // Sync profil serveur uniquement au changement d'utilisateur connecté
  useEffect(() => {
    const uid = user ? Number((user as { id?: number }).id) : null
    if (!uid) {
      syncedUserIdRef.current = null
      boundSlugRef.current = null
      setPlaceBound(false)
      setPlaceSwatch(null)
      setCustomPlaceColor(false)
      const stored = readThemeFromStorage()
      setModeState(stored.mode)
      setPaletteState(stored.palette)
      modeRef.current = stored.mode
      paletteRef.current = stored.palette
      applyThemeToDocument(stored.mode, stored.palette)
      return
    }
    if (syncedUserIdRef.current === uid) return
    syncedUserIdRef.current = uid

    const stored = readThemeFromStorage()
    const profile = themeFromUser(user as Record<string, unknown>)
    const hasLocal =
      typeof window !== 'undefined' &&
      (localStorage.getItem('mdl_theme_mode') != null ||
        localStorage.getItem('mdl_theme_palette') != null)
    const resolved = hasLocal ? stored : profile
    const boot = paintBootTheme(resolved.mode, resolved.palette)

    setModeState(resolved.mode)
    modeRef.current = resolved.mode
    if (boot?.id && boot.id in THEME_PALETTES) {
      const id = boot.id as ThemePaletteId
      setPaletteState(id)
      paletteRef.current = id
    } else {
      setPaletteState(resolved.palette)
      paletteRef.current = resolved.palette
    }
    if (boot) {
      setPlaceSwatch(boot.swatch)
      setCustomPlaceColor(boot.custom)
      tokensRef.current = readCachedPlaceTheme()
      paletteAttrRef.current = boot.id
    }
    writeThemeToStorage(resolved.mode, resolved.palette)
  }, [user])

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next)
      modeRef.current = next
      const tokens = tokensRef.current ?? THEME_PALETTES[paletteRef.current]
      paintTokens(next, tokens, paletteAttrRef.current)
      if (boundSlugRef.current) {
        void persistMode(next)
        return
      }
      void persistGlobal(next, paletteRef.current)
    },
    [paintTokens, persistGlobal, persistMode]
  )

  const setPalette = useCallback(
    (next: ThemePaletteId) => {
      setPaletteState(next)
      paletteRef.current = next
      const preset = THEME_PALETTES[next]
      paintTokens(modeRef.current, preset, next)
      setPlaceSwatch(boundSlugRef.current ? preset.swatch : null)
      setCustomPlaceColor(false)
      const slug = boundSlugRef.current
      if (slug) {
        writePlacePaletteChoice(slug, next)
        return
      }
      void persistGlobal(modeRef.current, next)
    },
    [paintTokens, persistGlobal]
  )

  const value = useMemo(
    () => ({
      mode,
      palette,
      placeBound,
      placeSwatch,
      customPlaceColor,
      setMode,
      setPalette,
      applyTheme,
      syncActivePlaceTheme,
    }),
    [mode, palette, placeBound, placeSwatch, customPlaceColor, setMode, setPalette, applyTheme, syncActivePlaceTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
