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
import { applyThemeToDocument, readThemeFromStorage, writeThemeToStorage } from '@/lib/theme/apply'
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PALETTE,
  parseThemeMode,
  parseThemePalette,
  type ThemeMode,
  type ThemePaletteId,
} from '@/lib/theme/tokens'

type ThemeContextValue = {
  mode: ThemeMode
  palette: ThemePaletteId
  setMode: (mode: ThemeMode) => void
  setPalette: (palette: ThemePaletteId) => void
  applyTheme: (mode: ThemeMode, palette: ThemePaletteId) => void
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth()
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE)
  const [palette, setPaletteState] = useState<ThemePaletteId>(DEFAULT_THEME_PALETTE)
  const syncedUserIdRef = useRef<number | null>(null)

  const persist = useCallback(
    async (nextMode: ThemeMode, nextPalette: ThemePaletteId) => {
      writeThemeToStorage(nextMode, nextPalette)
      applyThemeToDocument(nextMode, nextPalette)
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

  const applyTheme = useCallback(
    (nextMode: ThemeMode, nextPalette: ThemePaletteId) => {
      setModeState(nextMode)
      setPaletteState(nextPalette)
      void persist(nextMode, nextPalette)
    },
    [persist]
  )

  // Préférence locale immédiate (avant chargement auth)
  useEffect(() => {
    const stored = readThemeFromStorage()
    setModeState(stored.mode)
    setPaletteState(stored.palette)
    applyThemeToDocument(stored.mode, stored.palette)
  }, [])

  // Sync profil serveur uniquement au changement d'utilisateur connecté
  useEffect(() => {
    const uid = user ? Number((user as { id?: number }).id) : null
    if (!uid) {
      syncedUserIdRef.current = null
      const stored = readThemeFromStorage()
      setModeState(stored.mode)
      setPaletteState(stored.palette)
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

    setModeState(resolved.mode)
    setPaletteState(resolved.palette)
    applyThemeToDocument(resolved.mode, resolved.palette)
    writeThemeToStorage(resolved.mode, resolved.palette)
  }, [user])

  const setMode = useCallback(
    (next: ThemeMode) => applyTheme(next, palette),
    [applyTheme, palette]
  )

  const setPalette = useCallback(
    (next: ThemePaletteId) => applyTheme(mode, next),
    [applyTheme, mode]
  )

  const value = useMemo(
    () => ({ mode, palette, setMode, setPalette, applyTheme }),
    [mode, palette, setMode, setPalette, applyTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
