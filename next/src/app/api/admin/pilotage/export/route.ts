import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import {
  buildAdminPilotageDashboard,
  normalizePilotageDays,
  pilotageActivityToCsv,
  pilotageSeriesToCsv,
} from '@/lib/db-admin-pilotage'

export const dynamic = 'force-dynamic'

/** Export CSV Pilotage (`kind=activity|series`). */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const days = normalizePilotageDays(req.nextUrl.searchParams.get('days'))
    const kind = (req.nextUrl.searchParams.get('kind') || 'activity').toLowerCase()
    const data = await buildAdminPilotageDashboard(days)
    const csv =
      kind === 'series' ? pilotageSeriesToCsv(data.series) : pilotageActivityToCsv(data.activity)
    const filename = `mandala-pilotage-${kind}-${days}d.csv`
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
