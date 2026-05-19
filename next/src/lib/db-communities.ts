/**
 * Communautés (lieux / groupes) — multi-tenant Mandala.
 */
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'

export type CommunityRecord = {
  id: number
  slug: string
  name: string
  tagline: string | null
  accent_color: string | null
  logo_emoji: string | null
}

export type CommunityRole = 'member' | 'organizer' | 'admin'

let _ensured = false

export async function ensureCommunitiesTables(): Promise<void> {
  if (_ensured || !isDbConfigured()) return
  const pool = getPool()
  const tC = table('mandala_communities')
  const tM = table('mandala_community_members')
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tC} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(64) NOT NULL,
      name VARCHAR(120) NOT NULL,
      tagline VARCHAR(255) DEFAULT NULL,
      accent_color VARCHAR(24) DEFAULT NULL,
      logo_emoji VARCHAR(16) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tM} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      community_id INT NOT NULL,
      user_id INT NOT NULL,
      role VARCHAR(24) NOT NULL DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_community_user (community_id, user_id),
      KEY idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  _ensured = true
}

export async function seedDefaultCommunitiesIfEmpty(): Promise<void> {
  await ensureCommunitiesTables()
  const pool = getPool()
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM ${tC}`)
  if (Number(rows[0]?.c ?? 0) > 0) return
  await pool.execute(
    `INSERT INTO ${tC} (slug, name, tagline, accent_color, logo_emoji) VALUES
      ('shambhala', 'Shambhala', 'Lieu cœur — Inde', '#d97706', '🕉️'),
      ('sivana', 'Sivanà', 'Communauté Sivanà', '#7c3aed', '🌸')`
  )
}

export async function listCommunities(): Promise<CommunityRecord[]> {
  if (!isDbConfigured()) return []
  await ensureCommunitiesTables()
  const pool = getPool()
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, slug, name, tagline, accent_color, logo_emoji FROM ${tC} WHERE is_active = 1 ORDER BY name ASC`
  )
  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    tagline: r.tagline ? String(r.tagline) : null,
    accent_color: r.accent_color ? String(r.accent_color) : null,
    logo_emoji: r.logo_emoji ? String(r.logo_emoji) : null,
  }))
}

export async function getCommunityBySlug(slug: string): Promise<CommunityRecord | null> {
  await ensureCommunitiesTables()
  const pool = getPool()
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, slug, name, tagline, accent_color, logo_emoji FROM ${tC} WHERE slug = ? AND is_active = 1 LIMIT 1`,
    [slug]
  )
  const r = rows[0]
  if (!r) return null
  return {
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    tagline: r.tagline ? String(r.tagline) : null,
    accent_color: r.accent_color ? String(r.accent_color) : null,
    logo_emoji: r.logo_emoji ? String(r.logo_emoji) : null,
  }
}

export async function listCommunitiesForUser(userId: number): Promise<Array<CommunityRecord & { role: CommunityRole }>> {
  if (!userId) return []
  await ensureCommunitiesTables()
  await seedDefaultCommunitiesIfEmpty()
  const pool = getPool()
  const tC = table('mandala_communities')
  const tM = table('mandala_community_members')
  const [memberRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.slug, c.name, c.tagline, c.accent_color, c.logo_emoji, m.role
     FROM ${tM} m
     JOIN ${tC} c ON c.id = m.community_id
     WHERE m.user_id = ? AND c.is_active = 1
     ORDER BY c.name ASC`,
    [userId]
  )
  if (memberRows.length > 0) {
    return memberRows.map((r) => ({
      id: Number(r.id),
      slug: String(r.slug),
      name: String(r.name),
      tagline: r.tagline ? String(r.tagline) : null,
      accent_color: r.accent_color ? String(r.accent_color) : null,
      logo_emoji: r.logo_emoji ? String(r.logo_emoji) : null,
      role: String(r.role) as CommunityRole,
    }))
  }
  // Premier accès : rattacher à toutes les communautés actives en "member" (démo)
  const all = await listCommunities()
  for (const c of all) {
    await pool.execute(
      `INSERT IGNORE INTO ${tM} (community_id, user_id, role) VALUES (?, ?, 'member')`,
      [c.id, userId]
    )
  }
  return listCommunitiesForUser(userId)
}

export async function requireCommunityMembership(
  userId: number,
  communityId: number
): Promise<CommunityRole> {
  await ensureCommunitiesTables()
  const pool = getPool()
  const tM = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT role FROM ${tM} WHERE user_id = ? AND community_id = ? LIMIT 1`,
    [userId, communityId]
  )
  if (!rows.length) throw new Error('Accès communauté refusé')
  return String(rows[0].role) as CommunityRole
}
