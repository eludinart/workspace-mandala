/**
 * Alertes admin push : seuil de livraison + échec total individuel.
 */
import { getBootstrapAdminEmails } from './admin-bootstrap'
import { getPool, isDbConfigured, table } from './db'
import { recordUserNotification } from './db-notifications'
import { getDeliveryRateWindow, purgeOldPushReceipts } from './db-push-receipts'
import { sendTransactionalEmail } from './mandala-mail'
import type { RowDataPacket } from 'mysql2'

const DEFAULT_THRESHOLD = 0.6
const DEFAULT_MIN_ACCEPTED = 5
const DEFAULT_WINDOW_HOURS = 6

function threshold(): number {
  const raw = Number(process.env.PUSH_DELIVERY_ALERT_THRESHOLD ?? DEFAULT_THRESHOLD)
  if (!Number.isFinite(raw) || raw <= 0 || raw > 1) return DEFAULT_THRESHOLD
  return raw
}

function minAccepted(): number {
  const raw = Number(process.env.PUSH_DELIVERY_ALERT_MIN ?? DEFAULT_MIN_ACCEPTED)
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_MIN_ACCEPTED
  return Math.floor(raw)
}

async function listAdminNotifyTargets(): Promise<Array<{ userId: number; email: string }>> {
  const emails = new Set(getBootstrapAdminEmails().map((e) => e.toLowerCase()))
  if (!isDbConfigured()) {
    return [...emails].map((email) => ({ userId: 0, email }))
  }
  const pool = getPool()
  const usersTbl = table('users')
  const rolesTbl = table('mandala_app_roles')
  const emailList = [...emails]
  const emailClause =
    emailList.length > 0
      ? `OR LOWER(u.user_email) IN (${emailList.map(() => '?').join(',')})`
      : ''
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID AS id, u.user_email AS email
     FROM ${usersTbl} u
     LEFT JOIN ${rolesTbl} r ON r.user_id = u.ID
     WHERE r.app_role IN ('admin', 'administrator')
        ${emailClause}`,
    emailList
  )
  const out: Array<{ userId: number; email: string }> = []
  const seen = new Set<string>()
  for (const r of rows ?? []) {
    const email = String(r.email ?? '')
      .trim()
      .toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    out.push({ userId: Number(r.id), email })
  }
  for (const email of emails) {
    if (seen.has(email)) continue
    out.push({ userId: 0, email })
  }
  return out
}

async function notifyAdmins(params: {
  title: string
  body: string
  actionUrl?: string
}): Promise<{ notified: number; emailed: number }> {
  const targets = await listAdminNotifyTargets()
  let notified = 0
  let emailed = 0
  const userIds = [...new Set(targets.map((t) => t.userId).filter((id) => id > 0))]
  for (const uid of userIds) {
    try {
      // Cloche seule — pas de push, pour éviter une boucle d’alertes.
      const id = await recordUserNotification({
        userId: uid,
        type: 'system',
        title: params.title,
        body: params.body,
        actionUrl: params.actionUrl ?? '/app?page=admin&tab=push',
        priority: 'high',
      })
      if (id) notified += 1
    } catch (err) {
      console.error('[push-alerts] in-app', (err as Error)?.message ?? err)
    }
  }
  for (const t of targets) {
    const ok = await sendTransactionalEmail({
      to: t.email,
      subject: params.title,
      text: params.body,
    }).catch(() => false)
    if (ok) emailed += 1
  }
  return { notified, emailed }
}

/** Appelé après un envoi « important » sans aucun accepted. */
export async function alertPushTotalFailure(input: {
  userId: number
  title: string
  devices: number
  gone: number
  errors: number
}): Promise<void> {
  if (input.devices <= 0) return
  const body = [
    `Échec total push pour user #${input.userId}.`,
    `Titre : ${input.title}`,
    `Appareils : ${input.devices}, gone=${input.gone}, errors=${input.errors}.`,
    'Aucun envoi accepté par le push service.',
  ].join('\n')
  await notifyAdmins({
    title: 'Push critique — échec total',
    body,
  })
}

export async function runPushDeliveryAlertCheck(): Promise<{
  checked: boolean
  accepted: number
  delivered: number
  rate: number | null
  threshold: number
  alerted: boolean
  purged: { sends: number; receipts: number }
  notified: number
  emailed: number
}> {
  const window = await getDeliveryRateWindow(DEFAULT_WINDOW_HOURS)
  const thr = threshold()
  const min = minAccepted()
  const purged = await purgeOldPushReceipts(30)
  let alerted = false
  let notified = 0
  let emailed = 0
  if (
    window.accepted >= min &&
    window.rate != null &&
    window.rate < thr
  ) {
    alerted = true
    const pct = Math.round(window.rate * 100)
    const res = await notifyAdmins({
      title: 'Push — taux de livraison bas',
      body: [
        `Sur ${DEFAULT_WINDOW_HOURS}h : delivered/accepted = ${pct}% (${window.delivered}/${window.accepted}).`,
        `Seuil : ${Math.round(thr * 100)}% (min ${min} accepted).`,
        'Voir Admin → Push.',
      ].join('\n'),
    })
    notified = res.notified
    emailed = res.emailed
  }
  return {
    checked: true,
    accepted: window.accepted,
    delivered: window.delivered,
    rate: window.rate,
    threshold: thr,
    alerted,
    purged,
    notified,
    emailed,
  }
}
