import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, resolveCommunityManagerAccess } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  getCommunitySettingsForManager,
  updateCommunitySettingsForManager,
} from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { isAppSiteManager } = await resolveCommunityManagerAccess(uid)
    const { slug } = await ctx.params
    const settings = await getCommunitySettingsForManager(slug, uid, isAppSiteManager)
    return NextResponse.json({
      settings: {
        ...settings,
        has_avatar: !!(settings.avatar && settings.avatar.length > 20),
      },
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { isAppSiteManager } = await resolveCommunityManagerAccess(uid)
    const { slug } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const updated = await updateCommunitySettingsForManager(slug, uid, isAppSiteManager, {
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
      avatar: body.avatar,
      charter: body.charter,
      listed_public: body.listed_public,
      profile_public: body.profile_public,
    })
    return NextResponse.json({
      settings: {
        ...updated,
        has_avatar: !!(updated.avatar && updated.avatar.length > 20),
      },
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
