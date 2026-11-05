/**
 * Porte `aide_contextuelle` — cartes d’explication une fois par écran.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from '@/lib/db'

const META_KEY = 'mdl_explain_dismissed_json'

export const EXPLAIN_SCREENS = [
  'home',
  'members',
  'messages',
  'calendar',
  'skills',
] as const

export type ExplainScreen = (typeof EXPLAIN_SCREENS)[number]

export const EXPLAIN_COPY: Record<ExplainScreen, { title: string; body: string }> = {
  home: {
    title: 'Accueil du lieu',
    body: 'Ici : le fil du lieu actif, les prochaines dates, et les raccourcis vers le reste de Mandala.',
  },
  members: {
    title: 'Membres',
    body: 'Les personnes de ce lieu. Vous pouvez leur écrire si vous partagez le lieu, ou via le seuil si la porte est ouverte.',
  },
  messages: {
    title: 'Messages',
    body: 'Conversations à deux ou en groupe. Les sondages et réactions aident à répondre sans tout écrire.',
  },
  calendar: {
    title: 'Calendrier',
    body: 'Les présences et événements de ce lieu. Les dates des lieux amis n’y sont pas mélangées.',
  },
  skills: {
    title: 'Annuaire',
    body: 'Savoir-faire et lieux d’exercice. Filtrez Pros / Membres, et voyez les rattachements lieux Mandala.',
  },
}

async function readDismissed(userId: number): Promise<Set<string>> {
  const pool = getPool()
  const t = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${t} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, META_KEY]
  )
  if (!rows[0]?.meta_value) return new Set()
  try {
    const parsed = JSON.parse(String(rows[0].meta_value)) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((x) => String(x)))
  } catch {
    return new Set()
  }
}

async function writeDismissed(userId: number, keys: Set<string>): Promise<void> {
  const pool = getPool()
  const t = table('usermeta')
  const json = JSON.stringify([...keys])
  await pool.execute(
    `INSERT INTO ${t} (user_id, meta_key, meta_value)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
    [userId, META_KEY, json]
  )
}

export async function listDismissedExplainScreens(userId: number): Promise<string[]> {
  if (!isDbConfigured() || userId <= 0) return []
  return [...(await readDismissed(userId))]
}

export async function dismissExplainScreen(
  userId: number,
  screen: string
): Promise<string[]> {
  if (!isDbConfigured() || userId <= 0) throw new Error('Utilisateur invalide')
  const set = await readDismissed(userId)
  set.add(screen)
  await writeDismissed(userId, set)
  return [...set]
}

export function isExplainScreen(v: string): v is ExplainScreen {
  return (EXPLAIN_SCREENS as readonly string[]).includes(v)
}
