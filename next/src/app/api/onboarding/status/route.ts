import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getOnboardingStatus } from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        { needs_place_selection: true, pending_charter_slugs: [] },
        { status: 503 }
      )
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const status = await getOnboardingStatus(uid)
    return NextResponse.json(status)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 401 })
  }
}
