import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { getCommunityBySlug, requireCommunityMembership } from '@/lib/db-communities'
import {
  createEvent,
  listEventsForCommunity,
  seedDemoEventsIfEmpty,
  type EventPhase,
} from '@/lib/db-mandala-events'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function isAppAdmin(userId: number): Promise<boolean> {
  try {
    const u = await authMe(userId)
    const r = u.app_role || u.wp_role || ''
    return r === 'admin' || r === 'administrator'
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const slug = req.nextUrl.searchParams.get('community_slug')?.trim()
    if (!slug) {
      return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    }
    const community = await getCommunityBySlug(slug)
    if (!community) {
      return NextResponse.json({ error: 'Communauté introuvable' }, { status: 404 })
    }
    await seedDemoEventsIfEmpty(community.id, uid)
    const events = await listEventsForCommunity(community.id)
    const admin = await isAppAdmin(uid)
    let can_manage = admin
    if (!can_manage) {
      try {
        const role = await requireCommunityMembership(uid, community.id)
        can_manage = role === 'organizer' || role === 'admin'
      } catch {
        can_manage = false
      }
    }
    return NextResponse.json({ events, can_manage })
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
    const admin = await isAppAdmin(uid)
    const event = await createEvent({
      userId: uid,
      communitySlug: String(body.community_slug ?? '').trim(),
      isAppAdmin: admin,
      title: String(body.title ?? ''),
      description: body.description != null ? String(body.description) : undefined,
      location: body.location != null ? String(body.location) : undefined,
      starts_at: body.starts_at != null ? String(body.starts_at) : undefined,
      ends_at: body.ends_at != null ? String(body.ends_at) : undefined,
      phase: body.phase as EventPhase | undefined,
    })
    return NextResponse.json({ event })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
