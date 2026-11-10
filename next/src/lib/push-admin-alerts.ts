/**
 * Alertes admin push : seuil de livraison + échec total individuel.
 * Anti-spam : cooldown entre deux envois (notif cloche + e-mail).
 */
import type { RowDataPacket } from 'mysql2'
import { getBootstrapAdminEmails } from './admin-bootstrap'
import { getPool, isDbConfigured, table } from './db'
import {
  ensureNotificationsTables,
  recordUserNotification,
} from './db-notifications'
import { getDeliveryRateWindow, purgeOldPushReceipts } from './db-push-receipts'
import { sendTransactionalEmail } from './mandala-mail'

const DEFAULT_THRESHOLD = 0.6
const DEFAULT_MIN_ACCEPTED = 5
const DEFAULT_WINDOW_HOURS = 6
/** Cron = 1×/h ; sans cooldown → spam tant que le taux reste bas. */
const DEFAULT_COOLDOWN_HOURS = 48
const DEFAULT_CRITICAL_COOLDOWN_HOURS = 48

const TITLE_LOW_RATE = 'Push — taux de livraison bas'
const TITLE_CRITICAL = 'Push critique — échec total'
const SOURCE_LOW_RATE = 'push_delivery_alert'
const SOURCE_CRITICAL = 'push_critical_alert'

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

function cooldownHours(): number {
  const raw = Number(process.env.PUSH_DELIVERY_ALERT_COOLDOWN_HOURS ?? DEFAULT_COOLDOWN_HOURS)
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_COOLDOWN_HOURS
  return Math.floor(raw)
}

function criticalCooldownHours(): number {
  const raw = Number(
    process.env.PUSH_CRITICAL_ALERT_COOLDOWN_HOURS ?? DEFAULT_CRITICAL_COOLDOWN_HOURS
  )
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_CRITICAL_COOLDOWN_HOURS
  return Math.floor(raw)
}

/**
 * True si une alerte du même type a déjà été créée dans la fenêtre de cooldown.
 * Clé : source_type (+ source_id optionnel), avec repli sur le titre pour l’historique.
 */
async function wasRecentlyAlerted(params: {
  title: string
  sourceType: string
  sourceId?: number | null
  hours: number
}): Promise<boolean> {
  if (!isDbConfigured()) return false
  try {
    await ensureNotificationsTables()
    const pool = getPool()
    const tN = table('notifications')
    const hours = Math.max(1, Math.floor(params.hours))
    if (params.sourceId != null && params.sourceId > 0) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM ${tN}
         WHERE (
           (source_type = ? AND source_id = ?)
           OR (title = ? AND body LIKE ?)
         )
           AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
         ORDER BY id DESC
         LIMIT 1`,
        [
          params.sourceType,
          params.sourceId,
          params.title,
          `%user #${params.sourceId}%`,
          hours,
        ]
      )
      return (rows?.length ?? 0) > 0
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM ${tN}
       WHERE (source_type = ? OR title = ?)
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       ORDER BY id DESC
       LIMIT 1`,
      [params.sourceType, params.title, hours]
    )
    return (rows?.length ?? 0) > 0
  } catch (err) {
    console.error('[push-alerts] cooldown check', (err as Error)?.message ?? err)
    return false
  }
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
  sourceType?: string
  sourceId?: number | null
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
        sourceType: params.sourceType ?? null,
        sourceId: params.sourceId ?? null,
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
  const cool = criticalCooldownHours()
  if (
    await wasRecentlyAlerted({
      title: TITLE_CRITICAL,
      sourceType: SOURCE_CRITICAL,
      sourceId: input.userId,
      hours: cool,
    })
  ) {
    return
  }
  const body = [
    `Échec total push pour user #${input.userId}.`,
    `Titre : ${input.title}`,
    `Appareils : ${input.devices}, gone=${input.gone}, errors=${input.errors}.`,
    'Aucun envoi accepté par le push service.',
  ].join('\n')
  await notifyAdmins({
    title: TITLE_CRITICAL,
    body,
    sourceType: SOURCE_CRITICAL,
    sourceId: input.userId,
  })
}

export async function runPushDeliveryAlertCheck(): Promise<{
  checked: boolean
  accepted: number
  delivered: number
  rate: number | null
  threshold: number
  alerted: boolean
  skipped_cooldown: boolean
  cooldown_hours: number
  purged: { sends: number; receipts: number }
  notified: number
  emailed: number
}> {
  const window = await getDeliveryRateWindow(DEFAULT_WINDOW_HOURS)
  const thr = threshold()
  const min = minAccepted()
  const cool = cooldownHours()
  const purged = await purgeOldPushReceipts(30)
  let alerted = false
  let skipped_cooldown = false
  let notified = 0
  let emailed = 0
  if (window.accepted >= min && window.rate != null && window.rate < thr) {
    alerted = true
    if (
      await wasRecentlyAlerted({
        title: TITLE_LOW_RATE,
        sourceType: SOURCE_LOW_RATE,
        hours: cool,
      })
    ) {
      skipped_cooldown = true
    } else {
      const pct = Math.round(window.rate * 100)
      const res = await notifyAdmins({
        title: TITLE_LOW_RATE,
        body: [
          `Sur ${DEFAULT_WINDOW_HOURS}h : delivered/accepted = ${pct}% (${window.delivered}/${window.accepted}).`,
          `Seuil : ${Math.round(thr * 100)}% (min ${min} accepted).`,
          'Voir Admin → Push.',
        ].join('\n'),
        sourceType: SOURCE_LOW_RATE,
      })
      notified = res.notified
      emailed = res.emailed
    }
  }
  return {
    checked: true,
    accepted: window.accepted,
    delivered: window.delivered,
    rate: window.rate,
    threshold: thr,
    alerted,
    skipped_cooldown,
    cooldown_hours: cool,
    purged,
    notified,
    emailed,
  }
}
