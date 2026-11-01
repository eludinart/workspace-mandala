/** Colonne : événement ouvert aux lieux amis (Ailleurs). */

import type { Pool } from 'mysql2/promise'

export const OPEN_TO_FRIEND_PLACES_COLUMN = 'open_to_friend_places'

export function parseOpenToFriendPlaces(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true
  return false
}

export function openToFriendPlacesFromRow(row: Record<string, unknown>): boolean {
  return parseOpenToFriendPlaces(row[OPEN_TO_FRIEND_PLACES_COLUMN])
}

export async function ensureOpenToFriendPlacesColumn(
  pool: Pool,
  tableName: string
): Promise<void> {
  try {
    await pool.execute(
      `ALTER TABLE ${tableName} ADD COLUMN ${OPEN_TO_FRIEND_PLACES_COLUMN} TINYINT(1) NOT NULL DEFAULT 0`
    )
  } catch {
    /* exists */
  }
}
