/**
 * POST /api/place-links/[id]/respond
 * Body: { accept: boolean }
 * Gestionnaire du lieu cible (ou admin app).
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { respondToPlaceLink } from '@/lib/db-place-links'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { id: idRaw } = await ctx.params
    const linkId = parseInt(idRaw, 10)
    if (!linkId) {
      return NextResponse.json({ error: 'id invalide' }, { status: 422 })
    }

    const body = await req.json().catch(() => ({}))
    const accept = Boolean(body.accept)

    let isAppAdmin = false
    try {
      const user = await authMe(uid)
      const role = String(user.app_role || user.wp_role || '').toLowerCase()
      isAppAdmin = role === 'admin' || role === 'administrator'
    } catch {
      /* ignore */
    }

    const link = await respondToPlaceLink({
      userId: uid,
      linkId,
      accept,
      isAppAdmin,
    })

    return NextResponse.json({ ok: true, link })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status =
      e instanceof ApiError
        ? e.status
        : typeof e.status === 'number'
          ? e.status
          : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
