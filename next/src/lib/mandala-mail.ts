/**
 * Envoi d'e-mails optionnel (Resend API ou SMTP via fetch).
 * Si non configuré, retourne false — l'app affiche le mot de passe à copier.
 */
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
