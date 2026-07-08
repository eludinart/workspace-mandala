/** Colonne partagée : visible sur le mur public (landing). */

export const WALL_PUBLIC_COLUMN = 'wall_public'

export function parseWallPublic(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true
  return false
}

export function wallPublicFromRow(row: Record<string, unknown>): boolean {
  return parseWallPublic(row[WALL_PUBLIC_COLUMN])
}

export async function ensureWallPublicColumn(
  pool: { execute: (sql: string, args?: unknown[]) => Promise<unknown> },
  tableName: string
): Promise<void> {
  try {
    await pool.execute(
      `ALTER TABLE ${tableName} ADD COLUMN ${WALL_PUBLIC_COLUMN} TINYINT(1) NOT NULL DEFAULT 0`
    )
  } catch {
    /* exists */
  }
}
