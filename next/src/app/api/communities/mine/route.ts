import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { listCommunitiesForUser } from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const items = await listCommunitiesForUser(uid)
    return NextResponse.json({ items })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    const status = e.status ?? (e.message?.toLowerCase().includes('auth') ? 401 : 500)
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status })
  }
}
