import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { createSkillNote, listVisibleSkillNotes } from '@/lib/db-skills'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '40', 10)
    const notes = await listVisibleSkillNotes(parseInt(userId, 10), Number.isFinite(limit) ? limit : 40)
    return NextResponse.json({ notes })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as { content?: unknown }
    const note = await createSkillNote(parseInt(userId, 10), String(body.content ?? ''))
    return NextResponse.json({ note })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
