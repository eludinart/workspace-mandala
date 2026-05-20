import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createNotification, type NotificationCreateInput } from '@/lib/db-notifications'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const adminId = parseInt(userId, 10)
    const res = await createNotification({
      ...(body as unknown as NotificationCreateInput),
      created_by:
        body.created_by != null ? Number(body.created_by) : Number.isFinite(adminId) ? adminId : null,
    })
    return NextResponse.json({ ok: true, ...res })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
