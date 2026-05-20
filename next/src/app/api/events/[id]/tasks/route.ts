import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { addEventTask, type EventPhase } from '@/lib/db-mandala-events'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function isAppAdmin(userId: number): Promise<boolean> {
  try {
    const u = await authMe(userId)
    const r = u.app_role || u.wp_role || ''
    return r === 'admin' || r === 'administrator'
  } catch {
    return false
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { id } = await ctx.params
    const eventId = parseInt(id, 10)
    const body = await req.json()
    if (!eventId) return NextResponse.json({ error: 'id invalide' }, { status: 400 })

    const admin = await isAppAdmin(uid)
    const taskId = await addEventTask({
      userId: uid,
      eventId,
      title: String(body.title ?? ''),
      phase: body.phase as EventPhase | undefined,
      isAppAdmin: admin,
    })
    return NextResponse.json({ task_id: taskId })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
