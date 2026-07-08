/**
 * POST /api/social/add_group_members
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { addMembersToGroupChannel } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = (await req.json()) as {
      channelId?: number
      channel_id?: number
      member_user_ids?: number[]
      memberUserIds?: number[]
    }
    const channelId = Number(body.channelId ?? body.channel_id ?? 0)
    const memberUserIds = body.member_user_ids ?? body.memberUserIds ?? []

    if (!channelId) return NextResponse.json({ error: 'channelId requis' }, { status: 400 })
    if (!Array.isArray(memberUserIds) || memberUserIds.length === 0) {
      return NextResponse.json({ error: 'member_user_ids requis' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ channelId, memberIds: memberUserIds })
    }

    const result = await addMembersToGroupChannel({
      channelId,
      userId: uid,
      memberUserIds,
    })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
