import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { respondToMeeting } from '@/lib/db-directory'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as { request_id?: number; accept?: boolean }
    const requestId = Number(body.request_id ?? 0)
    const status = await respondToMeeting(parseInt(userId, 10), requestId, body.accept === true)
    return NextResponse.json(status)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
