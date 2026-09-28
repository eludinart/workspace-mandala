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

export function resolvePublicAppOrigin(reqOrigin?: string | null): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '').trim()
  if (configured) return configured
  const fromReq = (reqOrigin ?? '').replace(/\/$/, '').trim()
  if (fromReq) return fromReq
  return 'https://localhost:3002'
}
