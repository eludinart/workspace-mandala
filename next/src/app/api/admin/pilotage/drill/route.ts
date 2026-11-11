import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import { buildPilotageDrill, parseDrillQuery } from '@/lib/db-admin-pilotage-drill'

export const dynamic = 'force-dynamic'

/** Liste drill-down Pilotage (cohortes / jour / lieu / alerte). */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const q = parseDrillQuery(req.nextUrl.searchParams)
    const data = await buildPilotageDrill({
      kind: q.kind,
      days: q.days,
      day: q.day,
      metric: q.metric,
      communityId: q.communityId,
      alertId: q.alertId,
      cursor: q.cursor,
      limit: q.limit,
    })
    return NextResponse.json({ ok: true, ...data })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : typeof e.status === 'number' ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
