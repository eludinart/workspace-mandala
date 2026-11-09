import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { canAccessFeatureDoor } from '@/lib/db-feature-doors'
import {
  getMemberCityProfile,
  listCommunityMemberMapMarkers,
  listCommunityMemberMapPins,
  saveMemberCityProfile,
} from '@/lib/db-member-city'
import { getCommunityBySlug } from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const slug = req.nextUrl.searchParams.get('community_slug')?.trim() ?? ''
    const profile = await getMemberCityProfile(uid)
    let markers: Awaited<ReturnType<typeof listCommunityMemberMapMarkers>> = []
    let pins: Awaited<ReturnType<typeof listCommunityMemberMapPins>> = []
    const doorOk = await canAccessFeatureDoor(uid, 'carte_membres')
    if (doorOk && slug) {
      const community = await getCommunityBySlug(slug)
      if (community) {
        markers = await listCommunityMemberMapMarkers(community.id)
        pins = await listCommunityMemberMapPins(community.id)
      }
    }
    return NextResponse.json({
      profile,
      door_open: doorOk,
      markers: doorOk ? markers : [],
      pins: doorOk ? pins : [],
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json().catch(() => ({}))) as {
      city?: string
      show_on_map?: boolean
      skip_prompt?: boolean
    }
    const profile = await saveMemberCityProfile(uid, body)
    return NextResponse.json({ profile })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
