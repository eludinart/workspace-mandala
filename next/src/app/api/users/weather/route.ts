import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import {
  getCommunityBySlug,
  requireCommunityMembership,
} from '@/lib/db-communities'
import { getUserWeatherForCommunity, setUserWeatherForCommunity } from '@/lib/db-weather'
import { isWeatherStatus } from '@/lib/weather-status'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function resolveCommunityId(req: NextRequest): Promise<number> {
  const communityIdParam = req.nextUrl.searchParams.get('communityId')?.trim()
  const communitySlug = req.nextUrl.searchParams.get('community_slug')?.trim()
  if (communityIdParam) {
    const id = parseInt(communityIdParam, 10)
    if (!id || id < 1) throw Object.assign(new Error('communityId invalide'), { status: 400 })
    return id
  }
  if (communitySlug) {
    const c = await getCommunityBySlug(communitySlug)
    if (!c) throw Object.assign(new Error('Communauté introuvable'), { status: 404 })
    return c.id
  }
  throw Object.assign(new Error('communityId ou community_slug requis'), { status: 400 })
}

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ weather: null }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const communityId = await resolveCommunityId(req)
    await requireCommunityMembership(uid, communityId)
    const weather = await getUserWeatherForCommunity(uid, communityId)
    return NextResponse.json({ community_id: communityId, weather })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json()
    let communityId = parseInt(String(body.community_id ?? body.communityId ?? ''), 10)
    if (!communityId && body.community_slug) {
      const c = await getCommunityBySlug(String(body.community_slug).trim())
      if (!c) return NextResponse.json({ error: 'Communauté introuvable' }, { status: 404 })
      communityId = c.id
    }
    if (!communityId || communityId < 1) {
      return NextResponse.json({ error: 'community_id requis' }, { status: 400 })
    }
    const status = String(body.weather_status ?? body.status ?? '').trim()
    if (!isWeatherStatus(status)) {
      return NextResponse.json({ error: 'weather_status invalide' }, { status: 400 })
    }
    await requireCommunityMembership(uid, communityId)
    const weather = await setUserWeatherForCommunity(
      uid,
      communityId,
      status,
      body.weather_note != null ? String(body.weather_note) : undefined
    )
    return NextResponse.json({ community_id: communityId, weather })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
