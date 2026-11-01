/**
 * PATCH /api/moderation/reports/[id] — statut admin
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import { updateContentReportStatus, type ContentReportStatus } from '@/lib/db-moderation'

export const dynamic = 'force-dynamic'

const STATUSES: ContentReportStatus[] = ['new', 'reviewing', 'actioned', 'dismissed']

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAdmin(req)
    const { id: raw } = await ctx.params
    const id = parseInt(raw, 10)
    if (!id) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    const body = await req.json().catch(() => ({}))
    const status = body.status as ContentReportStatus
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: 'status invalide' }, { status: 422 })
    }
    const ok = await updateContentReportStatus(id, status, parseInt(userId, 10))
    if (!ok) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
