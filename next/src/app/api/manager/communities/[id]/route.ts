import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireCommunityManagerActor } from '@/lib/api-auth'
import {
  assertUserCanManageCommunity,
  getCommunityById,
  listCommunityMembersAdmin,
  updateCommunityAdmin,
} from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

function apiErrorResponse(err: unknown, fallbackStatus = 500) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  const status = (err as { status?: number }).status ?? fallbackStatus
  const message = err instanceof Error ? err.message : 'Erreur serveur'
  console.error('[api/manager/communities/[id]]', err)
  return NextResponse.json({ error: message }, { status })
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { uid, isAppSiteManager } = await requireCommunityManagerActor(req)
    const { id: idStr } = await ctx.params
    const id = parseInt(idStr, 10)
    if (!id) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    await assertUserCanManageCommunity(uid, id, { isAppSiteManager })
    const community = await getCommunityById(id)
    if (!community) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    const members = await listCommunityMembersAdmin(id)
    const { avatar, ...rest } = community
    return NextResponse.json({
      community: { ...rest, has_avatar: !!(avatar && avatar.length > 20) },
      members,
    })
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { uid, isAppSiteManager } = await requireCommunityManagerActor(req)
    const { id: idStr } = await ctx.params
    const id = parseInt(idStr, 10)
    if (!id) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    await assertUserCanManageCommunity(uid, id, { isAppSiteManager })
    const body = await req.json().catch(() => ({}))
    const patch: Parameters<typeof updateCommunityAdmin>[1] = {
      name: body.name,
      tagline: body.tagline,
      description: body.description,
      location: body.location,
      website: body.website,
      contact_email: body.contact_email,
      accent_color: body.accent_color,
      logo_emoji: body.logo_emoji,
    }
    if (Object.prototype.hasOwnProperty.call(body, 'avatar')) {
      patch.avatar = body.avatar
    }
    const community = await updateCommunityAdmin(id, patch)
    const { avatar, ...rest } = community
    return NextResponse.json({
      community: {
        ...rest,
        avatar: avatar ? 'set' : null,
        has_avatar: !!(avatar && avatar.length > 20),
      },
    })
  } catch (err: unknown) {
    return apiErrorResponse(err, 400)
  }
}
