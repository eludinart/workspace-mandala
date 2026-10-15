const NAIVE_WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
const HAS_EXPLICIT_OFFSET = /(?:[zZ]|[+-]\d{2}:?\d{2})$/

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Chiffres locaux d'un Date, sans conversion UTC. */
function formatWallClockParts(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

/**
 * Heure murale d'un événement : `2027-06-03 18:05:00` signifie 18:05,
 * quel que soit le fuseau du navigateur ou du serveur.
 * Un décalage explicite (`Z`, `+02:00`) reste honoré.
 */
export function parseWallClockDateTime(value: string | null | undefined): Date | null {
  if (value == null || value === '') return null
  const s = String(value).trim()
  if (!s || s.startsWith('0000-00-00') || s === 'Invalid Date') return null

  if (HAS_EXPLICIT_OFFSET.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const m = s.match(NAIVE_WALL_CLOCK)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0))
    return Number.isNaN(d.getTime()) ? null : d
  }

  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Conserve les chiffres d'une DATETIME d'événement.
 * mysql2 peut renvoyer un Date construit dans le fuseau du processus :
 * `toISOString()` décalerait l'heure, les composantes locales non.
 */
export function normalizeWallClockDateTime(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return formatWallClockParts(value)
  }
  const s = String(value).trim()
  if (!s || s.startsWith('0000-00-00') || s === 'Invalid Date') return null
  if (NAIVE_WALL_CLOCK.test(s) && !HAS_EXPLICIT_OFFSET.test(s)) {
    const m = s.match(NAIVE_WALL_CLOCK)
    if (!m) return null
    return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${(m[6] ?? '00').slice(0, 2)}`
  }
  const d = parseWallClockDateTime(s)
  if (!d) return null
  return formatWallClockParts(d)
}

/** Parse une date/heure stockée côté Mandala (MySQL DATETIME ou ISO, instant UTC). */
export function parseMandalaDateTime(value: string | null | undefined): Date | null {
  if (value == null || value === '') return null
  const s = String(value).trim()
  if (!s || s.startsWith('0000-00-00') || s === 'Invalid Date') return null

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    const d = new Date(s.slice(0, 19).replace(' ', 'T') + 'Z')
    return Number.isNaN(d.getTime()) ? null : d
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatMandalaDate(value: string | null | undefined): string {
  const d = parseMandalaDateTime(value)
  if (!d) return '—'
  return d.toLocaleDateString('fr-FR', { dateStyle: 'medium' })
}

export function formatMandalaDateTime(value: string | null | undefined): string {
  const d = parseWallClockDateTime(value)
  if (!d) return '—'
  return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function daysBeforeToday(d: Date): number {
  const today = startOfLocalDay(new Date()).getTime()
  const day = startOfLocalDay(d).getTime()
  return Math.round((today - day) / 86_400_000)
}

/** Heure dans une bulle de discussion (HH:mm). */
export function formatChatBubbleTime(value: string | null | undefined): string {
  const d = parseMandalaDateTime(value)
  if (!d) return ''
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Horodatage court d’une ligne de conversation. */
export function formatChatListTime(value: string | null | undefined): string {
  const d = parseMandalaDateTime(value)
  if (!d) return ''
  const diff = daysBeforeToday(d)
  if (diff <= 0) return formatChatBubbleTime(value)
  if (diff === 1) return 'Hier'
  if (diff < 7) {
    return d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace(/\.$/, '')
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

/** Séparateur de jour dans un fil de messages. */
export function formatChatDayLabel(value: string | null | undefined): string {
  const d = parseMandalaDateTime(value)
  if (!d) return ''
  const diff = daysBeforeToday(d)
  if (diff <= 0) return "Aujourd'hui"
  if (diff === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export function chatDayKey(value: string | null | undefined): string {
  const d = parseMandalaDateTime(value)
  if (!d) return ''
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** Normalise une valeur DB en `YYYY-MM-DD HH:mm:ss` (UTC). */
export function normalizeDbDateTime(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 19).replace('T', ' ')
  }
  const s = String(value).trim()
  if (!s || s.startsWith('0000-00-00') || s === 'Invalid Date') return null
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 19)
  const d = parseMandalaDateTime(s)
  if (!d) return null
  return d.toISOString().slice(0, 19).replace('T', ' ')
}
