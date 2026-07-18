import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import {
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
  const message = err instanceof Error ? err.message : 'Erreur serveur'
  console.error('[api/admin/communities/[id]]', err)
  return NextResponse.json({ error: message }, { status: fallbackStatus })
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(req)
    const { id: idStr } = await ctx.params
    const id = parseInt(idStr, 10)
    if (!id) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    const community = await getCommunityById(id)
    if (!community) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    const members = await listCommunityMembersAdmin(id)
    return NextResponse.json({ community, members })
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(req)
    const { id: idStr } = await ctx.params
    const id = parseInt(idStr, 10)
    if (!id) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    const body = await req.json().catch(() => ({}))
    const patch: Parameters<typeof updateCommunityAdmin>[1] = {
      slug: body.slug,
      name: body.name,
      tagline: body.tagline,
      description: body.description,
      location: body.location,
      address: body.address,
      postal_code: body.postal_code,
      city: body.city,
      country: body.country,
      website: body.website,
      contact_email: body.contact_email,
      latitude: body.latitude,
      longitude: body.longitude,
      geocode: body.geocode,
      accent_color: body.accent_color,
      logo_emoji: body.logo_emoji,
      is_active: body.is_active,
      listed_public: body.listed_public,
      profile_public: body.profile_public,
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
