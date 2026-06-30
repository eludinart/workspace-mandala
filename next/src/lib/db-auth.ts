/**
 * Opérations auth/account sur MariaDB (tables WordPress).
 */
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import { verifyWordPressPassword } from './auth-wordpress'
import { hash } from 'bcryptjs'
import { isBootstrapAdminEmail } from './admin-bootstrap'
import {
  META_FIRST_NAME,
  META_LAST_NAME,
  META_SHOW_FULL_LAST_NAME,
  formatFullName,
  formatPublicDisplayName,
  validatePersonName,
} from './mandala-display-name'

let _authTablesEnsured = false

/** Crée mdl_users, mdl_usermeta, mdl_mandala_app_roles si absentes. */
export async function ensureAuthTables(): Promise<void> {
  if (_authTablesEnsured || !isDbConfigured()) return
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const tRoles = table('mandala_app_roles')
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tUsers} (
      ID BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_login VARCHAR(60) NOT NULL DEFAULT '',
      user_pass VARCHAR(255) NOT NULL DEFAULT '',
      user_nicename VARCHAR(50) NOT NULL DEFAULT '',
      user_email VARCHAR(100) NOT NULL DEFAULT '',
      user_url VARCHAR(100) NOT NULL DEFAULT '',
      user_registered DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
      user_activation_key VARCHAR(255) NOT NULL DEFAULT '',
      user_status INT NOT NULL DEFAULT 0,
      display_name VARCHAR(250) NOT NULL DEFAULT '',
      PRIMARY KEY (ID),
      KEY user_login_key (user_login),
      KEY user_nicename (user_nicename),
      KEY user_email (user_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tMeta} (
      umeta_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
      meta_key VARCHAR(255) DEFAULT NULL,
      meta_value LONGTEXT,
      PRIMARY KEY (umeta_id),
      KEY user_id (user_id),
      KEY meta_key (meta_key(191))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tRoles} (
      user_id BIGINT UNSIGNED NOT NULL,
      app_role VARCHAR(32) NOT NULL DEFAULT 'user',
      PRIMARY KEY (user_id),
      KEY idx_app_role (app_role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  _authTablesEnsured = true
}

export type UserRecord = {
  id: number
  email: string
  login: string
  name: string
  wp_role: string
  app_role: string
  registered: string
  pseudo?: string | null
  first_name?: string | null
  last_name?: string | null
  show_full_last_name?: boolean
  bio?: string | null
  avatar?: string | null
  avatar_emoji?: string | null
  profile_public?: boolean
  points_de_rosee?: number
  avatar_graine_id?: string | null
  coach_headline?: string | null
  coach_short_bio?: string | null
  coach_long_bio?: string | null
  coach_specialties?: string[]
  coach_languages?: string[]
  coach_response_time_label?: string | null
  coach_response_time_hours?: number | null
  coach_is_listed?: boolean
  coach_years_experience?: number | null
  coach_reviews_label?: string | null
  coach_verified?: boolean
  coach_request_status?: string | null
  coach_request_at?: string | null
  coach_request_message?: string | null
  theme_mode?: string | null
  theme_palette?: string | null
}

async function getWpRole(userId: number): Promise<string> {
  const pool = getPool()
  const prefix = process.env.DB_PREFIX || 'wp_'
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${prefix}usermeta WHERE user_id = ? AND meta_key = ?`,
    [userId, `${prefix}capabilities`]
  )
  const val = rows[0]?.meta_value
  if (!val) return 'subscriber'
  try {
    const caps = parseWpSerializedCaps(val) as Record<string, number>
    if (!caps || typeof caps !== 'object') return 'subscriber'
    const priority = ['administrator', 'editor', 'author', 'contributor', 'subscriber']
    for (const r of priority) {
      if (caps[r]) return r
    }
    return (Object.keys(caps)[0] as string) || 'subscriber'
  } catch {
    return 'subscriber'
  }
}

async function getAppRole(userId: number, wpRole: string, email?: string): Promise<string> {
  if (isBootstrapAdminEmail(email)) return 'admin'
  const pool = getPool()
  const tRoles = table('mandala_app_roles')
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT app_role FROM ${tRoles} WHERE user_id = ?`,
      [userId]
    )
    const role = rows[0]?.app_role
    if (role) return String(role)
  } catch {
    // Table might not exist
  }
  return wpRole === 'administrator' ? 'admin' : 'user'
}

/** Parse WordPress serialized capabilities a:1:{s:10:"administrator";i:1;} */
function parseWpSerializedCaps(s: string): Record<string, number> | null {
  if (!s || typeof s !== 'string') return null
  const out: Record<string, number> = {}
  const re = /s:(\d+):"([^"]+)";i:(\d+);/g
  let m
  while ((m = re.exec(s)) !== null) {
    out[m[2]] = parseInt(m[3], 10)
  }
  return Object.keys(out).length ? out : null
}

async function appendProfileMeta(userId: number, out: Record<string, unknown>): Promise<void> {
  const pool = getPool()
  const tbl = table('usermeta')
  const keys = [
    'mdl_pseudo',
    META_FIRST_NAME,
    META_LAST_NAME,
    META_SHOW_FULL_LAST_NAME,
    'mdl_bio',
    'mdl_avatar',
    'mdl_avatar_emoji',
    'mdl_profile_public',
    'mdl_points_de_rosee',
    'mdl_avatar_graine_id',
    'mdl_coach_headline',
    'mdl_coach_short_bio',
    'mdl_coach_long_bio',
    'mdl_coach_specialties',
    'mdl_coach_languages',
    'mdl_coach_response_time_label',
    'mdl_coach_response_time_hours',
    'mdl_coach_is_listed',
    'mdl_coach_years_experience',
    'mdl_coach_reviews_label',
    'mdl_coach_verified',
    'mdl_coach_request_status',
    'mdl_coach_request_at',
    'mdl_coach_request_message',
    'mdl_theme_mode',
    'mdl_theme_palette',
  ]
  const placeholders = keys.map(() => '?').join(', ')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_key, meta_value FROM ${tbl} WHERE user_id = ? AND meta_key IN (${placeholders})`,
    [userId, ...keys]
  )
  const meta: Record<string, string> = {}
  for (const r of rows) {
    meta[r.meta_key] = r.meta_value
  }
  ;(out as Record<string, unknown>).pseudo = meta.mdl_pseudo || null
  ;(out as Record<string, unknown>).first_name = meta[META_FIRST_NAME] || null
  ;(out as Record<string, unknown>).last_name = meta[META_LAST_NAME] || null
  ;(out as Record<string, unknown>).show_full_last_name =
    (meta[META_SHOW_FULL_LAST_NAME] ?? '') === '1'
  ;(out as Record<string, unknown>).bio = meta.mdl_bio || null
  ;(out as Record<string, unknown>).avatar = meta.mdl_avatar || null
  ;(out as Record<string, unknown>).avatar_emoji = meta.mdl_avatar_emoji || null
  ;(out as Record<string, unknown>).profile_public = (meta.mdl_profile_public ?? '') === '1'
  ;(out as Record<string, unknown>).points_de_rosee = parseInt(meta.mdl_points_de_rosee ?? '5', 10)
  ;(out as Record<string, unknown>).avatar_graine_id = meta.mdl_avatar_graine_id || null
  ;(out as Record<string, unknown>).coach_headline = meta.mdl_coach_headline || null
  ;(out as Record<string, unknown>).coach_short_bio = meta.mdl_coach_short_bio || null
  ;(out as Record<string, unknown>).coach_long_bio = meta.mdl_coach_long_bio || null
  try {
    ;(out as Record<string, unknown>).coach_specialties = meta.mdl_coach_specialties
      ? JSON.parse(meta.mdl_coach_specialties)
      : []
  } catch {
    ;(out as Record<string, unknown>).coach_specialties = []
  }
  try {
    ;(out as Record<string, unknown>).coach_languages = meta.mdl_coach_languages
      ? JSON.parse(meta.mdl_coach_languages)
      : []
  } catch {
    ;(out as Record<string, unknown>).coach_languages = []
  }
  ;(out as Record<string, unknown>).coach_response_time_label = meta.mdl_coach_response_time_label || null
  ;(out as Record<string, unknown>).coach_response_time_hours = meta.mdl_coach_response_time_hours
    ? parseInt(meta.mdl_coach_response_time_hours, 10)
    : null
  ;(out as Record<string, unknown>).coach_is_listed = (meta.mdl_coach_is_listed ?? '1') !== '0'
  ;(out as Record<string, unknown>).coach_years_experience = meta.mdl_coach_years_experience
    ? parseInt(meta.mdl_coach_years_experience, 10)
    : null
  ;(out as Record<string, unknown>).coach_reviews_label = meta.mdl_coach_reviews_label || null
  ;(out as Record<string, unknown>).coach_verified = (meta.mdl_coach_verified ?? '0') === '1'
  ;(out as Record<string, unknown>).coach_request_status = meta.mdl_coach_request_status || null
  ;(out as Record<string, unknown>).coach_request_at = meta.mdl_coach_request_at || null
  ;(out as Record<string, unknown>).coach_request_message = meta.mdl_coach_request_message || null
  ;(out as Record<string, unknown>).theme_mode =
    meta.mdl_theme_mode === 'light' ? 'light' : 'dark'
  ;(out as Record<string, unknown>).theme_palette = meta.mdl_theme_palette || 'violet'
}

export async function authLogin(login: string, password: string): Promise<UserRecord> {
  await ensureAuthTables()
  const pool = getPool()
  const tbl = table('users')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ID, user_login, user_email, display_name, user_pass, user_registered, user_status
     FROM ${tbl} WHERE user_email = ? OR user_login = ? LIMIT 1`,
    [login, login]
  )
  const user = rows[0]
  if (!user) throw new Error('Identifiant ou mot de passe incorrect')

  const ok = await verifyWordPressPassword(password, user.user_pass || '')
  if (!ok) throw new Error('Identifiant ou mot de passe incorrect')

  const userId = Number(user.ID)
  await updateLastLogin(userId)

  const wpRole = await getWpRole(userId)
  const appRole = await getAppRole(userId, wpRole, user.user_email || '')
  const out: UserRecord = {
    id: userId,
    email: user.user_email || '',
    login: user.user_login || '',
    name: user.display_name || '',
    wp_role: wpRole,
    app_role: appRole,
    registered: user.user_registered || '',
  }
  await appendProfileMeta(userId, out as unknown as Record<string, unknown>)
  return out
}

async function updateLastLogin(userId: number): Promise<void> {
  const pool = getPool()
  const tbl = table('usermeta')
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tbl} WHERE user_id = ? AND meta_key = ?`,
    [userId, 'mdl_last_login']
  )
  if (existing.length > 0) {
    await pool.execute(
      `UPDATE ${tbl} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`,
      [now, userId, 'mdl_last_login']
    )
  } else {
    await pool.execute(
      `INSERT INTO ${tbl} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
      [userId, 'mdl_last_login', now]
    )
  }
}

export async function authMe(userId: number): Promise<UserRecord> {
  await ensureAuthTables()
  const pool = getPool()
  const tbl = table('users')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ID, user_login, user_email, display_name, user_registered FROM ${tbl} WHERE ID = ?`,
    [userId]
  )
  const user = rows[0]
  if (!user) throw new Error('Utilisateur introuvable')

  const uid = Number(user.ID)
  const wpRole = await getWpRole(uid)
  const appRole = await getAppRole(uid, wpRole, user.user_email || '')
  const out: UserRecord = {
    id: uid,
    email: user.user_email || '',
    login: user.user_login || '',
    name: user.display_name || '',
    wp_role: wpRole,
    app_role: appRole,
    registered: user.user_registered || '',
  }
  await appendProfileMeta(uid, out as unknown as Record<string, unknown>)
  return out
}

function wpRoleFromCapsMeta(capsSerialized: string | null): string {
  if (!capsSerialized || typeof capsSerialized !== 'string') return 'subscriber'
  const re = /s:\d+:"([^"]+)";i:\d+;/g
  const roles: string[] = []
  let m
  while ((m = re.exec(capsSerialized)) !== null) roles.push(m[1])
  const priority = ['administrator', 'editor', 'author', 'contributor', 'subscriber']
  for (const r of priority) {
    if (roles.includes(r)) return r
  }
  return roles[0] || 'subscriber'
}

function effectiveAppRoleFromCapsRow(appRoleRow: string | null | undefined, capsSerialized: string | null): string {
  const ar = appRoleRow ? String(appRoleRow).trim() : ''
  if (ar) return ar
  const wp = wpRoleFromCapsMeta(capsSerialized)
  return wp === 'administrator' ? 'admin' : 'user'
}

/** IDs avec rôle effectif admin (mandala_app_roles ou WP administrator), pour classifier les messages coach. */
export async function batchUserIdsWithAdminAccess(userIds: number[]): Promise<Set<number>> {
  const ids = [...new Set(userIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))]
  if (ids.length === 0) return new Set()
  const pool = getPool()
  const prefix = process.env.DB_PREFIX || 'wp_'
  const usersTbl = table('users')
  const rolesTbl = table('mandala_app_roles')
  const metaTbl = table('usermeta')
  const capKey = `${prefix}capabilities`
  const placeholders = ids.map(() => '?').join(', ')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID as id, r.app_role as app_role,
            (SELECT meta_value FROM ${metaTbl} WHERE user_id = u.ID AND meta_key = ? LIMIT 1) as caps
     FROM ${usersTbl} u
     LEFT JOIN ${rolesTbl} r ON r.user_id = u.ID
     WHERE u.ID IN (${placeholders})`,
    [capKey, ...ids]
  )
  const admins = new Set<number>()
  for (const r of rows) {
    const eff = effectiveAppRoleFromCapsRow(r.app_role as string | null, r.caps as string | null)
    if (eff === 'admin' || eff === 'administrator') admins.add(Number(r.id))
  }
  return admins
}

async function syncUserDisplayIdentity(
  userId: number,
  firstName: string,
  lastName: string,
  showFullLastName: boolean
): Promise<void> {
  const pool = getPool()
  const tbl = table('users')
  const fullName = formatFullName(firstName, lastName)
  const publicName = formatPublicDisplayName(firstName, lastName, showFullLastName)
  await pool.execute(`UPDATE ${tbl} SET display_name = ? WHERE ID = ?`, [
    fullName || publicName,
    userId,
  ])
  await upsertUsermeta(userId, META_FIRST_NAME, firstName)
  await upsertUsermeta(userId, META_LAST_NAME, lastName)
  await upsertUsermeta(userId, META_SHOW_FULL_LAST_NAME, showFullLastName ? '1' : '0')
  await upsertUsermeta(userId, 'mdl_pseudo', publicName)
}

export async function authRegister(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<UserRecord> {
  await ensureAuthTables()
  const pool = getPool()
  const tbl = table('users')
  const prefix = process.env.DB_PREFIX || 'wp_'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Adresse email invalide')
  }
  if (password.length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caractères')
  }

  const safeFirst = validatePersonName(firstName, 'Prénom')
  const safeLast = validatePersonName(lastName, 'Nom de famille')

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM ${tbl} WHERE user_email = ? LIMIT 1`,
    [email]
  )
  if (existing.length > 0) throw new Error('Cet email est déjà utilisé')

  const baseLogin = (email.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'user'
  let userLogin = baseLogin
  let n = 0
  while (true) {
    const [dup] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM ${tbl} WHERE user_login = ? OR user_email = ? LIMIT 1`,
      [userLogin, email]
    )
    if (dup.length === 0) break
    userLogin = baseLogin + ++n
  }

  const userPass = await hash(password, 10)
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const fullName = formatFullName(safeFirst, safeLast)
  const nicename = fullName.replace(/[^a-z0-9\s\-_]/gi, '').slice(0, 50) || userLogin
  const displayName = fullName || userLogin

  await pool.execute(
    `INSERT INTO ${tbl} (user_login, user_pass, user_nicename, user_email, user_registered, user_status, display_name)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [userLogin, userPass, nicename, email, now, displayName]
  )
  const [ins] = await pool.execute<RowDataPacket[]>('SELECT LAST_INSERT_ID() as id')
  const userId = Number(ins[0]?.id)

  // Première connexion: l'inscription connecte immédiatement, donc on fixe aussi le last_login.
  await updateLastLogin(userId)

  await pool.execute(
    `INSERT INTO ${prefix}usermeta (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
    [userId, `${prefix}capabilities`, `a:1:{s:10:"subscriber";i:1;}`]
  )
  await pool.execute(
    `INSERT INTO ${prefix}usermeta (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
    [userId, `${prefix}user_level`, '0']
  )
  // Par défaut, tout nouvel utilisateur est visible dans le Grand Jardin.
  // (Comportement inversable dans "Mon compte".)
  await pool.execute(
    `INSERT INTO ${prefix}usermeta (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
    [userId, 'mdl_profile_public', '1']
  )

  await syncUserDisplayIdentity(userId, safeFirst, safeLast, false)

  const wpRole = await getWpRole(userId)
  const appRole = await getAppRole(userId, wpRole, email)
  const out: UserRecord = {
    id: userId,
    email,
    login: userLogin,
    name: displayName,
    wp_role: wpRole,
    app_role: appRole,
    registered: now,
  }
  await appendProfileMeta(userId, out as unknown as Record<string, unknown>)
  return out
}

async function upsertUsermeta(userId: number, metaKey: string, metaValue: string): Promise<void> {
  const pool = getPool()
  const tbl = table('usermeta')
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tbl} WHERE user_id = ? AND meta_key = ?`,
    [userId, metaKey]
  )
  if (existing.length > 0) {
    await pool.execute(
      `UPDATE ${tbl} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`,
      [metaValue, userId, metaKey]
    )
  } else {
    await pool.execute(
      `INSERT INTO ${tbl} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
      [userId, metaKey, metaValue]
    )
  }
}

async function forceUsermeta(userId: number, metaKey: string, metaValue: string): Promise<void> {
  const pool = getPool()
  const tbl = table('usermeta')
  await pool.execute(`DELETE FROM ${tbl} WHERE user_id = ? AND meta_key = ?`, [userId, metaKey])
  await pool.execute(
    `INSERT INTO ${tbl} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
    [userId, metaKey, metaValue]
  )
}

export async function updateProfile(
  userId: number,
  body: Record<string, unknown>
): Promise<UserRecord> {
  const pool = getPool()
  const metaTbl = table('usermeta')
  const readMeta = async (key: string): Promise<string> => {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${metaTbl} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
      [userId, key]
    )
    return String(rows[0]?.meta_value ?? '')
  }

  const touchesIdentity =
    Object.prototype.hasOwnProperty.call(body, 'first_name') ||
    Object.prototype.hasOwnProperty.call(body, 'last_name') ||
    Object.prototype.hasOwnProperty.call(body, 'show_full_last_name') ||
    Object.prototype.hasOwnProperty.call(body, 'name')

  if (touchesIdentity) {
    let first = await readMeta(META_FIRST_NAME)
    let last = await readMeta(META_LAST_NAME)
    let showFull = (await readMeta(META_SHOW_FULL_LAST_NAME)) === '1'

    if (Object.prototype.hasOwnProperty.call(body, 'first_name')) {
      first = validatePersonName(String(body.first_name ?? ''), 'Prénom')
    }
    if (Object.prototype.hasOwnProperty.call(body, 'last_name')) {
      last = validatePersonName(String(body.last_name ?? ''), 'Nom de famille')
    }
    if (Object.prototype.hasOwnProperty.call(body, 'show_full_last_name')) {
      showFull = !!body.show_full_last_name
    }
    // Compat ancien champ « name » : ignoré si prénom/nom déjà renseignés
    if (
      Object.prototype.hasOwnProperty.call(body, 'name') &&
      !Object.prototype.hasOwnProperty.call(body, 'first_name') &&
      !Object.prototype.hasOwnProperty.call(body, 'last_name')
    ) {
      const legacy = String(body.name ?? '').trim()
      if (legacy && !first && !last) {
        const parts = legacy.split(/\s+/)
        first = validatePersonName(parts[0] ?? '', 'Prénom')
        last = validatePersonName(parts.slice(1).join(' ') || (parts[0] ?? ''), 'Nom de famille')
      }
    }

    if (!first || !last) {
      throw new Error('Prénom et nom de famille requis')
    }
    await syncUserDisplayIdentity(userId, first, last, showFull)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'bio')) {
    const bio = String(body.bio ?? '').trim().slice(0, 500)
    await upsertUsermeta(userId, 'mdl_bio', bio)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'avatar')) {
    const avatar = body.avatar
    if (avatar === null || avatar === '') {
      await upsertUsermeta(userId, 'mdl_avatar', '')
    } else if (typeof avatar === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,/i.test(avatar)) {
      const raw = Buffer.from(avatar.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      const maxAvatarBytes = 150_000
      if (raw.length > maxAvatarBytes) {
        throw new Error(
          `Photo trop volumineuse (${Math.round(raw.length / 1024)} Ko). Maximum : ${Math.round(maxAvatarBytes / 1024)} Ko.`
        )
      }
      await upsertUsermeta(userId, 'mdl_avatar', avatar)
    } else if (typeof avatar === 'string' && avatar.length > 0) {
      throw new Error('Format de photo non supporté')
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'avatar_emoji')) {
    const emoji = String(body.avatar_emoji ?? '').trim().slice(0, 8)
    await upsertUsermeta(userId, 'mdl_avatar_emoji', emoji)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'profile_public')) {
    const pub = body.profile_public ? '1' : '0'
    await forceUsermeta(userId, 'mdl_profile_public', pub)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'avatar_graine_id')) {
    const gid = String(body.avatar_graine_id ?? '').trim().slice(0, 50)
    await upsertUsermeta(userId, 'mdl_avatar_graine_id', gid)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_headline')) {
    const v = String(body.coach_headline ?? '').trim().slice(0, 120)
    await upsertUsermeta(userId, 'mdl_coach_headline', v)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_short_bio')) {
    const v = String(body.coach_short_bio ?? '').trim().slice(0, 280)
    await upsertUsermeta(userId, 'mdl_coach_short_bio', v)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_long_bio')) {
    const v = String(body.coach_long_bio ?? '').trim().slice(0, 2500)
    await upsertUsermeta(userId, 'mdl_coach_long_bio', v)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_specialties')) {
    const src = Array.isArray(body.coach_specialties) ? body.coach_specialties : []
    const values = src
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((x) => x.slice(0, 80))
    await upsertUsermeta(userId, 'mdl_coach_specialties', JSON.stringify(values))
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_languages')) {
    const src = Array.isArray(body.coach_languages) ? body.coach_languages : []
    const values = src
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((x) => x.slice(0, 40))
    await upsertUsermeta(userId, 'mdl_coach_languages', JSON.stringify(values))
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_response_time_label')) {
    const v = String(body.coach_response_time_label ?? '').trim().slice(0, 60)
    await upsertUsermeta(userId, 'mdl_coach_response_time_label', v)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_response_time_hours')) {
    const n = parseInt(String(body.coach_response_time_hours ?? ''), 10)
    const safe = !isNaN(n) && n >= 1 && n <= 168 ? n : 24
    await upsertUsermeta(userId, 'mdl_coach_response_time_hours', String(safe))
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_is_listed')) {
    await upsertUsermeta(userId, 'mdl_coach_is_listed', body.coach_is_listed ? '1' : '0')
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_years_experience')) {
    const n = parseInt(String(body.coach_years_experience ?? ''), 10)
    const safe = !isNaN(n) && n >= 0 && n <= 60 ? n : 0
    await upsertUsermeta(userId, 'mdl_coach_years_experience', String(safe))
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_reviews_label')) {
    const v = String(body.coach_reviews_label ?? '').trim().slice(0, 120)
    await upsertUsermeta(userId, 'mdl_coach_reviews_label', v)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_verified')) {
    await upsertUsermeta(userId, 'mdl_coach_verified', body.coach_verified ? '1' : '0')
  }
  if (Object.prototype.hasOwnProperty.call(body, 'theme_mode')) {
    const m = body.theme_mode === 'light' ? 'light' : 'dark'
    await upsertUsermeta(userId, 'mdl_theme_mode', m)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'theme_palette')) {
    const allowed = new Set([
      'violet',
      'indigo',
      'ocean',
      'forest',
      'amber',
      'rose',
      'stone',
      'fuchsia',
    ])
    const p = String(body.theme_palette ?? '').toLowerCase()
    if (allowed.has(p)) await upsertUsermeta(userId, 'mdl_theme_palette', p)
  }
  return authMe(userId)
}

export type AdminUserListItem = {
  id: number
  login: string
  email: string
  name: string
  registered: string
  wp_role: string
  app_role: string
  pseudo: string | null
}

export async function listUsersAdmin(params: {
  search?: string
  role?: string
  limit?: number
}): Promise<{ items: AdminUserListItem[]; total: number }> {
  if (!isDbConfigured()) return { items: [], total: 0 }
  await ensureAuthTables()
  const pool = getPool()
  const usersTbl = table('users')
  const rolesTbl = table('mandala_app_roles')
  const metaTbl = table('usermeta')
  const prefix = process.env.DB_PREFIX || 'wp_'
  const capKey = `${prefix}capabilities`
  const limit = Math.min(500, Math.max(1, params.limit ?? 200))
  const search = String(params.search ?? '').trim().toLowerCase()
  const roleFilter = String(params.role ?? '').trim().toLowerCase()

  let where = '1=1'
  const values: (string | number)[] = []
  if (search) {
    where += ` AND (LOWER(u.user_email) LIKE ? OR LOWER(u.user_login) LIKE ? OR LOWER(u.display_name) LIKE ?)`
    const q = `%${search}%`
    values.push(q, q, q)
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID as id, u.user_login as login, u.user_email as email, u.display_name as name,
            u.user_registered as registered, r.app_role,
            (SELECT meta_value FROM ${metaTbl} WHERE user_id = u.ID AND meta_key = ? LIMIT 1) as caps,
            (SELECT meta_value FROM ${metaTbl} WHERE user_id = u.ID AND meta_key = 'mdl_pseudo' LIMIT 1) as pseudo
     FROM ${usersTbl} u
     LEFT JOIN ${rolesTbl} r ON r.user_id = u.ID
     WHERE ${where}
     ORDER BY u.user_registered DESC
     LIMIT ?`,
    [...values, capKey, limit]
  )

  const items: AdminUserListItem[] = []
  for (const r of rows) {
    const caps = r.caps ? parseWpSerializedCaps(String(r.caps)) : null
    let wpRole = 'subscriber'
    if (caps) {
      const priority = ['administrator', 'editor', 'author', 'contributor', 'subscriber']
      for (const role of priority) {
        if (caps[role]) {
          wpRole = role
          break
        }
      }
    }
    const appRole = r.app_role
      ? String(r.app_role)
      : wpRole === 'administrator'
        ? 'admin'
        : 'user'
    if (roleFilter && appRole !== roleFilter && wpRole !== roleFilter) continue
    items.push({
      id: Number(r.id),
      login: String(r.login ?? ''),
      email: String(r.email ?? ''),
      name: String(r.name ?? ''),
      registered: r.registered ? String(r.registered) : '',
      wp_role: wpRole,
      app_role: appRole,
      pseudo: r.pseudo ? String(r.pseudo) : null,
    })
  }
  return { items, total: items.length }
}

export async function setUserPassword(userId: number, newPassword: string): Promise<void> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureAuthTables()
  const pwd = String(newPassword ?? '')
  if (pwd.length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caractères')
  }
  if (pwd.length > 128) {
    throw new Error('Mot de passe trop long')
  }
  const pool = getPool()
  const tbl = table('users')
  const userPass = await hash(pwd, 10)
  const [res] = await pool.execute(`UPDATE ${tbl} SET user_pass = ? WHERE ID = ?`, [userPass, userId])
  const affected = Number((res as { affectedRows?: number }).affectedRows ?? 0)
  if (!affected) throw new Error('Utilisateur introuvable')
}

export async function updateUserAppRole(userId: number, appRole: string): Promise<void> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureAuthTables()
  let stored = String(appRole ?? 'user').trim().slice(0, 32)
  if (stored === 'coach') stored = 'site_manager'
  if (!['user', 'site_manager', 'admin'].includes(stored)) {
    throw new Error('Rôle invalide')
  }
  const pool = getPool()
  const rolesTbl = table('mandala_app_roles')
  await pool.execute(
    `INSERT INTO ${rolesTbl} (user_id, app_role) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE app_role = ?`,
    [userId, stored, stored]
  )
}

/** Suppression définitive du compte (tous les lieux puis utilisateur). */
export async function deleteUserAccount(userId: number): Promise<void> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  if (!userId) throw new Error('Utilisateur invalide')
  await ensureAuthTables()

  const user = await authMe(userId)
  if (isBootstrapAdminEmail(String(user.email ?? ''))) {
    throw new Error('Ce compte système ne peut pas être supprimé')
  }

  const { listCommunitiesForUser, removeUserFromCommunity } = await import('./db-communities')
  const communities = await listCommunitiesForUser(userId)
  for (const c of communities) {
    await removeUserFromCommunity(c.id, userId)
  }

  const pool = getPool()
  const metaTbl = table('usermeta')
  const rolesTbl = table('mandala_app_roles')
  const usersTbl = table('users')

  try {
    const deliveriesTbl = table('mandala_notification_deliveries')
    await pool.execute(`DELETE FROM ${deliveriesTbl} WHERE user_id = ?`, [userId])
  } catch {
    /* table optionnelle */
  }

  await pool.execute(`DELETE FROM ${metaTbl} WHERE user_id = ?`, [userId])
  await pool.execute(`DELETE FROM ${rolesTbl} WHERE user_id = ?`, [userId])
  const [res] = await pool.execute(`DELETE FROM ${usersTbl} WHERE ID = ?`, [userId])
  const affected = Number((res as { affectedRows?: number }).affectedRows ?? 0)
  if (!affected) throw new Error('Utilisateur introuvable')
}
