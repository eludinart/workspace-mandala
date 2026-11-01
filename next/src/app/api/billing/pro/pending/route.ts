/**
 * GET /api/billing/pro/pending
 * Admin : toute la file. Gestionnaire : pending membres de ses lieux.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import {
  listManagedCommunityIds,
  listPendingProProfiles,
  listPendingProProfilesForCommunities,
} from '@/lib/db-billing'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)

    let isAdmin = false
    try {
      const user = await authMe(uid)
      const role = String(user.app_role || user.wp_role || '').toLowerCase()
      isAdmin = role === 'admin' || role === 'administrator'
    } catch {
      /* ignore */
    }

    if (isAdmin) {
      const pending = await listPendingProProfiles()
      return NextResponse.json({ pending, scope: 'admin' })
    }

    const managed = await listManagedCommunityIds(uid)
    if (!managed.length) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const pending = await listPendingProProfilesForCommunities(managed)
    return NextResponse.json({ pending, scope: 'place_manager' })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
