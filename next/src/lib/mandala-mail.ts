/**
 * Envoi d'e-mails transactionnels.
 * SMTP (même boîte Hostinger que Fleur d'Amour) en priorité, Resend en secours.
 * Si rien n'est configuré, retourne false — l'app propose de transmettre le mot de passe à la main.
 */
import nodemailer from 'nodemailer'

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback
  const s = value.trim().toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes') return true
  if (s === 'false' || s === '0' || s === 'no') return false
  return fallback
}

function smtpSettings() {
  const host = process.env.SMTP_HOST?.trim() || ''
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
  const user = process.env.SMTP_USER?.trim() || ''
  const pass = process.env.SMTP_PASS ?? ''
  const secure = envBool(process.env.SMTP_SECURE, port === 465)
  const from =
    process.env.SMTP_FROM?.trim() ||
    process.env.MANDALA_MAIL_FROM?.trim() ||
    (user ? `Mandala <${user}>` : '')
  const replyTo = process.env.SMTP_REPLY_TO?.trim() || undefined
  return { host, port, user, pass, secure, from, replyTo }
}

function isSmtpConfigured(): boolean {
  const smtp = smtpSettings()
  return !!(smtp.host && smtp.user && smtp.pass && smtp.from)
}

export function isTransactionalEmailConfigured(): boolean {
  return isSmtpConfigured() || !!process.env.RESEND_API_KEY?.trim()
}

async function sendViaSmtp(params: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<boolean> {
  const smtp = smtpSettings()
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })
  await transport.sendMail({
    from: smtp.from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html ?? params.text.replace(/\n/g, '<br>'),
    replyTo: smtp.replyTo,
  })
  return true
}

async function sendViaResend(params: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY?.trim()
  if (!resendKey) return false
  const from =
    process.env.MANDALA_MAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    'Mandala <noreply@mandala.local>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: params.html ?? params.text.replace(/\n/g, '<br>'),
    }),
  })
  return res.ok
}

export async function sendTransactionalEmail(params: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<boolean> {
  const to = params.to.trim()
  if (!to) return false
  const message = { ...params, to }

  if (isSmtpConfigured()) {
    try {
      return await sendViaSmtp(message)
    } catch {
      return false
    }
  }

  try {
    return await sendViaResend(message)
  } catch {
    return false
  }
}

export function buildPasswordResetEmailBody(params: {
  firstName?: string | null
  temporaryPassword: string
  loginHint?: string
}): { subject: string; text: string } {
  const greeting = params.firstName ? `Bonjour ${params.firstName},` : 'Bonjour,'
  const subject = 'Votre mot de passe temporaire Mandala'
  const text = [
    greeting,
    '',
    'Un gestionnaire a réinitialisé votre mot de passe Mandala.',
    '',
    `Mot de passe temporaire : ${params.temporaryPassword}`,
    params.loginHint ? `Identifiant de connexion : ${params.loginHint}` : '',
    '',
    'Connectez-vous puis changez ce mot de passe dans « Mon compte » dès que possible.',
    '',
    '— L\'équipe Mandala',
  ]
    .filter((line) => line !== '')
    .join('\n')
  return { subject, text }
}

export function buildSelfPasswordResetEmailBody(params: {
  firstName?: string | null
  resetUrl: string
}): { subject: string; text: string } {
  const greeting = params.firstName ? `Bonjour ${params.firstName},` : 'Bonjour,'
  const subject = 'Choisissez un nouveau mot de passe Mandala'
  const text = [
    greeting,
    '',
    'Vous avez demandé à remplacer le mot de passe de votre compte Mandala.',
    '',
    'Ouvrez ce lien pour en choisir un nouveau et vous reconnecter. Il reste valable 1 heure :',
    params.resetUrl,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail. Votre mot de passe actuel ne change pas.",
    '',
    "— L'équipe Mandala",
  ].join('\n')
  return { subject, text }
}

export function buildPlaceInviteEmailBody(params: {
  placeName: string
  inviteUrl: string
  inviteCode: string
  inviterName?: string | null
}): { subject: string; text: string } {
  const who = params.inviterName?.trim() || 'Un gestionnaire'
  const subject = `Invitation à rejoindre ${params.placeName} sur Mandala`
  const text = [
    'Bonjour,',
    '',
    `${who} vous invite à rejoindre « ${params.placeName} » sur Mandala.`,
    '',
    'Ouvrez ce lien pour créer un compte (ou vous connecter) et accéder directement au lieu :',
    params.inviteUrl,
    '',
    `Si on vous demande un code d’invitation, utilisez : ${params.inviteCode}`,
    '',
    '— L’équipe Mandala',
  ].join('\n')
  return { subject, text }
}

export function buildPlaceLinkRequestEmailBody(params: {
  fromPlaceName: string
  toPlaceName: string
  alertsUrl: string
}): { subject: string; text: string } {
  const subject = `${params.fromPlaceName} souhaite se relier à ${params.toPlaceName}`
  const text = [
    'Bonjour,',
    '',
    `Le lieu « ${params.fromPlaceName} » souhaite se relier à « ${params.toPlaceName} » sur Mandala.`,
    '',
    'Ouvrez vos alertes pour accepter ou refuser :',
    params.alertsUrl,
    '',
    '— L’équipe Mandala',
  ].join('\n')
  return { subject, text }
}

const PROD_PUBLIC_ORIGIN = 'https://mandala.eludein.art'

function normalizeOrigin(value: string | null | undefined): string {
  return (value ?? '').replace(/\/$/, '').trim()
}

/** Origins that must never ship in production transactional e-mails. */
export function isLocalDevOrigin(origin: string): boolean {
  if (!origin) return false
  try {
    const host = new URL(origin).hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1'
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(origin)
  }
}

/**
 * Public site origin for links in e-mails (reset, invites, …).
 * Prefer runtime `APP_PUBLIC_URL` (not baked by Next), then a non-localhost
 * `NEXT_PUBLIC_APP_URL`, then the request origin. Never fall back to localhost
 * in production — Coolify builds often bake `localhost:3002` when the build arg
 * is missing even if the runtime env is correct.
 */
export function resolvePublicAppOrigin(reqOrigin?: string | null): string {
  const runtime = normalizeOrigin(process.env.APP_PUBLIC_URL)
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL)
  const fromReq = normalizeOrigin(reqOrigin)

  const candidates = [runtime, configured, fromReq].filter(Boolean)
  const publicOrigin = candidates.find((origin) => !isLocalDevOrigin(origin))
  if (publicOrigin) return publicOrigin

  if (process.env.NODE_ENV === 'production') return PROD_PUBLIC_ORIGIN

  if (runtime) return runtime
  if (configured) return configured
  if (fromReq) return fromReq
  return 'http://localhost:3002'
}
