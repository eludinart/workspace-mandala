import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { updateUserAppRole } from '@/lib/db-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const id = Number(body.id ?? body.user_id ?? 0)
    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }
    if (body.app_role !== undefined) {
      await updateUserAppRole(id, String(body.app_role))
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 401 })
  }
}
