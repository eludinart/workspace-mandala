import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getReturnsOpen, setReturnsOpen } from '@/lib/db-returns'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { userId } = await requireAuth(req)
    const open = await getReturnsOpen(parseInt(userId, 10))
    return NextResponse.json({ open })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 401 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as { open?: unknown }
    const open = await setReturnsOpen(parseInt(userId, 10), body.open === true || body.open === 1 || body.open === '1')
    return NextResponse.json({ open })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
