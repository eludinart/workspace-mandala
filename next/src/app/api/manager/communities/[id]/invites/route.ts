import { NextRequest, NextResponse } from 'next/server'
import { requireCommunityManagerActor } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import {
  assertUserCanManageCommunity,
  buildCommunityInvitePath,
  ensureCommunityInviteAccess,
  listUsersNotInCommunity,
} from '@/lib/db-communities'
import {
  buildPlaceInviteEmailBody,
  isTransactionalEmailConfigured,
  resolvePublicAppOrigin,
  sendTransactionalEmail,
} from '@/lib/mandala-mail'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

function invitePayload(
  invite: Awaited<ReturnType<typeof ensureCommunityInviteAccess>>,
  origin: string
) {
  const path = buildCommunityInvitePath(invite.slug, invite.invite_code)
  return {
    slug: invite.slug,
    name: invite.name,
    invite_code: invite.invite_code,
    join_mode: invite.join_mode,
    join_mode_changed: invite.join_mode_changed,
    path,
    url: `${origin}${path}`,
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { uid, isAppSiteManager } = await requireCommunityManagerActor(req)
    const { id: idStr } = await ctx.params
    const communityId = parseInt(idStr, 10)
    if (!communityId) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    await assertUserCanManageCommunity(uid, communityId, { isAppSiteManager })

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    const candidates = await listUsersNotInCommunity({
      communityId,
      search: q,
      limit: 40,
    })
    const invite = await ensureCommunityInviteAccess(communityId)
    const origin = resolvePublicAppOrigin(req.nextUrl.origin)
    return NextResponse.json({
      candidates,
      invite: invitePayload(invite, origin),
      email_configured: isTransactionalEmailConfigured(),
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { uid, isAppSiteManager } = await requireCommunityManagerActor(req)
    const { id: idStr } = await ctx.params
    const communityId = parseInt(idStr, 10)
    if (!communityId) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    await assertUserCanManageCommunity(uid, communityId, { isAppSiteManager })

    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? 'email')
    const origin = resolvePublicAppOrigin(
      typeof body.origin === 'string' ? body.origin : req.nextUrl.origin
    )

    if (action === 'ensure_link' || action === 'rotate') {
      const invite = await ensureCommunityInviteAccess(communityId, {
        rotate: action === 'rotate',
      })
      return NextResponse.json({ invite: invitePayload(invite, origin) })
    }

    const invite = await ensureCommunityInviteAccess(communityId)
    const payload = invitePayload(invite, origin)
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Adresse e-mail invalide' }, { status: 400 })
    }

    const me = await authMe(uid)
    const inviterName =
      (me as { first_name?: string; pseudo?: string; name?: string }).first_name ||
      (me as { pseudo?: string }).pseudo ||
      (me as { name?: string }).name ||
      null
    const { subject, text } = buildPlaceInviteEmailBody({
      placeName: invite.name,
      inviteUrl: payload.url,
      inviteCode: invite.invite_code,
      inviterName,
    })
    const emailSent = await sendTransactionalEmail({ to: email, subject, text })
    return NextResponse.json({
      ok: true,
      email_sent: emailSent,
      email_configured: isTransactionalEmailConfigured(),
      invite: payload,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
