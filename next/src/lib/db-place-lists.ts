/**
 * Listes partagées par lieu : Courses & Logistique.
 * Courses = 1 personne max ; Logistique = plusieurs personnes peuvent s'engager.
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

export type PlaceListKind = 'courses' | 'logistics'

export type PlaceListClaim = {
  user_id: number
  pseudo: string
  bring_date: string | null
}

export type PlaceListPhoto = {
  id: number
  image_data: string
}

export type PlaceListItem = {
  id: number
  community_id: number
  kind: PlaceListKind
  title: string
  notes: string | null
  created_by: number
  /** Premier / unique engagé (compat courses). */
  claimed_by: number | null
  claimed_by_pseudo: string | null
  /** Tous les engagés (logistique multi ; courses = 0 ou 1). */
  claims: PlaceListClaim[]
  photos: PlaceListPhoto[]
  bring_date: string | null
  brought_at: string | null
  archived_at: string | null
  created_at: string | null
  status: 'open' | 'claimed' | 'brought' | 'archived'
  allows_multi_claim: boolean
}

let _ensured = false

function assertKind(kind: string): PlaceListKind {
  if (kind === 'courses' || kind === 'logistics') return kind
  throw Object.assign(new Error('kind invalide (courses|logistics)'), { status: 400 })
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toYmd(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  const s = String(value).trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return null
}

function mapItem(r: RowDataPacket, claims: PlaceListClaim[], photos: PlaceListPhoto[]): PlaceListItem {
  const kind = assertKind(String(r.kind))
  const brought = r.brought_at != null
  const archived = r.archived_at != null
  const claimed = claims.length > 0 || r.claimed_by != null
  let status: PlaceListItem['status'] = 'open'
  if (brought) status = 'brought'
  else if (archived) status = 'archived'
  else if (claimed) status = 'claimed'

  const first = claims[0]
  return {
    id: Number(r.id),
    community_id: Number(r.community_id),
    kind,
    title: String(r.title ?? ''),
    notes: r.notes != null ? String(r.notes) : null,
    created_by: Number(r.created_by),
    claimed_by: first?.user_id ?? (r.claimed_by != null ? Number(r.claimed_by) : null),
    claimed_by_pseudo: first?.pseudo ?? (r.claimed_by_pseudo != null ? String(r.claimed_by_pseudo) : null),
    claims,
    photos,
    bring_date: first?.bring_date ?? toYmd(r.bring_date),
    brought_at: r.brought_at != null ? new Date(r.brought_at).toISOString() : null,
    archived_at: r.archived_at != null ? new Date(r.archived_at).toISOString() : null,
    created_at: r.created_at != null ? new Date(r.created_at).toISOString() : null,
    status,
    allows_multi_claim: kind === 'logistics',
  }
}

export async function ensurePlaceListTables(): Promise<void> {
  if (_ensured || !isDbConfigured()) return
  const pool = getPool()
  const t = table('place_list_items')
  const tC = table('place_list_claims')
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${t} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      community_id INT NOT NULL,
      kind VARCHAR(20) NOT NULL,
      title VARCHAR(255) NOT NULL,
      notes TEXT DEFAULT NULL,
      created_by INT NOT NULL,
      claimed_by INT DEFAULT NULL,
      bring_date DATE DEFAULT NULL,
      brought_at DATETIME DEFAULT NULL,
      archived_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_comm_kind_active (community_id, kind, archived_at, brought_at),
      KEY idx_bring_date (bring_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tC} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_id INT NOT NULL,
      user_id INT NOT NULL,
      bring_date DATE DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_item_user (item_id, user_id),
      KEY idx_item (item_id),
      KEY idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  const tM = table('place_list_media')
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tM} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_id INT NOT NULL,
      image_data MEDIUMTEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_item_sort (item_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // Migrer d'anciens claimed_by uniques vers la table claims
  try {
    await pool.execute(
      `INSERT IGNORE INTO ${tC} (item_id, user_id, bring_date)
       SELECT id, claimed_by, bring_date FROM ${t}
       WHERE claimed_by IS NOT NULL`
    )
  } catch {
    /* ignore */
  }

  _ensured = true
}

async function loadPhotosForItems(itemIds: number[]): Promise<Map<number, PlaceListPhoto[]>> {
  const map = new Map<number, PlaceListPhoto[]>()
  if (!itemIds.length) return map
  const pool = getPool()
  const tM = table('place_list_media')
  const placeholders = itemIds.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, item_id, image_data FROM ${tM}
     WHERE item_id IN (${placeholders})
     ORDER BY sort_order ASC, id ASC`,
    itemIds
  )
  for (const r of rows ?? []) {
    const itemId = Number(r.item_id)
    const list = map.get(itemId) ?? []
    if (list.length >= 6) continue
    list.push({ id: Number(r.id), image_data: String(r.image_data) })
    map.set(itemId, list)
  }
  return map
}

function assertImageData(raw: string): string {
  const imageData = String(raw ?? '')
  if (!imageData.startsWith('data:image/')) {
    throw Object.assign(new Error('image_data doit être une data URL image'), { status: 400 })
  }
  if (imageData.length > 280_000) {
    throw Object.assign(new Error('Image trop lourde (max ~200 Ko)'), { status: 400 })
  }
  return imageData
}

export async function addPlaceListPhotos(params: {
  communityId: number
  itemId: number
  images: string[]
  userId: number
  canManage?: boolean
}): Promise<PlaceListPhoto[]> {
  await ensurePlaceListTables()
  await assertPlaceListActor({
    communityId: params.communityId,
    itemId: params.itemId,
    userId: params.userId,
    canManage: !!params.canManage,
    mode: 'editor',
  })
  const pool = getPool()
  const tM = table('place_list_media')
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM ${tM} WHERE item_id = ?`,
    [params.itemId]
  )
  let count = Number(countRows[0]?.c ?? 0)
  const added: PlaceListPhoto[] = []
  for (const raw of params.images.slice(0, 6)) {
    if (count >= 6) break
    const imageData = assertImageData(raw)
    const [res] = await pool.execute(
      `INSERT INTO ${tM} (item_id, image_data, sort_order, created_by) VALUES (?, ?, ?, ?)`,
      [params.itemId, imageData, count, params.userId]
    )
    const id = Number((res as ResultSetHeader).insertId)
    added.push({ id, image_data: imageData })
    count += 1
  }
  return added
}

export async function removePlaceListPhoto(params: {
  communityId: number
  itemId: number
  photoId: number
  userId: number
  canManage?: boolean
}): Promise<void> {
  await ensurePlaceListTables()
  await assertPlaceListActor({
    communityId: params.communityId,
    itemId: params.itemId,
    userId: params.userId,
    canManage: !!params.canManage,
    mode: 'editor',
  })
  const pool = getPool()
  const tM = table('place_list_media')
  const [res] = await pool.execute(`DELETE FROM ${tM} WHERE id = ? AND item_id = ?`, [
    params.photoId,
    params.itemId,
  ])
  if (!Number((res as ResultSetHeader).affectedRows ?? 0)) {
    throw Object.assign(new Error('Photo introuvable'), { status: 404 })
  }
}

export async function updatePlaceListItemDetails(params: {
  communityId: number
  itemId: number
  userId: number
  canManage?: boolean
  title?: string
  notes?: string | null
}): Promise<PlaceListItem> {
  await ensurePlaceListTables()
  await assertPlaceListActor({
    communityId: params.communityId,
    itemId: params.itemId,
    userId: params.userId,
    canManage: !!params.canManage,
    mode: 'editor',
  })
  const row = await getItemOrThrow(params.communityId, params.itemId)
  const pool = getPool()
  const t = table('place_list_items')
  const title =
    params.title != null ? String(params.title).trim().slice(0, 255) : String(row.title)
  if (!title) throw Object.assign(new Error('Titre requis'), { status: 400 })
  const notes =
    params.notes !== undefined
      ? params.notes != null
        ? String(params.notes).trim().slice(0, 4000) || null
        : null
      : row.notes != null
        ? String(row.notes)
        : null
  await pool.execute(`UPDATE ${t} SET title = ?, notes = ? WHERE id = ? AND community_id = ?`, [
    title,
    notes,
    params.itemId,
    params.communityId,
  ])
  const list = await listPlaceListItems({
    communityId: params.communityId,
    kind: assertKind(String(row.kind)),
    view: 'active',
  })
  const updated = list.find((x) => x.id === params.itemId)
  if (updated) return updated
  const hist = await listPlaceListItems({
    communityId: params.communityId,
    kind: assertKind(String(row.kind)),
    view: 'history',
  })
  const fromHist = hist.find((x) => x.id === params.itemId)
  if (!fromHist) throw Object.assign(new Error('Élément introuvable'), { status: 404 })
  return fromHist
}

async function loadClaimsForItems(itemIds: number[]): Promise<Map<number, PlaceListClaim[]>> {
  const map = new Map<number, PlaceListClaim[]>()
  if (!itemIds.length) return map
  const pool = getPool()
  const tC = table('place_list_claims')
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const placeholders = itemIds.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.item_id, c.user_id, c.bring_date,
            COALESCE(pm.meta_value, u.display_name, CONCAT('user_', c.user_id)) AS pseudo
     FROM ${tC} c
     LEFT JOIN ${tUsers} u ON u.ID = c.user_id
     LEFT JOIN ${tMeta} pm ON pm.user_id = c.user_id AND pm.meta_key = 'mdl_pseudo'
     WHERE c.item_id IN (${placeholders})
     ORDER BY c.created_at ASC`,
    itemIds
  )
  for (const r of rows ?? []) {
    const id = Number(r.item_id)
    const list = map.get(id) ?? []
    list.push({
      user_id: Number(r.user_id),
      pseudo: String(r.pseudo || `user_${r.user_id}`),
      bring_date: toYmd(r.bring_date),
    })
    map.set(id, list)
  }
  return map
}

async function syncItemClaimSummary(itemId: number): Promise<void> {
  const pool = getPool()
  const t = table('place_list_items')
  const tC = table('place_list_claims')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id, bring_date FROM ${tC} WHERE item_id = ? ORDER BY created_at ASC`,
    [itemId]
  )
  if (!rows?.length) {
    await pool.execute(`UPDATE ${t} SET claimed_by = NULL, bring_date = NULL WHERE id = ?`, [itemId])
    return
  }
  const first = rows[0]
  const dates = rows.map((r) => toYmd(r.bring_date)).filter(Boolean) as string[]
  dates.sort()
  const minDate = dates[0] ?? toYmd(first.bring_date)
  await pool.execute(`UPDATE ${t} SET claimed_by = ?, bring_date = ? WHERE id = ?`, [
    Number(first.user_id),
    minDate,
    itemId,
  ])
}

async function getItemOrThrow(communityId: number, itemId: number): Promise<RowDataPacket> {
  const pool = getPool()
  const t = table('place_list_items')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${t} WHERE id = ? AND community_id = ? LIMIT 1`,
    [itemId, communityId]
  )
  if (!rows[0]) throw Object.assign(new Error('Élément introuvable'), { status: 404 })
  return rows[0]
}

/** Archive les items dont la date d'apport est dépassée et non apportés. */
export async function archiveOverduePlaceListItems(communityId: number, kind: PlaceListKind): Promise<number> {
  await ensurePlaceListTables()
  const pool = getPool()
  const t = table('place_list_items')
  const [res] = await pool.execute(
    `UPDATE ${t}
     SET archived_at = COALESCE(archived_at, NOW())
     WHERE community_id = ? AND kind = ?
       AND brought_at IS NULL
       AND archived_at IS NULL
       AND bring_date IS NOT NULL
       AND bring_date < CURDATE()`,
    [communityId, kind]
  )
  return Number((res as ResultSetHeader).affectedRows ?? 0)
}

export async function listPlaceListItems(params: {
  communityId: number
  kind: PlaceListKind
  view?: 'active' | 'history'
}): Promise<PlaceListItem[]> {
  await ensurePlaceListTables()
  const kind = assertKind(params.kind)
  await archiveOverduePlaceListItems(params.communityId, kind)

  const pool = getPool()
  const t = table('place_list_items')
  const view = params.view === 'history' ? 'history' : 'active'

  const whereActive = `i.brought_at IS NULL AND i.archived_at IS NULL
    AND (i.bring_date IS NULL OR i.bring_date >= CURDATE())`
  const whereHistory = `(i.brought_at IS NOT NULL OR i.archived_at IS NOT NULL)
    AND COALESCE(i.brought_at, i.archived_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)`

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT i.*
     FROM ${t} i
     WHERE i.community_id = ? AND i.kind = ?
       AND (${view === 'active' ? whereActive : whereHistory})
     ORDER BY
       ${view === 'active' ? 'i.bring_date IS NULL, i.bring_date ASC, i.created_at ASC' : 'COALESCE(i.brought_at, i.archived_at) DESC'}
     LIMIT 200`,
    [params.communityId, kind]
  )
  const ids = (rows ?? []).map((r) => Number(r.id))
  const [claimsMap, photosMap] = await Promise.all([
    loadClaimsForItems(ids),
    loadPhotosForItems(ids),
  ])
  return (rows ?? []).map((r) =>
    mapItem(r, claimsMap.get(Number(r.id)) ?? [], photosMap.get(Number(r.id)) ?? [])
  )
}

export async function createPlaceListItem(params: {
  communityId: number
  kind: PlaceListKind
  title: string
  notes?: string | null
  images?: string[]
  createdBy: number
}): Promise<PlaceListItem> {
  await ensurePlaceListTables()
  const kind = assertKind(params.kind)
  const title = String(params.title ?? '').trim().slice(0, 255)
  if (!title) throw Object.assign(new Error('Titre requis'), { status: 400 })
  const notes = params.notes != null ? String(params.notes).trim().slice(0, 4000) || null : null
  const pool = getPool()
  const t = table('place_list_items')
  const [res] = await pool.execute(
    `INSERT INTO ${t} (community_id, kind, title, notes, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [params.communityId, kind, title, notes, params.createdBy]
  )
  const id = Number((res as ResultSetHeader).insertId)
  if (params.images?.length) {
    await addPlaceListPhotos({
      communityId: params.communityId,
      itemId: id,
      images: params.images,
      userId: params.createdBy,
    })
  }
  const items = await listPlaceListItems({ communityId: params.communityId, kind, view: 'active' })
  const created = items.find((x) => x.id === id)
  if (created) return created
  return {
    id,
    community_id: params.communityId,
    kind,
    title,
    notes,
    created_by: params.createdBy,
    claimed_by: null,
    claimed_by_pseudo: null,
    claims: [],
    photos: [],
    bring_date: null,
    brought_at: null,
    archived_at: null,
    created_at: new Date().toISOString(),
    status: 'open',
    allows_multi_claim: kind === 'logistics',
  }
}

export async function claimPlaceListItem(params: {
  communityId: number
  itemId: number
  userId: number
  bringDate?: string | null
  claim: boolean
}): Promise<PlaceListItem> {
  await ensurePlaceListTables()
  const pool = getPool()
  const conn = await pool.getConnection()
  const t = table('place_list_items')
  const tC = table('place_list_claims')
  try {
    await conn.beginTransaction()
    const [locked] = await conn.execute<RowDataPacket[]>(
      `SELECT * FROM ${t} WHERE id = ? AND community_id = ? FOR UPDATE`,
      [params.itemId, params.communityId]
    )
    const row = locked[0]
    if (!row) {
      throw Object.assign(new Error('Élément introuvable'), { status: 404 })
    }
    if (row.brought_at || row.archived_at) {
      throw Object.assign(new Error('Élément déjà clôturé'), { status: 400 })
    }
    const kind = assertKind(String(row.kind))

    if (!params.claim) {
      const [mine] = await conn.execute<RowDataPacket[]>(
        `SELECT id FROM ${tC} WHERE item_id = ? AND user_id = ? LIMIT 1`,
        [params.itemId, params.userId]
      )
      if (!mine[0]) {
        throw Object.assign(new Error("Vous n'êtes pas engagé sur cet élément"), { status: 403 })
      }
      await conn.execute(`DELETE FROM ${tC} WHERE item_id = ? AND user_id = ?`, [
        params.itemId,
        params.userId,
      ])
    } else {
      if (kind === 'courses') {
        const [others] = await conn.execute<RowDataPacket[]>(
          `SELECT user_id FROM ${tC} WHERE item_id = ? AND user_id <> ? LIMIT 1`,
          [params.itemId, params.userId]
        )
        if (others[0]) {
          throw Object.assign(new Error("Déjà pris par quelqu'un d'autre"), { status: 409 })
        }
      }
      let bringDate =
        params.bringDate != null ? String(params.bringDate).slice(0, 10) : null
      if (bringDate && !/^\d{4}-\d{2}-\d{2}$/.test(bringDate)) {
        throw Object.assign(new Error('Date invalide (YYYY-MM-DD)'), { status: 400 })
      }
      if (!bringDate) bringDate = todayYmd()
      await conn.execute(
        `INSERT INTO ${tC} (item_id, user_id, bring_date) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE bring_date = VALUES(bring_date), updated_at = CURRENT_TIMESTAMP`,
        [params.itemId, params.userId, bringDate]
      )
    }

    // sync claim summary in same transaction
    const [claimRows] = await conn.execute<RowDataPacket[]>(
      `SELECT user_id, bring_date FROM ${tC} WHERE item_id = ? ORDER BY created_at ASC`,
      [params.itemId]
    )
    if (!claimRows?.length) {
      await conn.execute(`UPDATE ${t} SET claimed_by = NULL, bring_date = NULL WHERE id = ?`, [
        params.itemId,
      ])
    } else {
      const first = claimRows[0]
      const dates = claimRows.map((r) => toYmd(r.bring_date)).filter(Boolean) as string[]
      dates.sort()
      await conn.execute(`UPDATE ${t} SET claimed_by = ?, bring_date = ? WHERE id = ?`, [
        Number(first.user_id),
        dates[0] ?? toYmd(first.bring_date),
        params.itemId,
      ])
    }

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  const kindRow = await getItemOrThrow(params.communityId, params.itemId)
  const kind = assertKind(String(kindRow.kind))
  const list = await listPlaceListItems({
    communityId: params.communityId,
    kind,
    view: 'active',
  })
  const updated = list.find((x) => x.id === params.itemId)
  if (updated) return updated
  const [claims, photos] = await Promise.all([
    loadClaimsForItems([params.itemId]),
    loadPhotosForItems([params.itemId]),
  ])
  return mapItem(kindRow, claims.get(params.itemId) ?? [], photos.get(params.itemId) ?? [])
}

export async function setPlaceListBringDate(params: {
  communityId: number
  itemId: number
  userId: number
  bringDate: string
  canManage?: boolean
}): Promise<PlaceListItem> {
  await assertPlaceListActor({
    communityId: params.communityId,
    itemId: params.itemId,
    userId: params.userId,
    canManage: !!params.canManage,
    mode: 'claimer_or_manager',
  })
  return claimPlaceListItem({
    communityId: params.communityId,
    itemId: params.itemId,
    userId: params.userId,
    bringDate: params.bringDate,
    claim: true,
  })
}

export async function markPlaceListBrought(params: {
  communityId: number
  itemId: number
  userId: number
  canManage?: boolean
}): Promise<void> {
  await ensurePlaceListTables()
  await assertPlaceListActor({
    communityId: params.communityId,
    itemId: params.itemId,
    userId: params.userId,
    canManage: !!params.canManage,
    mode: 'claimer_or_manager',
  })
  const pool = getPool()
  const t = table('place_list_items')
  await pool.execute(
    `UPDATE ${t}
     SET brought_at = NOW(),
         claimed_by = COALESCE(claimed_by, ?),
         bring_date = COALESCE(bring_date, CURDATE())
     WHERE id = ? AND community_id = ?`,
    [params.userId, params.itemId, params.communityId]
  )
}

export async function deletePlaceListItem(params: {
  communityId: number
  itemId: number
}): Promise<void> {
  await ensurePlaceListTables()
  const pool = getPool()
  const t = table('place_list_items')
  const tC = table('place_list_claims')
  await pool.execute(`DELETE FROM ${tC} WHERE item_id = ?`, [params.itemId])
  await pool.execute(`DELETE FROM ${table('place_list_media')} WHERE item_id = ?`, [params.itemId])
  const [res] = await pool.execute(`DELETE FROM ${t} WHERE id = ? AND community_id = ?`, [
    params.itemId,
    params.communityId,
  ])
  if (!Number((res as ResultSetHeader).affectedRows ?? 0)) {
    throw Object.assign(new Error('Élément introuvable'), { status: 404 })
  }
}

export async function deferPlaceListItem(params: {
  communityId: number
  itemId: number
  userId: number
  canManage?: boolean
}): Promise<PlaceListItem> {
  await ensurePlaceListTables()
  await assertPlaceListActor({
    communityId: params.communityId,
    itemId: params.itemId,
    userId: params.userId,
    canManage: !!params.canManage,
    mode: 'claimer_or_manager',
  })
  const row = await getItemOrThrow(params.communityId, params.itemId)
  const pool = getPool()
  const t = table('place_list_items')
  const tC = table('place_list_claims')
  await pool.execute(
    `INSERT INTO ${tC} (item_id, user_id, bring_date) VALUES (?, ?, DATE_ADD(CURDATE(), INTERVAL 1 DAY))
     ON DUPLICATE KEY UPDATE bring_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY), updated_at = CURRENT_TIMESTAMP`,
    [params.itemId, params.userId]
  )
  await pool.execute(
    `UPDATE ${t}
     SET archived_at = NULL, brought_at = NULL
     WHERE id = ? AND community_id = ?`,
    [params.itemId, params.communityId]
  )
  await syncItemClaimSummary(params.itemId)
  const list = await listPlaceListItems({
    communityId: params.communityId,
    kind: assertKind(String(row.kind)),
    view: 'active',
  })
  const updated = list.find((x) => x.id === params.itemId)
  if (!updated) throw Object.assign(new Error('Élément introuvable après report'), { status: 500 })
  return updated
}

async function assertPlaceListActor(params: {
  communityId: number
  itemId: number
  userId: number
  canManage: boolean
  mode: 'editor' | 'claimer_or_manager'
}): Promise<void> {
  if (params.canManage) return
  const row = await getItemOrThrow(params.communityId, params.itemId)
  const claims = await loadClaimsForItems([params.itemId])
  const claimList = claims.get(params.itemId) ?? []
  const isCreator = Number(row.created_by) === params.userId
  const isClaimer =
    claimList.some((c) => c.user_id === params.userId) ||
    (row.claimed_by != null && Number(row.claimed_by) === params.userId)
  if (params.mode === 'editor' && (isCreator || isClaimer)) return
  if (params.mode === 'claimer_or_manager' && isClaimer) return
  throw Object.assign(new Error('Droits insuffisants sur cet élément'), { status: 403 })
}
