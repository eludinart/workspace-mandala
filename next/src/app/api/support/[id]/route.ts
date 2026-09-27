import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import { updateSupportReportStatus, type SupportStatus } from '@/lib/db-support'

export const dynamic = 'force-dynamic'

const STATUSES = new Set<SupportStatus>(['new', 'read', 'done'])

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req)
    const { id: raw } = await ctx.params
    const id = parseInt(raw, 10)
    if (!id) return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })
    const body = await req.json().catch(() => ({}))
    const status = body.status as SupportStatus
    if (!STATUSES.has(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }
    const ok = await updateSupportReportStatus(id, status)
    if (!ok) return NextResponse.json({ error: 'Retour introuvable' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Erreur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
