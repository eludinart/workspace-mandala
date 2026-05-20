import mysql from 'mysql2/promise'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}

const prefix = process.env.DB_PREFIX || 'mdl_'
const pool = mysql.createPool({
  host: process.env.MARIADB_HOST,
  port: parseInt(process.env.MARIADB_PORT || '3306', 10),
  database: process.env.MARIADB_DATABASE,
  user: process.env.MARIADB_USER,
  password: process.env.MARIADB_PASSWORD,
})

const tC = `${prefix}mandala_communities`
const tM = `${prefix}mandala_community_members`
const tU = `${prefix}users`
const tMeta = `${prefix}usermeta`

try {
  const [cols] = await pool.query(`SHOW COLUMNS FROM ${tC}`)
  console.log('columns:', cols.map((c) => c.Field).join(', '))

  const [rows] = await pool.query(
    `SELECT c.id, c.slug, c.name, c.tagline, c.description, c.location, c.website, c.contact_email,
            c.accent_color, c.logo_emoji, c.avatar, c.is_active, c.created_at,
            (SELECT COUNT(*) FROM ${tM} m WHERE m.community_id = c.id) AS member_count
     FROM ${tC} c WHERE c.id = 1 LIMIT 1`
  )
  console.log('getById ok:', rows[0]?.slug, 'members:', rows[0]?.member_count)

  const [mem] = await pool.query(
    `SELECT m.user_id, m.role, m.joined_at,
            u.user_email AS email,
            COALESCE(u.display_name, '') AS display_name,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', m.user_id)) AS pseudo
     FROM ${tM} m
     JOIN ${tU} u ON u.ID = m.user_id
     LEFT JOIN ${tMeta} p ON p.user_id = m.user_id AND p.meta_key = 'mdl_pseudo'
     WHERE m.community_id = ?
     ORDER BY m.role DESC, pseudo ASC`,
    [rows[0]?.id ?? 1]
  )
  console.log('members ok:', mem.length, mem[0])
} catch (e) {
  console.error('ERR:', e.message, e.code)
} finally {
  await pool.end()
}
