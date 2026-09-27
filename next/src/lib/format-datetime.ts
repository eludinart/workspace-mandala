/** Parse une date/heure stockée côté Mandala (MySQL DATETIME ou ISO). */
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
  const d = parseMandalaDateTime(value)
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
