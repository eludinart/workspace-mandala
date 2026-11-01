/**
 * Acceptations documents légaux (CGU / CGV / confidentialité).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from '@/lib/db'
import {
  LEGAL_CGU_VERSION,
  LEGAL_CGV_VERSION,
  LEGAL_PRIVACY_VERSION,
  type LegalDocKey,
} from '@/lib/legal-versions'

let _ensure: Promise<void> | null = null

export async function ensureLegalTables(): Promise<void> {
  if (!isDbConfigured()) return
  if (_ensure) return _ensure
  const pool = getPool()
  const t = table('legal_acceptances')
  _ensure = (async () => {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        doc_key VARCHAR(32) NOT NULL,
        doc_version VARCHAR(32) NOT NULL,
        accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ip VARCHAR(64) DEFAULT NULL,
        user_agent VARCHAR(512) DEFAULT NULL,
        UNIQUE KEY uq_user_doc_version (user_id, doc_key, doc_version),
        KEY idx_user_doc (user_id, doc_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  })().catch((err) => {
    _ensure = null
    throw err
  })
  return _ensure
}

export async function recordLegalAcceptance(params: {
  userId: number
  docKey: LegalDocKey
  docVersion: string
  ip?: string | null
  userAgent?: string | null
}): Promise<void> {
  if (!isDbConfigured() || params.userId <= 0) return
  await ensureLegalTables()
  const pool = getPool()
  const t = table('legal_acceptances')
  await pool.execute(
    `INSERT INTO ${t} (user_id, doc_key, doc_version, ip, user_agent)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       accepted_at = CURRENT_TIMESTAMP,
       ip = VALUES(ip),
       user_agent = VALUES(user_agent)`,
    [
      params.userId,
      params.docKey.slice(0, 32),
      params.docVersion.slice(0, 32),
      params.ip?.slice(0, 64) ?? null,
      params.userAgent?.slice(0, 512) ?? null,
    ]
  )
}

export async function hasAcceptedLegalDoc(
  userId: number,
  docKey: LegalDocKey,
  docVersion: string
): Promise<boolean> {
  if (!isDbConfigured() || userId <= 0) return false
  await ensureLegalTables()
  const pool = getPool()
  const t = table('legal_acceptances')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM ${t} WHERE user_id = ? AND doc_key = ? AND doc_version = ? LIMIT 1`,
    [userId, docKey, docVersion]
  )
  return rows.length > 0
}

export async function hasAcceptedCurrentCgu(userId: number): Promise<boolean> {
  return hasAcceptedLegalDoc(userId, 'cgu', LEGAL_CGU_VERSION)
}

export async function acceptCurrentCguBundle(params: {
  userId: number
  ip?: string | null
  userAgent?: string | null
}): Promise<void> {
  await recordLegalAcceptance({
    userId: params.userId,
    docKey: 'cgu',
    docVersion: LEGAL_CGU_VERSION,
    ip: params.ip,
    userAgent: params.userAgent,
  })
  await recordLegalAcceptance({
    userId: params.userId,
    docKey: 'privacy',
    docVersion: LEGAL_PRIVACY_VERSION,
    ip: params.ip,
    userAgent: params.userAgent,
  })
  await recordLegalAcceptance({
    userId: params.userId,
    docKey: 'cgv',
    docVersion: LEGAL_CGV_VERSION,
    ip: params.ip,
    userAgent: params.userAgent,
  })
}
