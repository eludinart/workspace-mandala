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
