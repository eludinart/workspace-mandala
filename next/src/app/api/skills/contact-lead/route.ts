/**
 * POST /api/skills/contact-lead — notifie un Pro qu’un membre l’a contacté depuis l’annuaire.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { isDbConfigured } from '@/lib/db'
import { notifyProSkillContact } from '@/lib/db-skills'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const proUserId = parseInt(String(body.pro_user_id ?? ''), 10)
    if (!proUserId) {
      return NextResponse.json({ error: 'pro_user_id requis' }, { status: 422 })
    }
    let fromLabel = 'Un membre Mandala'
    try {
      const me = await authMe(parseInt(userId, 10))
      fromLabel =
        String(me.name || me.pseudo || me.email || '').trim() || fromLabel
    } catch {
      /* ignore */
    }
    await notifyProSkillContact({
      proUserId,
      fromUserId: parseInt(userId, 10),
      fromLabel,
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
