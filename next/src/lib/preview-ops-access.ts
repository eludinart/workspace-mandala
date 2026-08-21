/**
 * Accès Vie du lieu (Courses / Logistique / Cercles).
 * - Membres du lieu : lecture + engagement listes + ajout de besoins
 * - Gestionnaires / admin app : + publication cercles, suppressions
 */
import type { NextRequest } from 'next/server'
import {
  ApiError,
  requireAuth,
  resolveCommunityManagerAccess,
  userCanManageInCommunity,
} from './api-auth'
import { getCommunityById, getCommunityBySlug, requireCommunityMembership } from './db-communities'
import type { CommunityRole } from './db-communities'

export async function requirePlaceOpsAccess(
  req: NextRequest,
  communityRef: { communityId?: number | null; communitySlug?: string | null },
  opts?: { manageOnly?: boolean }
): Promise<{
  userId: string
  uid: number
  communityId: number
  role: CommunityRole
  isAppAdmin: boolean
  canManage: boolean
}> {
  const { userId } = await requireAuth(req)
  const uid = parseInt(userId, 10)
  if (!uid) throw new ApiError(401, 'Authentification requise')

  let communityId = communityRef.communityId != null ? Number(communityRef.communityId) : 0
  if (!communityId && communityRef.communitySlug) {
    const c = await getCommunityBySlug(String(communityRef.communitySlug).trim())
    if (!c) throw new ApiError(404, 'Communauté introuvable')
    communityId = c.id
  }
  if (!communityId) throw new ApiError(400, 'community_slug ou community_id requis')

  const community = await getCommunityById(communityId)
  if (!community) throw new ApiError(404, 'Communauté introuvable')

  const { isAppAdmin } = await resolveCommunityManagerAccess(uid)
  let role: CommunityRole = 'member'
  try {
    role = await requireCommunityMembership(uid, communityId)
  } catch (e) {
    if (!isAppAdmin) throw e
  }

  const canManage = isAppAdmin || (await userCanManageInCommunity(uid, role))
  if (opts?.manageOnly && !canManage) {
    throw new ApiError(403, 'Droits gestionnaire requis')
  }

  return { userId, uid, communityId, role, isAppAdmin, canManage }
}

/** @deprecated alias */
export const requirePreviewOpsAccess = requirePlaceOpsAccess
