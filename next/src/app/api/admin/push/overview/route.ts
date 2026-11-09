import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import { getPushOverview } from '@/lib/db-push-receipts'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const rangeParam = req.nextUrl.searchParams.get('range')
    const range = rangeParam === '7d' ? '7d' : '24h'
    const overview = await getPushOverview(range)
    return NextResponse.json(overview)
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
