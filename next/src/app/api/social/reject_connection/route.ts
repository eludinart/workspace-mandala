import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { rejectSeedConnection } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const seedId = parseInt(String(body.seedId ?? body.seed_id ?? 0), 10)
    if (!seedId) {
      return NextResponse.json({ error: 'seedId requis' }, { status: 400 })
    }
    const rejectorUserId = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ status: 'ok' })
    }
    await rejectSeedConnection({ seedId, rejectorUserId })
    return NextResponse.json({ status: 'ok' })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
