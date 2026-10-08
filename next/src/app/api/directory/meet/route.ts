import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getMeetStatus, requestMeeting } from '@/lib/db-directory'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ mode: 'none' }, { status: 503 })
    const { userId } = await requireAuth(req)
    const target = parseInt(req.nextUrl.searchParams.get('user_id') ?? '', 10)
    if (!target) return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    const status = await getMeetStatus(parseInt(userId, 10), target)
    return NextResponse.json(status)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as { target_user_id?: number }
    const target = Number(body.target_user_id ?? 0)
    const status = await requestMeeting(parseInt(userId, 10), target)
    return NextResponse.json(status)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
