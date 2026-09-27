import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { clearPasswordReset, issuePasswordReset } from '@/lib/db-auth'
import { formatDbConnectionError } from '@/lib/db-errors'
import {
  buildSelfPasswordResetEmailBody,
  isTransactionalEmailConfigured,
  resolvePublicAppOrigin,
  sendTransactionalEmail,
} from '@/lib/mandala-mail'
import { clientIpFromRequest, rateLimitAllow } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const GENERIC_MESSAGE =
  'Si un compte existe pour cette adresse, un e-mail vient d’être envoyé. Ouvrez le lien pour choisir un nouveau mot de passe, puis reconnectez-vous.'

function isDbError(err: unknown): boolean {
  const e = err as { code?: string; message?: string }
  return (
    e.code === 'ECONNREFUSED' ||
    e.code === 'ETIMEDOUT' ||
    e.code === 'PROTOCOL_CONNECTION_LOST' ||
    String(e.message ?? '').includes('ECONNREFUSED')
  )
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req.headers)
    const limited = rateLimitAllow(`auth-forgot:${ip}`, 5, 15 * 60_000)
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez plus tard.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      )
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré (MARIADB_*)' }, { status: 503 })
    }
    if (!isTransactionalEmailConfigured()) {
      return NextResponse.json(
        {
          error:
            'L’envoi d’e-mail n’est pas configuré. Contactez un gestionnaire du lieu pour réinitialiser votre mot de passe.',
        },
        { status: 503 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Adresse email requise' }, { status: 400 })
    }

    const emailLimited = rateLimitAllow(`auth-forgot-email:${email}`, 3, 15 * 60_000)
    if (!emailLimited.ok) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez plus tard.' },
        { status: 429, headers: { 'Retry-After': String(emailLimited.retryAfterSec) } }
      )
    }

    const issued = await issuePasswordReset(email)
    if (!issued) {
      return NextResponse.json({ ok: true, message: GENERIC_MESSAGE })
    }

    const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '')
    const origin = resolvePublicAppOrigin(req.nextUrl.origin)
    const resetUrl = `${origin}${base}/app?reset=${encodeURIComponent(issued.token)}`
    const { subject, text } = buildSelfPasswordResetEmailBody({
      firstName: issued.firstName,
      resetUrl,
    })
    const sent = await sendTransactionalEmail({
      to: issued.email,
      subject,
      text,
    })
    if (!sent) {
      await clearPasswordReset(issued.userId)
      return NextResponse.json(
        { error: 'L’e-mail n’a pas pu être envoyé. Réessayez dans quelques minutes.' },
        { status: 503 }
      )
    }

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = isDbError(err) ? 503 : e.status || 400
    const message = isDbError(err)
      ? formatDbConnectionError(err)
      : e.message || 'Impossible d’envoyer le lien de réinitialisation'
    return NextResponse.json({ error: message }, { status })
  }
}
