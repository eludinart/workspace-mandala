import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireCommunityManagerActor } from '@/lib/api-auth'
import { listCommunitiesManagedByUser } from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireCommunityManagerActor(req)
    const items = (await listCommunitiesManagedByUser(uid)).map((c) => {
      const { avatar, ...rest } = c
      return { ...rest, has_avatar: !!(avatar && avatar.length > 20) }
    })
    return NextResponse.json({ items })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, items: [] }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur'
    console.error('[api/manager/communities]', err)
    return NextResponse.json({ error: message, items: [] }, { status: 500 })
  }
}
