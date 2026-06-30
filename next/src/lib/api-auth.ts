/**
 * Helpers pour les routes API (JWT, user_id).
 *
 * Priorité de lecture du token :
 *   1. Cookie httpOnly `auth_token` (navigateurs web — protection XSS)
 *   2. Header `Authorization: Bearer` (Capacitor / Android standalone)
 */
import { NextRequest } from 'next/server'
import { jwtDecode, jwtDecodeForRefresh } from './jwt'
import { authMe } from './db-auth'
import { isMandalaAdminEmail } from './admin-emails'
import { isSiteManagerAppRole } from './app-roles'
import { canManageCommunityInContext, canOrganizeCommunityEvents, type CommunityRole } from './db-communities'
import { getTokenFromCookie } from './auth-cookie'

export function getAuthHeader(req: NextRequest): string | null {
  // 1. Cookie httpOnly (web) — inaccessible au JS, priorité absolue
  const cookieToken = getTokenFromCookie(req)
  if (cookieToken) return cookieToken
  // 2. Bearer header (Capacitor / mobile fallback)
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

function decodeToken(token: string) {
  return jwtDecode(token) ?? jwtDecodeForRefresh(token)
}

export function getUserIdFromRequest(req: NextRequest): string | null {
  const token = getAuthHeader(req)
  if (!token) return null
  const payload = decodeToken(token)
  if (!payload?.sub) return null
  return String(payload.sub)
}

export async function requireAuth(req: NextRequest): Promise<{ userId: string }> {
  const userId = getUserIdFromRequest(req)
  if (!userId) {
    throw new ApiError(401, 'Authentification requise')
  }
  return { userId }
}

export async function requireAdmin(req: NextRequest): Promise<{ userId: string }> {
  const token = getAuthHeader(req)
  if (!token) throw new ApiError(401, 'Authentification requise')
  const payload = decodeToken(token)
  if (!payload?.sub) throw new ApiError(401, 'Token invalide')
  const userId = String(payload.sub)

  const role = (payload.role as string) ?? ''
  if (role === 'admin' || role === 'administrator') {
    return { userId }
  }

  // Vérifier en base si le rôle a été mis à jour (ex. admin accordé après le login)
  try {
    const user = await authMe(parseInt(userId, 10))
    const dbRole = user.app_role || user.wp_role || ''
    if (dbRole === 'admin' || dbRole === 'administrator') {
      return { userId }
    }
  } catch {
    // authMe échoue (DB non dispo, user inexistant) → on garde le rejet
  }

  throw new ApiError(403, 'Accès administrateur requis')
}

export async function requireAdminOrSiteManager(
  req: NextRequest
): Promise<{ userId: string; isAdmin: boolean; isSiteManager: boolean }> {
  const token = getAuthHeader(req)
  if (!token) throw new ApiError(401, 'Authentification requise')
  const payload = decodeToken(token)
  if (!payload?.sub) throw new ApiError(401, 'Token invalide')
  const userId = String(payload.sub)

  const role = String(payload.role ?? '').toLowerCase()
  if (role === 'admin' || role === 'administrator') {
    return { userId, isAdmin: true, isSiteManager: true }
  }
  if (role === 'site_manager' || role === 'coach') {
    return { userId, isAdmin: false, isSiteManager: true }
  }

  try {
    const user = await authMe(parseInt(userId, 10))
    const dbRole = String(user.app_role || user.wp_role || '').toLowerCase()
    if (dbRole === 'admin' || dbRole === 'administrator') {
      return { userId, isAdmin: true, isSiteManager: true }
    }
    if (dbRole === 'site_manager' || dbRole === 'coach') {
      return { userId, isAdmin: false, isSiteManager: true }
    }
  } catch {
    // authMe échoue
  }

  throw new ApiError(403, 'Accès gestionnaire ou administrateur requis')
}

/** @deprecated utiliser requireAdminOrSiteManager */
export const requireAdminOrCoach = requireAdminOrSiteManager

export async function requireUserManagementAccess(
  req: NextRequest,
  targetUserId: number,
  communitySlug?: string | null
): Promise<{ userId: string; isAdmin: boolean }> {
  const token = getAuthHeader(req)
  if (!token) throw new ApiError(401, 'Authentification requise')
  const payload = decodeToken(token)
  if (!payload?.sub) throw new ApiError(401, 'Token invalide')
  const userId = String(payload.sub)
  const actorId = parseInt(userId, 10)

  let isAdmin = false
  const role = String(payload.role ?? '').toLowerCase()
  if (role === 'admin' || role === 'administrator') {
    isAdmin = true
  } else {
    try {
      const user = await authMe(actorId)
      const dbRole = String(user.app_role || user.wp_role || '').toLowerCase()
      if (dbRole === 'admin' || dbRole === 'administrator') isAdmin = true
    } catch {
      /* ignore */
    }
  }

  if (isAdmin) return { userId, isAdmin: true }

  const { actorCanManageTargetUser } = await import('./user-admin-access')
  const allowed = await actorCanManageTargetUser(actorId, targetUserId, {
    isAppAdmin: false,
    communitySlug,
  })
  if (!allowed) {
    throw new ApiError(403, 'Accès refusé pour gérer ce membre')
  }
  return { userId, isAdmin: false }
}

export type CommunityManagerAccess = {
  isAppAdmin: boolean
  isAppSiteManager: boolean
}

/** Droits gestionnaire de lieu (indépendant du mode « administrateur » affiché). */
export async function resolveCommunityManagerAccess(userId: number): Promise<CommunityManagerAccess> {
  try {
    const u = await authMe(userId)
    const email = String(u.email ?? '')
    if (isMandalaAdminEmail(email)) return { isAppAdmin: true, isAppSiteManager: true }
    const r = String(u.app_role || u.wp_role || '').toLowerCase()
    if (r === 'admin' || r === 'administrator') return { isAppAdmin: true, isAppSiteManager: true }
    if (isSiteManagerAppRole(r)) return { isAppAdmin: false, isAppSiteManager: true }
  } catch {
    /* ignore */
  }
  return { isAppAdmin: false, isAppSiteManager: false }
}

export async function requireCommunityManagerActor(
  req: NextRequest
): Promise<{ userId: string; uid: number } & CommunityManagerAccess> {
  const { userId } = await requireAuth(req)
  const uid = parseInt(userId, 10)
  const access = await resolveCommunityManagerAccess(uid)
  return { userId, uid, ...access }
}

/** Droits de gestion sur le lieu actif (rôle communauté + éventuel site_manager app). */
export async function userCanManageInCommunity(
  userId: number,
  communityRole: CommunityRole
): Promise<boolean> {
  const { isAppSiteManager } = await resolveCommunityManagerAccess(userId)
  return canManageCommunityInContext(communityRole, isAppSiteManager)
}

/** Création / modification d’événements sur le lieu actif. */
export async function userCanOrganizeEventsInCommunity(
  userId: number,
  communityRole: CommunityRole
): Promise<boolean> {
  const { isAppAdmin } = await resolveCommunityManagerAccess(userId)
  return isAppAdmin || canOrganizeCommunityEvents(communityRole)
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}
