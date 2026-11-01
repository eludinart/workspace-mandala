/**
 * Persistance billing Mandala (customers, subscriptions, Mandala Pro).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from '@/lib/db'
import type { PlanFamily } from '@/lib/billing-catalog'

export type SubStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | string

export type BillingSubRow = {
  id: number
  user_id: number
  community_id: number | null
  plan_family: PlanFamily
  plan_id: string
  status: string
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  current_period_end: Date | null
  cancel_at_period_end: boolean
}

export type ProVerification = 'none' | 'pending' | 'verified' | 'rejected'

export type ProProfileRow = {
  user_id: number
  verification: ProVerification
  tagline: string | null
  modalities: string | null
  service_area: string | null
  external_url: string | null
  submitted_at: Date | null
  reviewed_at: Date | null
  reviewer_id: number | null
  endorsement_community_id: number | null
  reject_reason: string | null
}

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

export function isActiveSubStatus(status: string | null | undefined): boolean {
  return ACTIVE_STATUSES.has(String(status ?? '').toLowerCase())
}

let _ensurePromise: Promise<void> | null = null

export async function ensureBillingTables(): Promise<void> {
  if (!isDbConfigured()) return
  if (_ensurePromise) return _ensurePromise
  const pool = getPool()
  const prefix = process.env.DB_PREFIX || 'mdl_'
  _ensurePromise = (async () => {
    try {
      await pool.execute(
        `ALTER TABLE ${prefix}mandala_communities ADD COLUMN IF NOT EXISTS billing_partner TINYINT(1) NOT NULL DEFAULT 0`
      )
      await pool.execute(
        `ALTER TABLE ${prefix}mandala_communities ADD COLUMN IF NOT EXISTS billing_featured TINYINT(1) NOT NULL DEFAULT 0`
      )
    } catch {
      /* colonnes peut-être déjà là sans IF NOT EXISTS */
    }
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${prefix}mandala_billing_customers (
        user_id INT NOT NULL PRIMARY KEY,
        stripe_customer_id VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_stripe_customer (stripe_customer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${prefix}mandala_billing_subscriptions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        community_id INT NULL DEFAULT NULL,
        plan_family ENUM('place','pro') NOT NULL,
        plan_id VARCHAR(40) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'none',
        stripe_subscription_id VARCHAR(255) NULL,
        stripe_price_id VARCHAR(255) NULL,
        current_period_end DATETIME NULL,
        cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_stripe_sub (stripe_subscription_id),
        KEY idx_user_family (user_id, plan_family),
        KEY idx_community (community_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${prefix}mandala_pro_profiles (
        user_id INT NOT NULL PRIMARY KEY,
        verification ENUM('none','pending','verified','rejected') NOT NULL DEFAULT 'none',
        tagline VARCHAR(200) NULL,
        modalities TEXT NULL,
        service_area VARCHAR(200) NULL,
        external_url VARCHAR(500) NULL,
        submitted_at DATETIME NULL,
        reviewed_at DATETIME NULL,
        reviewer_id INT NULL,
        endorsement_community_id INT NULL,
        reject_reason VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  })().catch((err) => {
    _ensurePromise = null
    throw err
  })
  return _ensurePromise
}

function mapSub(r: RowDataPacket): BillingSubRow {
  return {
    id: Number(r.id),
    user_id: Number(r.user_id),
    community_id: r.community_id != null ? Number(r.community_id) : null,
    plan_family: r.plan_family === 'place' ? 'place' : 'pro',
    plan_id: String(r.plan_id ?? ''),
    status: String(r.status ?? 'none'),
    stripe_subscription_id: r.stripe_subscription_id
      ? String(r.stripe_subscription_id)
      : null,
    stripe_price_id: r.stripe_price_id ? String(r.stripe_price_id) : null,
    current_period_end: r.current_period_end ? new Date(r.current_period_end) : null,
    cancel_at_period_end: Boolean(r.cancel_at_period_end),
  }
}

export async function upsertCustomer(
  userId: number,
  stripeCustomerId: string
): Promise<void> {
  if (!isDbConfigured() || userId <= 0 || !stripeCustomerId) return
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_billing_customers')
  await pool.execute(
    `INSERT INTO ${t} (user_id, stripe_customer_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE stripe_customer_id = VALUES(stripe_customer_id)`,
    [userId, stripeCustomerId.slice(0, 255)]
  )
}

export async function upsertSubscription(row: {
  userId: number
  communityId: number | null
  planFamily: PlanFamily
  planId: string
  status: string
  stripeSubscriptionId: string
  stripePriceId: string | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}): Promise<void> {
  if (!isDbConfigured() || row.userId <= 0 || !row.stripeSubscriptionId) return
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_billing_subscriptions')
  await pool.execute(
    `INSERT INTO ${t}
      (user_id, community_id, plan_family, plan_id, status, stripe_subscription_id,
       stripe_price_id, current_period_end, cancel_at_period_end)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       community_id = VALUES(community_id),
       plan_family = VALUES(plan_family),
       plan_id = VALUES(plan_id),
       status = VALUES(status),
       stripe_price_id = VALUES(stripe_price_id),
       current_period_end = VALUES(current_period_end),
       cancel_at_period_end = VALUES(cancel_at_period_end)`,
    [
      row.userId,
      row.communityId,
      row.planFamily,
      row.planId.slice(0, 40),
      row.status.slice(0, 32),
      row.stripeSubscriptionId.slice(0, 255),
      row.stripePriceId?.slice(0, 255) ?? null,
      row.currentPeriodEnd,
      row.cancelAtPeriodEnd ? 1 : 0,
    ]
  )

  if (row.planFamily === 'place' && row.communityId && isActiveSubStatus(row.status)) {
    await setCommunityFeatured(row.communityId, true)
  }
}

export async function markSubscriptionStatus(
  stripeSubscriptionId: string,
  status: string,
  currentPeriodEnd: Date | null,
  cancelAtPeriodEnd: boolean
): Promise<BillingSubRow | null> {
  if (!isDbConfigured() || !stripeSubscriptionId) return null
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_billing_subscriptions')
  await pool.execute(
    `UPDATE ${t}
     SET status = ?, current_period_end = ?, cancel_at_period_end = ?
     WHERE stripe_subscription_id = ?`,
    [status.slice(0, 32), currentPeriodEnd, cancelAtPeriodEnd ? 1 : 0, stripeSubscriptionId]
  )
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${t} WHERE stripe_subscription_id = ? LIMIT 1`,
    [stripeSubscriptionId]
  )
  const sub = rows[0] ? mapSub(rows[0]) : null
  if (sub?.plan_family === 'place' && sub.community_id) {
    await setCommunityFeatured(sub.community_id, isActiveSubStatus(sub.status))
  }
  return sub
}

export async function getActivePlaceSubscription(
  communityId: number
): Promise<BillingSubRow | null> {
  if (!isDbConfigured() || communityId <= 0) return null
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_billing_subscriptions')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${t}
     WHERE community_id = ? AND plan_family = 'place' AND status IN ('active','trialing')
     ORDER BY updated_at DESC LIMIT 1`,
    [communityId]
  )
  return rows[0] ? mapSub(rows[0]) : null
}

export async function getActiveProSubscription(
  userId: number
): Promise<BillingSubRow | null> {
  if (!isDbConfigured() || userId <= 0) return null
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_billing_subscriptions')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${t}
     WHERE user_id = ? AND plan_family = 'pro' AND status IN ('active','trialing')
     ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  )
  return rows[0] ? mapSub(rows[0]) : null
}

export async function listPlaceSubscriptionsForUser(
  userId: number
): Promise<BillingSubRow[]> {
  if (!isDbConfigured() || userId <= 0) return []
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_billing_subscriptions')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${t}
     WHERE user_id = ? AND plan_family = 'place'
     ORDER BY updated_at DESC`,
    [userId]
  )
  return rows.map(mapSub)
}

export async function setBillingPartner(communityId: number, on: boolean): Promise<void> {
  if (!isDbConfigured() || communityId <= 0) return
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_communities')
  await pool.execute(`UPDATE ${t} SET billing_partner = ? WHERE id = ?`, [
    on ? 1 : 0,
    communityId,
  ])
}

export async function setCommunityFeatured(
  communityId: number,
  featured: boolean
): Promise<void> {
  if (!isDbConfigured() || communityId <= 0) return
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_communities')
  await pool.execute(`UPDATE ${t} SET billing_featured = ? WHERE id = ?`, [
    featured ? 1 : 0,
    communityId,
  ])
}

export async function getCommunityBillingFlags(
  communityId: number
): Promise<{ billing_partner: boolean; billing_featured: boolean } | null> {
  if (!isDbConfigured() || communityId <= 0) return null
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT billing_partner, billing_featured FROM ${t} WHERE id = ? LIMIT 1`,
    [communityId]
  )
  if (!rows[0]) return null
  return {
    billing_partner: Boolean(rows[0].billing_partner),
    billing_featured: Boolean(rows[0].billing_featured),
  }
}

export async function countCommunityMembers(communityId: number): Promise<number> {
  if (!isDbConfigured() || communityId <= 0) return 0
  const pool = getPool()
  const t = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM ${t} WHERE community_id = ?`,
    [communityId]
  )
  return Number(rows[0]?.n ?? 0) || 0
}

function mapPro(r: RowDataPacket): ProProfileRow {
  const v = String(r.verification ?? 'none')
  const verification: ProVerification =
    v === 'pending' || v === 'verified' || v === 'rejected' ? v : 'none'
  return {
    user_id: Number(r.user_id),
    verification,
    tagline: r.tagline != null ? String(r.tagline) : null,
    modalities: r.modalities != null ? String(r.modalities) : null,
    service_area: r.service_area != null ? String(r.service_area) : null,
    external_url: r.external_url != null ? String(r.external_url) : null,
    submitted_at: r.submitted_at ? new Date(r.submitted_at) : null,
    reviewed_at: r.reviewed_at ? new Date(r.reviewed_at) : null,
    reviewer_id: r.reviewer_id != null ? Number(r.reviewer_id) : null,
    endorsement_community_id:
      r.endorsement_community_id != null ? Number(r.endorsement_community_id) : null,
    reject_reason: r.reject_reason != null ? String(r.reject_reason) : null,
  }
}

export async function getProProfile(userId: number): Promise<ProProfileRow | null> {
  if (!isDbConfigured() || userId <= 0) return null
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_pro_profiles')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${t} WHERE user_id = ? LIMIT 1`,
    [userId]
  )
  return rows[0] ? mapPro(rows[0]) : null
}

export async function upsertProProfileSubmit(
  userId: number,
  fields: {
    tagline?: string
    modalities?: string
    service_area?: string
    external_url?: string
  }
): Promise<ProProfileRow> {
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_pro_profiles')
  await pool.execute(
    `INSERT INTO ${t}
      (user_id, verification, tagline, modalities, service_area, external_url, submitted_at, reject_reason)
     VALUES (?, 'pending', ?, ?, ?, ?, NOW(), NULL)
     ON DUPLICATE KEY UPDATE
       verification = 'pending',
       tagline = VALUES(tagline),
       modalities = VALUES(modalities),
       service_area = VALUES(service_area),
       external_url = VALUES(external_url),
       submitted_at = NOW(),
       reject_reason = NULL,
       reviewed_at = NULL,
       reviewer_id = NULL,
       endorsement_community_id = NULL`,
    [
      userId,
      (fields.tagline ?? '').slice(0, 200) || null,
      fields.modalities ?? null,
      (fields.service_area ?? '').slice(0, 200) || null,
      (fields.external_url ?? '').slice(0, 500) || null,
    ]
  )
  const profile = await getProProfile(userId)
  if (!profile) throw new Error('Profil Mandala Pro introuvable après soumission')
  return profile
}

export async function reviewProProfile(
  userId: number,
  decision: 'verified' | 'rejected',
  reviewerId: number,
  endorsementCommunityId: number | null,
  reason?: string
): Promise<ProProfileRow> {
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_pro_profiles')
  await pool.execute(
    `UPDATE ${t}
     SET verification = ?, reviewed_at = NOW(), reviewer_id = ?,
         endorsement_community_id = ?, reject_reason = ?
     WHERE user_id = ?`,
    [
      decision,
      reviewerId,
      endorsementCommunityId,
      decision === 'rejected' ? (reason ?? '').slice(0, 500) || null : null,
      userId,
    ]
  )
  const profile = await getProProfile(userId)
  if (!profile) throw new Error('Profil Mandala Pro introuvable')
  return profile
}

export async function listPendingProProfiles(): Promise<ProProfileRow[]> {
  if (!isDbConfigured()) return []
  await ensureBillingTables()
  const pool = getPool()
  const t = table('mandala_pro_profiles')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${t} WHERE verification = 'pending' ORDER BY submitted_at ASC`
  )
  return rows.map(mapPro)
}

/** Pending dont le sujet est membre d’au moins un des communityIds. */
export async function listPendingProProfilesForCommunities(
  communityIds: number[]
): Promise<ProProfileRow[]> {
  if (!isDbConfigured() || !communityIds.length) return []
  await ensureBillingTables()
  const pool = getPool()
  const tP = table('mandala_pro_profiles')
  const tM = table('mandala_community_members')
  const placeholders = communityIds.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT p.*
     FROM ${tP} p
     INNER JOIN ${tM} m ON m.user_id = p.user_id
     WHERE p.verification = 'pending' AND m.community_id IN (${placeholders})
     ORDER BY p.submitted_at ASC`,
    communityIds
  )
  return rows.map(mapPro)
}

/**
 * Première communauté où reviewer est gestionnaire et subject est membre.
 */
export async function findEndorsementCommunity(
  reviewerId: number,
  subjectUserId: number
): Promise<number | null> {
  if (!isDbConfigured() || reviewerId <= 0 || subjectUserId <= 0) return null
  const pool = getPool()
  const tM = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.community_id AS community_id
     FROM ${tM} r
     INNER JOIN ${tM} s
       ON s.community_id = r.community_id AND s.user_id = ?
     WHERE r.user_id = ? AND r.role IN ('organizer','admin')
     LIMIT 1`,
    [subjectUserId, reviewerId]
  )
  const id = rows[0]?.community_id
  return id != null ? Number(id) : null
}

export async function listManagedCommunityIds(userId: number): Promise<number[]> {
  if (!isDbConfigured() || userId <= 0) return []
  const pool = getPool()
  const tM = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT community_id FROM ${tM}
     WHERE user_id = ? AND role IN ('organizer','admin')`,
    [userId]
  )
  return rows.map((r) => Number(r.community_id)).filter((n) => n > 0)
}

export async function userMemberOfCoveredPlace(userId: number): Promise<boolean> {
  if (!isDbConfigured() || userId <= 0) return false
  await ensureBillingTables()
  const pool = getPool()
  const tM = table('mandala_community_members')
  const tC = table('mandala_communities')
  const tS = table('mandala_billing_subscriptions')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 AS ok
     FROM ${tM} m
     INNER JOIN ${tC} c ON c.id = m.community_id
     LEFT JOIN ${tS} s
       ON s.community_id = c.id AND s.plan_family = 'place' AND s.status IN ('active','trialing')
     WHERE m.user_id = ? AND (c.billing_partner = 1 OR s.id IS NOT NULL)
     LIMIT 1`,
    [userId]
  )
  return Boolean(rows[0])
}

/** Batch flags Pro pour directory. */
export async function getProBoostFlagsForUsers(
  userIds: number[]
): Promise<Map<number, { proBoost: boolean; proVerified: boolean }>> {
  const map = new Map<number, { proBoost: boolean; proVerified: boolean }>()
  for (const id of userIds) map.set(id, { proBoost: false, proVerified: false })
  if (!isDbConfigured() || !userIds.length) return map
  await ensureBillingTables()
  const pool = getPool()
  const placeholders = userIds.map(() => '?').join(',')
  const tS = table('mandala_billing_subscriptions')
  const tP = table('mandala_pro_profiles')
  const [subRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id FROM ${tS}
     WHERE plan_family = 'pro' AND status IN ('active','trialing') AND user_id IN (${placeholders})`,
    userIds
  )
  for (const r of subRows) {
    const id = Number(r.user_id)
    const cur = map.get(id) ?? { proBoost: false, proVerified: false }
    cur.proBoost = true
    map.set(id, cur)
  }
  const [proRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id, verification FROM ${tP} WHERE user_id IN (${placeholders})`,
    userIds
  )
  for (const r of proRows) {
    const id = Number(r.user_id)
    const cur = map.get(id) ?? { proBoost: false, proVerified: false }
    cur.proVerified = String(r.verification) === 'verified'
    map.set(id, cur)
  }
  return map
}
