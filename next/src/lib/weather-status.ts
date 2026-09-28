/** La Météo des Cœurs — statuts énergétiques par communauté. */

export const WEATHER_STATUSES = ['sunny', 'misty', 'stormy', 'calm'] as const
export type WeatherStatus = (typeof WEATHER_STATUSES)[number]

export const WEATHER_META_KEY = 'mdl_weather_by_community'

export type WeatherState = {
  status: WeatherStatus
  note: string
  updated_at: string
}

/** Jour civil de la météo : l’état du jour ne survit pas au lendemain. */
export const WEATHER_DAY_TZ = 'Europe/Paris'

export type WeatherByCommunityMap = Record<string, WeatherState>

export const WEATHER_OPTIONS: {
  id: WeatherStatus
  emoji: string
  label: string
  dotClass: string
}[] = [
  { id: 'sunny', emoji: '☀️', label: 'Rayonnant', dotClass: 'bg-amber-400' },
  { id: 'calm', emoji: '🌤️', label: 'Calme', dotClass: 'bg-sky-400' },
  { id: 'misty', emoji: '🌫️', label: 'Brumeux', dotClass: 'bg-slate-400' },
  { id: 'stormy', emoji: '⛈️', label: 'Orageux', dotClass: 'bg-indigo-400' },
]

export function isWeatherStatus(v: unknown): v is WeatherStatus {
  return typeof v === 'string' && (WEATHER_STATUSES as readonly string[]).includes(v)
}

export function weatherOption(id: WeatherStatus | string | null | undefined) {
  return WEATHER_OPTIONS.find((o) => o.id === id) ?? null
}

export function parseWeatherByCommunityJson(raw: string | null | undefined): WeatherByCommunityMap {
  if (!raw || typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return {}
    const out: WeatherByCommunityMap = {}
    for (const [key, val] of Object.entries(parsed)) {
      if (!val || typeof val !== 'object') continue
      const o = val as Record<string, unknown>
      const status = o.status
      if (!isWeatherStatus(status)) continue
      const note = String(o.note ?? '').slice(0, 100)
      const updated_at = typeof o.updated_at === 'string' ? o.updated_at : ''
      out[key] = { status, note, updated_at }
    }
    return out
  } catch {
    return {}
  }
}

/** Clé `YYYY-MM-DD` dans le fuseau de la météo. Chaîne vide si la date est illisible. */
export function weatherCalendarDay(isoOrDate: string | Date, timeZone = WEATHER_DAY_TZ): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** Vrai seulement si le choix a été fait le même jour civil que `now`. */
export function isWeatherCurrent(state: WeatherState | null | undefined, now = new Date()): boolean {
  if (!state?.updated_at) return false
  const day = weatherCalendarDay(state.updated_at)
  if (!day) return false
  return day === weatherCalendarDay(now)
}

export function pickWeatherForCommunity(
  map: WeatherByCommunityMap,
  communityId: number,
  now = new Date()
): WeatherState | null {
  const state = map[String(communityId)] ?? null
  if (!state || !isWeatherCurrent(state, now)) return null
  return state
}
