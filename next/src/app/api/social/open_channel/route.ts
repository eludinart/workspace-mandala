/**
 * POST /api/social/open_channel — ouvre ou crée un dialogue 1:1.
 * Même lieu : OK. Hors lieu : porte `seuil` + date commune (ou conversation déjà ouverte).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import {
  getCommunityBySlug,
  getCommunityMembership,
  requireCommunityMembership,
} from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'
import { openDirectChannel } from '@/lib/db-social'
import { canMessageUnderSeuil } from '@/lib/db-seuil'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json()) as {
      target_user_id?: number
      targetUserId?: number
      community_slug?: string
    }
    const targetUserId = Number(body.target_user_id ?? body.targetUserId ?? 0)
    const slug = String(body.community_slug ?? '').trim()

    if (!targetUserId) {
      return NextResponse.json({ error: 'target_user_id requis' }, { status: 400 })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ channelId: 1 }, { status: 200 })
    }

    let communityId: number | undefined
    if (slug) {
      const community = await getCommunityBySlug(slug)
      if (!community) {
        return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
      }
      try {
        await requireCommunityMembership(uid, community.id)
        await getCommunityMembership(targetUserId, community.id)
        communityId = community.id
      } catch {
        communityId = undefined
      }
    }

    if (communityId == null) {
      const gate = await canMessageUnderSeuil(uid, targetUserId)
      if (!gate.ok) {
        return NextResponse.json({ error: gate.reason ?? 'Conversation refusée' }, { status: 403 })
      }
      const { channelId } = await openDirectChannel(uid, targetUserId)
      return NextResponse.json({ channelId })
    }

    const { channelId } = await openDirectChannel(uid, targetUserId, communityId)
    return NextResponse.json({ channelId })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
