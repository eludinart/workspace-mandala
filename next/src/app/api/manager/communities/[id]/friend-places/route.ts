/**
 * GET /api/manager/communities/[id]/friend-places — lieux amis (+ demandes) du lieu.
 * Porte `lieux_lies` + droits gestionnaire.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireCommunityManagerActor } from '@/lib/api-auth'
import { assertUserCanManageCommunity } from '@/lib/db-communities'
import { canAccessFeatureDoor } from '@/lib/db-feature-doors'
import { listPlaceFriendLinksForCommunity } from '@/lib/db-place-links'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { uid, isAppSiteManager } = await requireCommunityManagerActor(req)
    const { id: idStr } = await ctx.params
    const id = parseInt(idStr, 10)
    if (!id) return NextResponse.json({ error: 'id invalide' }, { status: 400 })

    await assertUserCanManageCommunity(uid, id, { isAppSiteManager })

    const doorOk = await canAccessFeatureDoor(uid, 'lieux_lies')
    if (!doorOk) {
      return NextResponse.json({ error: 'Fonction non disponible' }, { status: 403 })
    }

    const items = await listPlaceFriendLinksForCommunity(id)
    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        other: {
          ...item.other,
          has_avatar: !!(item.other.avatar && item.other.avatar.length > 20),
          avatar: undefined,
        },
      })),
    })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const status = (err as { status?: number }).status ?? 500
    const message = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: message }, { status })
  }
}
