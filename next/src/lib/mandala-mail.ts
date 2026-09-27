/**
 * Envoi d'e-mails optionnel (Resend API ou SMTP via fetch).
 * Si non configuré, retourne false — l'app affiche le mot de passe à copier.
 */
export function isTransactionalEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim()
}

export async function sendTransactionalEmail(params: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<boolean> {
  const to = params.to.trim()
  if (!to) return false

  const resendKey = process.env.RESEND_API_KEY?.trim()
  if (resendKey) {
    const from = process.env.MANDALA_MAIL_FROM?.trim() || 'Mandala <noreply@mandala.local>'
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: params.subject,
          text: params.text,
          html: params.html ?? params.text.replace(/\n/g, '<br>'),
        }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  return false
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
