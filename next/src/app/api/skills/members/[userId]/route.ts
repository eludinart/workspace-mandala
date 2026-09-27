import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getVisibleSkillCard } from '@/lib/db-skills'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const { userId: subject } = await ctx.params
    const subjectId = parseInt(subject, 10)
    if (!subjectId) return NextResponse.json({ error: 'Membre introuvable' }, { status: 400 })
    const card = await getVisibleSkillCard(parseInt(userId, 10), subjectId)
    if (!card) return NextResponse.json({ error: 'Fiche non visible' }, { status: 404 })
    return NextResponse.json({ card })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
