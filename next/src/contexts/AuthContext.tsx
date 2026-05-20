'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { authApi } from '@/api/auth'
import { isCapacitor } from '@/lib/api-client'
import { isMandalaAdminEmail } from '@/lib/admin-emails'
import {
  type ActingRole,
  readActingRoleFromStorage,
  writeActingRoleToStorage,
} from '@/lib/acting-role'

type User = Record<string, unknown> | null

type AuthContextValue = {
  user: User
  loading: boolean
  login: (loginId: string, password: string) => Promise<User>
  register: (email: string, password: string, name?: string, inviteToken?: string) => Promise<User>
  logout: () => void
  refreshUser: () => Promise<void>
  /** Administrateur réel (droits serveur complets). */
  isRealAdmin: boolean
  /** Rôle choisi pour prévisualiser l’interface. */
  actingRole: ActingRole
  setActingRole: (role: ActingRole) => void
  /** Afficher menus / page Admin. */
  showAdminUi: boolean
  /** Compat : équivalent à showAdminUi pour la navigation admin. */
  isAdmin: boolean
  isCoach: boolean
  roleSummary: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000

function computeIsRealAdmin(user: User): boolean {
  const norm = (v: unknown) => (v == null ? '' : String(v).trim().toLowerCase())
  const email = String((user as { email?: string })?.email ?? '')
  if (isMandalaAdminEmail(email)) return true
  const appRole = norm(user?.app_role)
  const wpRole = norm(user?.wp_role)
  const jwtRole = norm(user?.role)
  return appRole === 'admin' || wpRole === 'administrator' || jwtRole === 'admin'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)
  const [actingRole, setActingRoleState] = useState<ActingRole>('admin')
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const isRealAdmin = useMemo(() => computeIsRealAdmin(user), [user])

  useEffect(() => {
    if (!isRealAdmin) return
    setActingRoleState(readActingRoleFromStorage())
  }, [isRealAdmin, user])

  const setActingRole = useCallback((role: ActingRole) => {
    setActingRoleState(role)
    writeActingRoleToStorage(role)
  }, [])

  const scheduleRefresh = useCallback((doForceLogout: () => void) => {
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = setInterval(async () => {
      try {
        const { token } = (await authApi.refresh()) as { token: string }
        if (token && isCapacitor() && typeof window !== 'undefined') {
          localStorage.setItem('auth_token', token)
        }
      } catch {
        doForceLogout()
      }
    }, REFRESH_INTERVAL_MS)
  }, [])

  const forceLogout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
    setUser(null)
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = null
  }, [])

  const bootstrap = useCallback(async () => {
    if (typeof window === 'undefined') {
      setLoading(false)
      return
    }
    const hasSessionHint =
      !!localStorage.getItem('auth_user') ||
      (isCapacitor() && !!localStorage.getItem('auth_token'))
    if (!hasSessionHint) {
      setLoading(false)
      return
    }
    try {
      const u = (await Promise.race([
        authApi.me() as Promise<Record<string, unknown>>,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Connexion au serveur trop lente')), 20_000)
        ),
      ])) as Record<string, unknown>
      if (computeIsRealAdmin(u)) {
        ;(u as Record<string, unknown>).app_role = 'admin'
      }
      setUser(u)
      localStorage.setItem('auth_user', JSON.stringify(u))
      if (computeIsRealAdmin(u)) {
        setActingRoleState(readActingRoleFromStorage())
      }
      scheduleRefresh(forceLogout)
    } catch {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    } finally {
      setLoading(false)
    }
  }, [scheduleRefresh, forceLogout])

  useEffect(() => {
    bootstrap()
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current)
    }
  }, [bootstrap])

  const login = async (loginId: string, password: string) => {
    const { token, user: u } = (await authApi.login(loginId, password)) as {
      token: string
      user: Record<string, unknown>
    }
    if (typeof window !== 'undefined') {
      if (isCapacitor()) localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(u))
      if (u?.id) sessionStorage.setItem(`push_just_logged_in_${u.id}`, '1')
    }
    if (computeIsRealAdmin(u)) {
      ;(u as Record<string, unknown>).app_role = 'admin'
      setActingRole('admin')
    }
    setUser(u)
    scheduleRefresh(forceLogout)
    return u
  }

  const register = async (email: string, password: string, name = '', inviteToken?: string) => {
    const { token, user: u } = (await authApi.register(email, password, name, inviteToken)) as {
      token: string
      user: Record<string, unknown>
    }
    if (typeof window !== 'undefined') {
      if (isCapacitor()) localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(u))
      if (u?.id) sessionStorage.setItem(`push_just_logged_in_${u.id}`, '1')
      try {
        sessionStorage.setItem('mdl_post_register_onboarding', '1')
      } catch {
        /* ignore */
      }
    }
    setUser(u)
    scheduleRefresh(forceLogout)
    return u
  }

  const logout = () => {
    authApi.logout().catch(() => {})
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
    setUser(null)
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = null
  }

  const refreshUser = useCallback(async () => {
    try {
      const u = (await authApi.me()) as Record<string, unknown>
      if (computeIsRealAdmin(u)) {
        ;(u as Record<string, unknown>).app_role = 'admin'
      }
      setUser(u)
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_user', JSON.stringify(u))
      }
    } catch {
      /* ignore */
    }
  }, [])

  const showAdminUi = isRealAdmin && actingRole === 'admin'
  const isCoach =
    actingRole === 'coach' || (isRealAdmin && actingRole === 'admin') || (!isRealAdmin && String(user?.app_role) === 'coach')

  const roleSummary = useMemo(() => {
    if (!isRealAdmin) return ''
    const email = String((user as { email?: string })?.email ?? '')
    const real = `Compte admin réel (${email})`
    if (actingRole === 'admin') {
      return `${real} — tous les droits (utilisateurs, annonces, télémétrie, communautés).`
    }
    if (actingRole === 'coach') {
      return `${real} — vue coach : messagerie et fonctions coach, sans panneau admin.`
    }
    return `${real} — vue utilisateur standard ; les API admin restent disponibles côté serveur.`
  }, [isRealAdmin, actingRole, user])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        isRealAdmin,
        actingRole,
        setActingRole,
        showAdminUi,
        isAdmin: showAdminUi,
        isCoach,
        roleSummary,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
