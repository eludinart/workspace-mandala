import type { RowDataPacket } from 'mysql2'
import { ensureOnce, exec, getPool, isDbConfigured, table } from './db'
import {
  assertUserGalleryImageDataUrls,
  USER_GALLERY_MAX_IMAGES,
} from './user-gallery-images'

export { skillScopeRequiresPortrait } from './user-gallery-images'

export async function ensureUserGalleryImagesTable(): Promise<void> {
  if (!isDbConfigured()) return
  await ensureOnce('user_gallery_images', async () => {
    const pool = getPool()
    await exec(
      pool,
      `CREATE TABLE IF NOT EXISTS ${table('user_gallery_images')} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        sort_order TINYINT NOT NULL DEFAULT 0,
        image_data MEDIUMTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_sort (user_id, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    )
  })
}

export async function listUserGalleryImages(userId: number): Promise<string[]> {
  if (!userId || !isDbConfigured()) return []
  await ensureUserGalleryImagesTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT image_data
     FROM ${table('user_gallery_images')}
     WHERE user_id = ?
     ORDER BY sort_order ASC, id ASC
     LIMIT ${USER_GALLERY_MAX_IMAGES}`,
    [userId]
  )
  return (rows ?? [])
    .map((r) => String(r.image_data || ''))
    .filter(Boolean)
    .slice(0, USER_GALLERY_MAX_IMAGES)
}

export async function replaceUserGalleryImages(
  userId: number,
  rawImages: unknown
): Promise<string[]> {
  if (!userId) throw Object.assign(new Error('Utilisateur invalide'), { status: 400 })
  const images = assertUserGalleryImageDataUrls(rawImages)
  await ensureUserGalleryImagesTable()
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(`DELETE FROM ${table('user_gallery_images')} WHERE user_id = ?`, [userId])
    for (let i = 0; i < images.length; i++) {
      await conn.execute(
        `INSERT INTO ${table('user_gallery_images')} (user_id, sort_order, image_data)
         VALUES (?, ?, ?)`,
        [userId, i, images[i]]
      )
    }
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
  return images
}

export async function userHasPortraitPhoto(userId: number): Promise<boolean> {
  if (!userId || !isDbConfigured()) return false
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${table('usermeta')}
     WHERE user_id = ? AND meta_key = 'mdl_avatar' LIMIT 1`,
    [userId]
  )
  const v = String(rows[0]?.meta_value ?? '').trim()
  return v.startsWith('data:image/')
}

export async function readSkillScopeRaw(userId: number): Promise<'hidden' | 'places' | 'mandala'> {
  if (!userId || !isDbConfigured()) return 'hidden'
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT scope FROM ${table('mandala_skill_profiles')} WHERE user_id = ? LIMIT 1`,
    [userId]
  )
  const scope = String(rows[0]?.scope ?? 'hidden')
  if (scope === 'places' || scope === 'mandala') return scope
  return 'hidden'
}
