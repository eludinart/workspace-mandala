/**
 * Ressources partagées : métadonnées en base, fichiers sur disque.
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import { ensureCommunitiesTables, listCommunitiesForUser } from './db-communities'
import { removeUpload } from './resource-files'
import {
  isResourceKind,
  isResourceScope,
  MAX_RESOURCE_BODY,
  MAX_RESOURCE_IMAGES,
  MAX_RESOURCE_SUMMARY,
  MAX_RESOURCE_TAGS,
  MAX_RESOURCE_TITLE,
  resourceKindMeta,
  resourceLabelKey,
  type ResourceKind,
  type ResourceScope,
} from './resource-constants'

let _ensured = false

export type ResourceTag = { label: string }
export type ResourceImage = { id: number; sort_order: number }
export type ResourceCard = {
  id: number
  author_id: number
  author_pseudo: string
  author_avatar_emoji: string
  kind: ResourceKind
  title: string
  summary: string
  scope: ResourceScope
  downloadable: boolean
  has_cover: boolean
  has_file: boolean
  file_mime: string | null
  file_name: string | null
  tags: string[]
  is_mine: boolean
  created_at: string | null
}

export type ResourceDetail = ResourceCard & {
  body_text: string
  image_ids: number[]
  places: Array<{ id: number; slug: string; name: string }>
}

async function ensureResourceTables(): Promise<void> {
  if (_ensured || !isDbConfigured()) return
  await ensureCommunitiesTables()
  const pool = getPool()
  const t = table('mandala_resources')
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${t} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      author_id INT NOT NULL,
      kind VARCHAR(16) NOT NULL,
      title VARCHAR(160) NOT NULL,
      summary VARCHAR(280) NOT NULL DEFAULT '',
      body_text MEDIUMTEXT NULL,
      scope VARCHAR(16) NOT NULL DEFAULT 'hidden',
      downloadable TINYINT(1) NOT NULL DEFAULT 0,
      cover_path VARCHAR(255) NULL,
      file_path VARCHAR(255) NULL,
      file_mime VARCHAR(120) NULL,
      file_name VARCHAR(200) NULL,
      file_size INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_author (author_id),
      KEY idx_scope (scope)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${table('mandala_resource_places')} (
      resource_id INT NOT NULL,
      community_id INT NOT NULL,
      PRIMARY KEY (resource_id, community_id),
      KEY idx_community (community_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${table('mandala_resource_tags')} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      resource_id INT NOT NULL,
      label VARCHAR(40) NOT NULL,
      label_key VARCHAR(40) NOT NULL,
      UNIQUE KEY uniq_res_label (resource_id, label_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${table('mandala_resource_images')} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      resource_id INT NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      KEY idx_resource (resource_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  _ensured = true
}

type Stored = {
  id: number
  author_id: number
  kind: ResourceKind
  title: string
  summary: string
  body_text: string
  scope: ResourceScope
  downloadable: boolean
  cover_path: string | null
  file_path: string | null
  file_mime: string | null
  file_name: string | null
  file_size: number | null
  place_ids: number[]
  tags: string[]
  images: Array<{ id: number; file_path: string; sort_order: number }>
  created_at: string | null
}

async function loadStored(id: number): Promise<Stored | null> {
  await ensureResourceTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${table('mandala_resources')} WHERE id = ? LIMIT 1`,
    [id]
  )
  const r = rows[0]
  if (!r || !isResourceKind(r.kind)) return null
  const [placeRows] = await pool.execute<RowDataPacket[]>(
    `SELECT community_id FROM ${table('mandala_resource_places')} WHERE resource_id = ?`,
    [id]
  )
  const [tagRows] = await pool.execute<RowDataPacket[]>(
    `SELECT label FROM ${table('mandala_resource_tags')} WHERE resource_id = ? ORDER BY label ASC`,
    [id]
  )
  const [imageRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, file_path, sort_order FROM ${table('mandala_resource_images')} WHERE resource_id = ? ORDER BY sort_order ASC, id ASC`,
    [id]
  )
  return {
    id,
    author_id: Number(r.author_id),
    kind: r.kind,
    title: String(r.title),
    summary: String(r.summary ?? ''),
    body_text: r.body_text ? String(r.body_text) : '',
    scope: isResourceScope(r.scope) ? r.scope : 'hidden',
    downloadable: Number(r.downloadable) === 1,
    cover_path: r.cover_path ? String(r.cover_path) : null,
    file_path: r.file_path ? String(r.file_path) : null,
    file_mime: r.file_mime ? String(r.file_mime) : null,
    file_name: r.file_name ? String(r.file_name) : null,
    file_size: r.file_size != null ? Number(r.file_size) : null,
    place_ids: (placeRows ?? []).map((p) => Number(p.community_id)),
    tags: (tagRows ?? []).map((t) => String(t.label)),
    images: (imageRows ?? []).map((img) => ({
      id: Number(img.id),
      file_path: String(img.file_path),
      sort_order: Number(img.sort_order),
    })),
    created_at: r.created_at ? new Date(r.created_at as string).toISOString() : null,
  }
}

async function identities(userIds: number[]) {
  const map = new Map<number, { pseudo: string; avatar_emoji: string }>()
  if (!userIds.length) return map
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const ph = userIds.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID AS user_id,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', u.ID)) AS pseudo,
            COALESCE(e.meta_value, '🌸') AS avatar_emoji
     FROM ${tUsers} u
     LEFT JOIN ${tMeta} p ON p.user_id = u.ID AND p.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} e ON e.user_id = u.ID AND e.meta_key = 'mdl_avatar_emoji'
     WHERE u.ID IN (${ph})`,
    userIds
  )
  for (const r of rows ?? []) {
    map.set(Number(r.user_id), {
      pseudo: String(r.pseudo || `user_${r.user_id}`),
      avatar_emoji: String(r.avatar_emoji || '🌸'),
    })
  }
  return map
}

function toCard(row: Stored, viewerId: number, identity: { pseudo: string; avatar_emoji: string }): ResourceCard {
  return {
    id: row.id,
    author_id: row.author_id,
    author_pseudo: identity.pseudo,
    author_avatar_emoji: identity.avatar_emoji,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    scope: row.scope,
    downloadable: row.downloadable,
    has_cover: !!row.cover_path,
    has_file: !!row.file_path,
    file_mime: row.file_mime,
    file_name: row.file_name,
    tags: row.tags,
    is_mine: row.author_id === viewerId,
    created_at: row.created_at,
  }
}

function canSee(row: Stored, viewerId: number, viewerPlaceIds: Set<number>): boolean {
  if (viewerId > 0 && row.author_id === viewerId) return true
  if (row.scope === 'hidden') return false
  if (row.scope === 'mandala') return true
  if (viewerId <= 0) return false
  return row.place_ids.some((id) => viewerPlaceIds.has(id))
}

export async function getResourceForViewer(resourceId: number, viewerId: number): Promise<ResourceDetail | null> {
  const row = await loadStored(resourceId)
  if (!row) return null
  const mine = viewerId > 0 ? await listCommunitiesForUser(viewerId) : []
  const viewerPlaceIds = new Set(mine.map((c) => c.id))
  if (row.scope === 'places' && row.author_id !== viewerId && !canSee(row, viewerId, viewerPlaceIds)) return null
  if (row.scope === 'hidden' && row.author_id !== viewerId) return null
  if (row.scope === 'mandala' && viewerId <= 0) {
    /* public */
  }
  const ids = await identities([row.author_id])
  const identity = ids.get(row.author_id) ?? { pseudo: `user_${row.author_id}`, avatar_emoji: '🌸' }
  const places =
    row.scope === 'places'
      ? mine.filter((c) => row.place_ids.includes(c.id)).map((c) => ({ id: c.id, slug: c.slug, name: c.name }))
      : []
  return {
    ...toCard(row, viewerId, identity),
    body_text: row.body_text,
    image_ids: row.images.map((img) => img.id),
    places,
  }
}

export async function getResourceMedia(
  resourceId: number,
  viewerId: number,
  which: 'file' | 'cover' | 'image',
  imageId?: number
): Promise<{ path: string; mime: string; name: string; downloadable: boolean; author_id: number } | null> {
  const row = await loadStored(resourceId)
  if (!row) return null
  const mine = viewerId > 0 ? await listCommunitiesForUser(viewerId) : []
  const viewerPlaceIds = new Set(mine.map((c) => c.id))
  const publicOk = row.scope === 'mandala'
  const memberOk = viewerId > 0 && canSee(row, viewerId, viewerPlaceIds)
  if (!publicOk && !memberOk) return null
  if (which === 'cover' && row.cover_path) {
    return { path: row.cover_path, mime: 'image/jpeg', name: 'couverture', downloadable: false, author_id: row.author_id }
  }
  if (which === 'file' && row.file_path && row.file_mime) {
    return {
      path: row.file_path,
      mime: row.file_mime,
      name: row.file_name || 'fichier',
      downloadable: row.downloadable,
      author_id: row.author_id,
    }
  }
  if (which === 'image' && imageId) {
    const img = row.images.find((i) => i.id === imageId)
    if (!img) return null
    return { path: img.file_path, mime: 'image/jpeg', name: 'image', downloadable: false, author_id: row.author_id }
  }
  return null
}

function normalizeTags(raw: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const label = item.trim().replace(/\s+/g, ' ').slice(0, 40)
    const key = resourceLabelKey(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(label)
    if (out.length >= MAX_RESOURCE_TAGS) break
  }
  return out
}

export type ResourceInput = {
  kind: ResourceKind
  title: string
  summary: string
  body_text: string
  scope: ResourceScope
  downloadable: boolean
  place_ids: number[]
  tags: string[]
  cover_path?: string | null
  file_path?: string | null
  file_mime?: string | null
  file_name?: string | null
  file_size?: number | null
  image_paths?: string[]
}

export async function createResource(authorId: number, input: ResourceInput): Promise<ResourceDetail> {
  await ensureResourceTables()
  const title = input.title.trim().slice(0, MAX_RESOURCE_TITLE)
  if (!title) throw Object.assign(new Error('Donnez un titre'), { status: 400 })
  const meta = resourceKindMeta(input.kind)
  if (meta.mode === 'text' && !input.body_text.trim()) {
    throw Object.assign(new Error('Collez le texte de la ressource'), { status: 400 })
  }
  if (meta.mode === 'file' && !input.file_path) {
    throw Object.assign(new Error('Ajoutez le fichier'), { status: 400 })
  }
  const mine = await listCommunitiesForUser(authorId)
  const mineIds = new Set(mine.map((c) => c.id))
  const placeIds = input.scope === 'places' ? [...new Set(input.place_ids.filter((id) => mineIds.has(id)))] : []
  if (input.scope === 'places' && !placeIds.length) {
    throw Object.assign(new Error('Cochez au moins un lieu'), { status: 400 })
  }
  const pool = getPool()
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${table('mandala_resources')}
      (author_id, kind, title, summary, body_text, scope, downloadable, cover_path, file_path, file_mime, file_name, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      authorId,
      input.kind,
      title,
      input.summary.trim().slice(0, MAX_RESOURCE_SUMMARY),
      meta.mode === 'text' ? input.body_text.trim().slice(0, MAX_RESOURCE_BODY) : input.summary.trim().slice(0, MAX_RESOURCE_SUMMARY),
      input.scope,
      input.downloadable ? 1 : 0,
      input.cover_path ?? null,
      input.file_path ?? null,
      input.file_mime ?? null,
      input.file_name ? input.file_name.slice(0, 200) : null,
      input.file_size ?? null,
    ]
  )
  const id = Number(res.insertId)
  await replaceLinks(id, placeIds, normalizeTags(input.tags), (input.image_paths ?? []).slice(0, MAX_RESOURCE_IMAGES))
  const detail = await getResourceForViewer(id, authorId)
  if (!detail) throw Object.assign(new Error('Ressource introuvable'), { status: 500 })
  return detail
}

async function replaceLinks(resourceId: number, placeIds: number[], tags: string[], imagePaths: string[]) {
  const pool = getPool()
  await pool.execute(`DELETE FROM ${table('mandala_resource_places')} WHERE resource_id = ?`, [resourceId])
  for (const communityId of placeIds) {
    await pool.execute(
      `INSERT INTO ${table('mandala_resource_places')} (resource_id, community_id) VALUES (?, ?)`,
      [resourceId, communityId]
    )
  }
  await pool.execute(`DELETE FROM ${table('mandala_resource_tags')} WHERE resource_id = ?`, [resourceId])
  for (const label of tags) {
    await pool.execute(
      `INSERT INTO ${table('mandala_resource_tags')} (resource_id, label, label_key) VALUES (?, ?, ?)`,
      [resourceId, label, resourceLabelKey(label)]
    )
  }
  if (imagePaths.length) {
    let order = 0
    for (const filePath of imagePaths) {
      await pool.execute(
        `INSERT INTO ${table('mandala_resource_images')} (resource_id, file_path, sort_order) VALUES (?, ?, ?)`,
        [resourceId, filePath, order++]
      )
    }
  }
}

export async function updateResource(
  resourceId: number,
  userId: number,
  input: ResourceInput & {
    cover_path?: string | null
    clear_cover?: boolean
    remove_image_ids?: number[]
  }
): Promise<ResourceDetail> {
  const row = await loadStored(resourceId)
  if (!row) throw Object.assign(new Error('Ressource introuvable'), { status: 404 })
  if (row.author_id !== userId) throw Object.assign(new Error('Vous ne pouvez modifier que vos ressources'), { status: 403 })
  const title = input.title.trim().slice(0, MAX_RESOURCE_TITLE)
  if (!title) throw Object.assign(new Error('Donnez un titre'), { status: 400 })
  const meta = resourceKindMeta(row.kind)
  const body = meta.mode === 'text' ? input.body_text.trim().slice(0, MAX_RESOURCE_BODY) : input.summary.trim().slice(0, MAX_RESOURCE_SUMMARY)
  if (meta.mode === 'text' && !body) throw Object.assign(new Error('Collez le texte de la ressource'), { status: 400 })
  const mine = await listCommunitiesForUser(userId)
  const mineIds = new Set(mine.map((c) => c.id))
  const placeIds = input.scope === 'places' ? [...new Set(input.place_ids.filter((id) => mineIds.has(id)))] : []
  if (input.scope === 'places' && !placeIds.length) {
    throw Object.assign(new Error('Cochez au moins un lieu'), { status: 400 })
  }

  let coverPath = row.cover_path
  if (input.clear_cover) {
    if (coverPath && coverPath !== row.file_path) await removeUpload(coverPath)
    coverPath = null
  }
  if (input.cover_path) {
    if (coverPath && coverPath !== row.file_path && coverPath !== input.cover_path) await removeUpload(coverPath)
    coverPath = input.cover_path
  }

  let filePath = row.file_path
  let fileMime = row.file_mime
  let fileName = row.file_name
  let fileSize = row.file_size
  if (input.file_path) {
    if (filePath && filePath !== input.file_path && filePath !== coverPath) await removeUpload(filePath)
    filePath = input.file_path
    fileMime = input.file_mime ?? fileMime
    fileName = input.file_name ? input.file_name.slice(0, 200) : fileName
    fileSize = input.file_size ?? fileSize
  }
  if (meta.mode === 'file' && !filePath) throw Object.assign(new Error('Ajoutez le fichier'), { status: 400 })

  const pool = getPool()
  await pool.execute(
    `UPDATE ${table('mandala_resources')}
     SET title = ?, summary = ?, body_text = ?, scope = ?, downloadable = ?,
         cover_path = ?, file_path = ?, file_mime = ?, file_name = ?, file_size = ?
     WHERE id = ? AND author_id = ?`,
    [
      title,
      input.summary.trim().slice(0, MAX_RESOURCE_SUMMARY),
      body,
      input.scope,
      input.downloadable ? 1 : 0,
      coverPath,
      filePath,
      fileMime,
      fileName,
      fileSize,
      resourceId,
      userId,
    ]
  )

  await pool.execute(`DELETE FROM ${table('mandala_resource_places')} WHERE resource_id = ?`, [resourceId])
  for (const communityId of placeIds) {
    await pool.execute(
      `INSERT INTO ${table('mandala_resource_places')} (resource_id, community_id) VALUES (?, ?)`,
      [resourceId, communityId]
    )
  }
  const tags = normalizeTags(input.tags)
  await pool.execute(`DELETE FROM ${table('mandala_resource_tags')} WHERE resource_id = ?`, [resourceId])
  for (const label of tags) {
    await pool.execute(
      `INSERT INTO ${table('mandala_resource_tags')} (resource_id, label, label_key) VALUES (?, ?, ?)`,
      [resourceId, label, resourceLabelKey(label)]
    )
  }

  const removeIds = new Set((input.remove_image_ids ?? []).filter((id) => id > 0))
  for (const img of row.images) {
    if (!removeIds.has(img.id)) continue
    if (img.file_path !== filePath && img.file_path !== coverPath) await removeUpload(img.file_path)
    await pool.execute(`DELETE FROM ${table('mandala_resource_images')} WHERE id = ? AND resource_id = ?`, [
      img.id,
      resourceId,
    ])
  }
  const kept = row.images.filter((img) => !removeIds.has(img.id)).length
  const room = Math.max(0, MAX_RESOURCE_IMAGES - kept)
  let order = kept
  for (const file of (input.image_paths ?? []).slice(0, room)) {
    await pool.execute(
      `INSERT INTO ${table('mandala_resource_images')} (resource_id, file_path, sort_order) VALUES (?, ?, ?)`,
      [resourceId, file, order++]
    )
  }

  const detail = await getResourceForViewer(resourceId, userId)
  if (!detail) throw Object.assign(new Error('Ressource introuvable'), { status: 500 })
  return detail
}

export async function deleteResource(resourceId: number, userId: number): Promise<void> {
  const row = await loadStored(resourceId)
  if (!row) throw Object.assign(new Error('Ressource introuvable'), { status: 404 })
  if (row.author_id !== userId) throw Object.assign(new Error('Vous ne pouvez retirer que vos ressources'), { status: 403 })
  await removeUpload(row.cover_path)
  await removeUpload(row.file_path)
  for (const img of row.images) await removeUpload(img.file_path)
  const pool = getPool()
  await pool.execute(`DELETE FROM ${table('mandala_resource_images')} WHERE resource_id = ?`, [resourceId])
  await pool.execute(`DELETE FROM ${table('mandala_resource_tags')} WHERE resource_id = ?`, [resourceId])
  await pool.execute(`DELETE FROM ${table('mandala_resource_places')} WHERE resource_id = ?`, [resourceId])
  await pool.execute(`DELETE FROM ${table('mandala_resources')} WHERE id = ?`, [resourceId])
}

async function cardsFromIds(ids: number[], viewerId: number): Promise<ResourceCard[]> {
  const cards: ResourceCard[] = []
  const authors = new Set<number>()
  const rows: Stored[] = []
  for (const id of ids) {
    const row = await loadStored(id)
    if (!row || row.scope === 'hidden') continue
    rows.push(row)
    authors.add(row.author_id)
  }
  const names = await identities([...authors])
  for (const row of rows) {
    const identity = names.get(row.author_id) ?? { pseudo: `user_${row.author_id}`, avatar_emoji: '🌸' }
    cards.push(toCard(row, viewerId, identity))
  }
  cards.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  return cards
}

export async function listResourcesForViewer(params: {
  viewerId: number
  view: 'place' | 'mandala'
  communityId?: number | null
  publicAccess?: boolean
}): Promise<ResourceCard[]> {
  await ensureResourceTables()
  const mine = params.viewerId > 0 ? await listCommunitiesForUser(params.viewerId) : []
  const viewerPlaceIds = new Set(mine.map((c) => c.id))
  const pool = getPool()
  const t = table('mandala_resources')
  const tPlaces = table('mandala_resource_places')
  const tM = table('mandala_community_members')
  let ids: number[] = []
  if (params.view === 'mandala') {
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT id FROM ${t} WHERE scope = 'mandala'`)
    ids = (rows ?? []).map((r) => Number(r.id))
  } else {
    const communityId = params.communityId
    if (!communityId) return []
    if (!params.publicAccess && !viewerPlaceIds.has(communityId)) return []
    const visibility = params.publicAccess
      ? `r.scope = 'mandala'`
      : `r.scope = 'mandala' OR (r.scope = 'places' AND EXISTS (
           SELECT 1 FROM ${tPlaces} rp WHERE rp.resource_id = r.id AND rp.community_id = ?
         ))`
    const sqlParams = params.publicAccess ? [communityId] : [communityId, communityId]
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.id FROM ${t} r
       JOIN ${tM} m ON m.user_id = r.author_id AND m.community_id = ?
       WHERE ${visibility}`,
      sqlParams
    )
    ids = (rows ?? []).map((r) => Number(r.id))
  }
  return cardsFromIds(ids, params.viewerId)
}

export async function listMyResources(userId: number): Promise<ResourceCard[]> {
  await ensureResourceTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${table('mandala_resources')} WHERE author_id = ? ORDER BY updated_at DESC`,
    [userId]
  )
  const cards: ResourceCard[] = []
  const names = await identities([userId])
  const identity = names.get(userId) ?? { pseudo: `user_${userId}`, avatar_emoji: '🌸' }
  for (const r of rows ?? []) {
    const row = await loadStored(Number(r.id))
    if (row) cards.push(toCard(row, userId, identity))
  }
  return cards
}

export async function deleteResourcesForUser(userId: number): Promise<void> {
  if (!isDbConfigured() || !userId) return
  await ensureResourceTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${table('mandala_resources')} WHERE author_id = ?`,
    [userId]
  )
  for (const r of rows ?? []) {
    await deleteResource(Number(r.id), userId)
  }
}
