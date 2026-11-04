/**
 * Cycle de vie cadeau Lieu : grâce 7 j + rappels (in-app urgent + e-mail).
 */
import type { RowDataPacket } from 'mysql2'
import {
  COMP_PLACE_GRACE_DAYS,
  COMP_PLACE_WARN_DAYS_BEFORE,
  getActivePlaceSubscription,
  listCompPlaceSubsNeedingLifecycle,
  listManagedCommunityIds,
  listPlaceManagerUserIds,
  markCompPlaceGraceSent,
  markCompPlaceWarnSent,
  type CompPlaceSubRow,
} from '@/lib/db-billing'
import { createNotification } from '@/lib/db-notifications'
import { sendTransactionalEmail } from '@/lib/mandala-mail'
import { getPool, isDbConfigured, table } from '@/lib/db'

export { COMP_PLACE_GRACE_DAYS, COMP_PLACE_WARN_DAYS_BEFORE }

export type CompAlertKind = 'warn' | 'grace'

export type CompPlaceAlert = {
  community_id: number
  place_name: string
  kind: CompAlertKind
  period_end: string
  grace_ends_at: string
}

function sameInstant(a: Date | null, b: Date): boolean {
  if (!a) return false
  return Math.abs(a.getTime() - b.getTime()) < 1000
}

function formatFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function graceEndFromPeriodEnd(periodEnd: Date): Date {
  const g = new Date(periodEnd)
  g.setUTCDate(g.getUTCDate() + COMP_PLACE_GRACE_DAYS)
  return g
}

async function userEmail(userId: number): Promise<string | null> {
  if (!isDbConfigured() || userId <= 0) return null
  const pool = getPool()
  const t = table('users')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_email FROM ${t} WHERE ID = ? LIMIT 1`,
    [userId]
  )
  const email = rows[0]?.user_email ? String(rows[0].user_email).trim() : ''
  return email.includes('@') ? email : null
}

function buildCopy(
  kind: CompAlertKind,
  placeName: string,
  periodEnd: Date,
  graceEnds: Date
): { title: string; body: string; subject: string; text: string } {
  const place = placeName || 'votre lieu'
  const endLabel = formatFr(periodEnd)
  const graceLabel = formatFr(graceEnds)
  if (kind === 'warn') {
    const title = `Offre Lieu : fin du cadeau bientôt`
    const body = `Le cadeau d’abonnement pour « ${place} » se termine le ${endLabel}. Ensuite, ${COMP_PLACE_GRACE_DAYS} jours de grâce jusqu’au ${graceLabel}. Souscrivez pour garder le catalogue public.`
    return {
      title,
      body,
      subject: `[Mandala] Fin du cadeau Lieu — ${place}`,
      text: [
        'Bonjour,',
        '',
        body,
        '',
        'Ouvrez Mandala → Compte → Abonnements pour choisir un plan Lieu.',
        '',
        '— L’équipe Mandala',
      ].join('\n'),
    }
  }
  const title = `Offre Lieu : période de grâce en cours`
  const body = `Le cadeau pour « ${place} » est terminé depuis le ${endLabel}. L’accès reste actif jusqu’au ${graceLabel}. Après cette date, le plan Lieu ne sera plus actif sans abonnement.`
  return {
    title,
    body,
    subject: `[Mandala] Grâce offre Lieu — ${place}`,
    text: [
      'Bonjour,',
      '',
      body,
      '',
      'Ouvrez Mandala → Compte → Abonnements pour souscrire.',
      '',
      '— L’équipe Mandala',
    ].join('\n'),
  }
}

async function notifyManagers(
  sub: CompPlaceSubRow,
  kind: CompAlertKind
): Promise<{ notified: number; emails: number }> {
  const communityId = sub.community_id
  if (!communityId) return { notified: 0, emails: 0 }
  const periodEnd = sub.current_period_end
  if (!periodEnd) return { notified: 0, emails: 0 }
  const graceEnds = graceEndFromPeriodEnd(periodEnd)
  const placeName = sub.community_name || `lieu #${communityId}`
  const copy = buildCopy(kind, placeName, periodEnd, graceEnds)
  const managers = await listPlaceManagerUserIds(communityId)
  let notified = 0
  let emails = 0
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mandala.eludein.art').replace(
    /\/$/,
    ''
  )
  const actionUrl = `${appUrl}/app`

  for (const userId of managers) {
    try {
      await createNotification({
        type: kind === 'warn' ? 'billing_comp_warn' : 'billing_comp_grace',
        title: copy.title,
        body: copy.body,
        action_url: actionUrl,
        action_label: 'Voir les offres',
        recipient_type: 'user',
        recipient_id: userId,
        priority: 'urgent',
        source_type: kind === 'warn' ? 'billing_comp_warn' : 'billing_comp_grace',
        source_id: communityId,
      })
      notified++
    } catch {
      /* autres gestionnaires */
    }
    const email = await userEmail(userId)
    if (email) {
      const ok = await sendTransactionalEmail({
        to: email,
        subject: copy.subject,
        text: copy.text,
      })
      if (ok) emails++
    }
  }
  return { notified, emails }
}

function classify(sub: CompPlaceSubRow, now: Date): CompAlertKind | null {
  const end = sub.current_period_end
  if (!end) return null
  const graceEnds = graceEndFromPeriodEnd(end)
  if (now.getTime() >= graceEnds.getTime()) return null
  if (now.getTime() >= end.getTime()) {
    if (sameInstant(sub.comp_grace_for_end, end)) return null
    return 'grace'
  }
  const warnFrom = new Date(end)
  warnFrom.setUTCDate(warnFrom.getUTCDate() - COMP_PLACE_WARN_DAYS_BEFORE)
  if (now.getTime() >= warnFrom.getTime()) {
    if (sameInstant(sub.comp_warn_for_end, end)) return null
    return 'warn'
  }
  return null
}

/**
 * Envoie les rappels dus : notif in-app (priority urgent) + e-mail SMTP/Resend.
 * Idempotent via comp_warn_for_end / comp_grace_for_end.
 */
export async function processCompPlaceExpiryReminders(): Promise<{
  scanned: number
  warn: number
  grace: number
  notified: number
  emails: number
}> {
  const subs = await listCompPlaceSubsNeedingLifecycle()
  const now = new Date()
  let warn = 0
  let grace = 0
  let notified = 0
  let emails = 0

  for (const sub of subs) {
    const kind = classify(sub, now)
    if (!kind || !sub.current_period_end) continue
    const stats = await notifyManagers(sub, kind)
    notified += stats.notified
    emails += stats.emails
    if (kind === 'warn') {
      await markCompPlaceWarnSent(sub.id, sub.current_period_end)
      warn++
    } else {
      await markCompPlaceGraceSent(sub.id, sub.current_period_end)
      grace++
    }
  }

  return { scanned: subs.length, warn, grace, notified, emails }
}

/** Bandeau UI : alertes encore ouvertes pour les lieux gérés par l’utilisateur. */
export async function listOpenCompAlertsForManager(
  userId: number
): Promise<CompPlaceAlert[]> {
  if (!isDbConfigured() || userId <= 0) return []
  const ids = await listManagedCommunityIds(userId)
  if (!ids.length) return []

  const pool = getPool()
  const tC = table('mandala_communities')
  const tS = table('mandala_billing_subscriptions')
  const placeholders = ids.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.community_id, s.current_period_end, c.name AS community_name
     FROM ${tS} s
     INNER JOIN ${tC} c ON c.id = s.community_id
     WHERE s.community_id IN (${placeholders})
       AND s.plan_family = 'place'
       AND s.payment_provider = 'comp'
       AND s.status IN ('active','trialing')
       AND s.current_period_end IS NOT NULL
       AND DATE_ADD(s.current_period_end, INTERVAL ${COMP_PLACE_GRACE_DAYS} DAY) > UTC_TIMESTAMP()
       AND s.current_period_end <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${COMP_PLACE_WARN_DAYS_BEFORE} DAY)`,
    ids
  )

  const out: CompPlaceAlert[] = []
  const now = Date.now()
  for (const r of rows) {
    const communityId = Number(r.community_id)
    const periodEnd = new Date(r.current_period_end)
    const graceEnds = graceEndFromPeriodEnd(periodEnd)
    const kind: CompAlertKind = now >= periodEnd.getTime() ? 'grace' : 'warn'
    const active = await getActivePlaceSubscription(communityId)
    if (!active) continue
    out.push({
      community_id: communityId,
      place_name: String(r.community_name ?? ''),
      kind,
      period_end: periodEnd.toISOString(),
      grace_ends_at: graceEnds.toISOString(),
    })
  }
  return out
}
