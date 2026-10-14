import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { listDesignateSlots } from '@/lib/db-returns'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { userId } = await requireAuth(req)
    const companion = parseInt(req.nextUrl.searchParams.get('companion_user_id') ?? '', 10)
    if (!companion) return NextResponse.json({ error: 'Personne requise' }, { status: 400 })
    const slots = await listDesignateSlots(parseInt(userId, 10), companion)
    return NextResponse.json({ slots })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
