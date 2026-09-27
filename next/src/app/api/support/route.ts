import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin, requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { insertSupportReport, listSupportReports, type SupportKind } from '@/lib/db-support'
import { PAGE_LABELS } from '@/lib/nav'
import { sendTransactionalEmail } from '@/lib/mandala-mail'
import type { MandalaPage } from '@/components/MandalaApp'

export const dynamic = 'force-dynamic'

const KINDS = new Set<SupportKind>(['question', 'bug'])

function cleanPage(value: unknown): string {
  const page = String(value ?? '').trim().slice(0, 64)
  if (!page) return 'home'
  return page
}

function cleanSlug(value: unknown): string | null {
  const slug = String(value ?? '').trim().slice(0, 64)
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(slug)) return null
  return slug
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json().catch(() => ({}))
    const kind = body.kind as SupportKind
    if (!KINDS.has(kind)) {
      return NextResponse.json({ error: 'Type de message invalide' }, { status: 400 })
    }
    const message = String(body.message ?? '').trim()
    if (message.length < 8) {
      return NextResponse.json(
        { error: 'Décrivez le sujet en quelques mots (8 caractères minimum).' },
        { status: 400 }
      )
    }
    if (message.length > 4000) {
      return NextResponse.json({ error: 'Message trop long (4000 caractères maximum).' }, { status: 400 })
    }

    const page = cleanPage(body.page)
    const communitySlug = cleanSlug(body.community_slug)
    const userAgent = req.headers.get('user-agent')?.slice(0, 512) ?? null
    const id = await insertSupportReport({
      userId: uid,
      communitySlug,
      page,
      kind,
      message,
      userAgent,
    })

    const supportTo = process.env.SUPPORT_EMAIL?.trim()
    if (supportTo && id) {
      const user = await authMe(uid).catch(() => null)
      const pageLabel = PAGE_LABELS[page as MandalaPage] ?? page
      const kindLabel = kind === 'bug' ? 'Bug' : 'Question'
      const who = user
        ? `${user.name || user.login || 'Membre'} <${user.email || 'sans email'}>`
        : `utilisateur #${uid}`
      await sendTransactionalEmail({
        to: supportTo,
        subject: `[Mandala] ${kindLabel} — ${pageLabel}`,
        text: [
          `${kindLabel} #${id}`,
          `De : ${who}`,
          `Page : ${pageLabel} (${page})`,
          communitySlug ? `Lieu : ${communitySlug}` : '',
          '',
          message,
        ]
          .filter((line) => line !== '')
          .join('\n'),
      })
    }

    return NextResponse.json({ ok: true, id })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Erreur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const items = await listSupportReports()
    return NextResponse.json({ items })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Erreur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
