import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import { buildAdminLoadDashboard } from '@/lib/admin-load-alerts'

export const dynamic = 'force-dynamic'

/** Dashboard charge + alertes admin (mémoire process + overview push). */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const data = await buildAdminLoadDashboard()
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
