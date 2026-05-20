import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { joinCommunity } from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json().catch(() => ({}))
    const slug = String(body.slug ?? '').trim()
    if (!slug) {
      return NextResponse.json({ error: 'slug requis' }, { status: 400 })
    }
    const community = await joinCommunity({ userId: uid, slug })
    return NextResponse.json({ community })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
