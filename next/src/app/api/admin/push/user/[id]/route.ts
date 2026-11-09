import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import { listPushDevicesForUser } from '@/lib/db-push'
import { listPushSendsForUser } from '@/lib/db-push-receipts'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req)
    const { id } = await ctx.params
    const userId = parseInt(id, 10)
    if (!userId) {
      return NextResponse.json({ error: 'user id invalide' }, { status: 400 })
    }
    const [devices, sends] = await Promise.all([
      listPushDevicesForUser(userId),
      listPushSendsForUser(userId, 40),
    ])
    return NextResponse.json({ user_id: userId, devices, sends })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
