/**
 * POST /api/notifications/delete_read
 * Efface les notifications lues (delivery.read_at != null) pour l'utilisateur connecté.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { deleteRead } from '@/lib/db-notifications'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)

    if (!isDbConfigured()) {
      return NextResponse.json({ ok: true })
    }

    await deleteRead(uid)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

