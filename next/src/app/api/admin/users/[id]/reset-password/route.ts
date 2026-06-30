import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireUserManagementAccess } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { authMe, setUserPassword } from '@/lib/db-auth'
import { buildPasswordResetEmailBody, sendTransactionalEmail } from '@/lib/mandala-mail'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

function generateTemporaryPassword(length = 12): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { id } = await params
    const targetId = parseInt(id, 10)
    if (!targetId) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const communitySlug =
      typeof body.community_slug === 'string' ? body.community_slug : req.nextUrl.searchParams.get('community_slug')
    await requireUserManagementAccess(req, targetId, communitySlug)

    let password = String(body.password ?? '').trim()
    if (!password) password = generateTemporaryPassword()
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }

    await setUserPassword(targetId, password)

    const sendEmail = body.send_email !== false
    let emailSent = false
    if (sendEmail) {
      const user = await authMe(targetId)
      const { subject, text } = buildPasswordResetEmailBody({
        firstName: user.first_name ?? user.name?.split(/\s+/)[0],
        temporaryPassword: password,
        loginHint: user.email || user.login,
      })
      emailSent = await sendTransactionalEmail({
        to: user.email,
        subject,
        text,
      })
    }

    return NextResponse.json({
      ok: true,
      temporary_password: password,
      email_sent: emailSent,
      email_configured: !!process.env.RESEND_API_KEY?.trim(),
    })
  } catch (err: unknown) {
    const e = err as ApiError
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
