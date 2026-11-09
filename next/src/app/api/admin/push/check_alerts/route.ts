import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import { runPushDeliveryAlertCheck } from '@/lib/push-admin-alerts'

export const dynamic = 'force-dynamic'

/** Déclenche manuellement le check seuil + purge (app admin). */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const result = await runPushDeliveryAlertCheck()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
