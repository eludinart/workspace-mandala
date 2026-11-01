import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userCanManageInCommunity } from '@/lib/api-auth'
import { getCommunityBySlug, requireCommunityMembership } from '@/lib/db-communities'
import {
  MAX_CALENDAR_BULK_DAYS,
  setPresence,
  setPresenceMany,
  userCanRegisterPresence,
} from '@/lib/db-calendar'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json()
    const slug = String(body.community_slug ?? '').trim()
    const present = !!body.present
    const rawDays = Array.isArray(body.days) ? body.days : body.day != null ? [body.day] : []
    const days = rawDays.map((d: unknown) => String(d ?? '').trim()).filter(Boolean)
    const targetUserId =
      body.user_id != null && body.user_id !== '' ? parseInt(String(body.user_id), 10) : uid
    if (!slug) return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    if (days.length === 0) return NextResponse.json({ error: 'day requis (YYYY-MM-DD)' }, { status: 400 })
    if (days.length > MAX_CALENDAR_BULK_DAYS) {
      return NextResponse.json({ error: `Maximum ${MAX_CALENDAR_BULK_DAYS} jours` }, { status: 400 })
    }
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ error: 'user_id invalide' }, { status: 400 })
    }
    const community = await getCommunityBySlug(slug)
    if (!community) return NextResponse.json({ error: 'Communauté introuvable' }, { status: 404 })

    let role: Awaited<ReturnType<typeof requireCommunityMembership>> | null = null
    let can_manage = false
    try {
      role = await requireCommunityMembership(uid, community.id)
      can_manage = await userCanManageInCommunity(uid, role)
    } catch {
      /* lieu ami possible — vérifié ci-dessous */
    }

    if (targetUserId !== uid && !can_manage) {
      return NextResponse.json({ error: 'Droits admin requis pour modifier un autre utilisateur' }, { status: 403 })
    }
    if (targetUserId !== uid) {
      await requireCommunityMembership(targetUserId, community.id)
    }

    if (role == null) {
      for (const day of days) {
        const ok = await userCanRegisterPresence({
          userId: targetUserId,
          communityId: community.id,
          day,
          forPresent: present,
        })
        if (!ok) {
          return NextResponse.json(
            { error: 'Inscription réservée aux membres ou aux lieux amis sur une date ouverte' },
            { status: 403 }
          )
        }
      }
    }

    if (days.length > 1) {
      if (targetUserId !== uid) {
        return NextResponse.json({ error: 'La présence groupée ne modifie que votre inscription' }, { status: 400 })
      }
      const res = await setPresenceMany({
        communityId: community.id,
        days,
        userId: uid,
        present,
      })
      return NextResponse.json(res)
    }

    const res = await setPresence({
      communityId: community.id,
      day: days[0],
      userId: targetUserId,
      present,
      bypassDisabled: can_manage && targetUserId !== uid,
    })
    return NextResponse.json(res)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
