import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import { listCommunitiesAdmin } from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const items = (await listCommunitiesAdmin()).map((c) => {
      const { avatar, ...rest } = c
      return { ...rest, has_avatar: !!(avatar && avatar.length > 20) }
    })
    return NextResponse.json({ items })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, items: [] }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur'
    console.error('[api/admin/communities]', err)
    return NextResponse.json({ error: message, items: [] }, { status: 500 })
  }
}
