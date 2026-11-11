import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import {
  buildAdminPilotageDashboard,
  normalizePilotageDays,
} from '@/lib/db-admin-pilotage'

export const dynamic = 'force-dynamic'

/** Dashboard Pilotage produit + santé serveur/app. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const days = normalizePilotageDays(req.nextUrl.searchParams.get('days'))
    const data = await buildAdminPilotageDashboard(days)
    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      ...data,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
