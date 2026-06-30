/** La Météo des Cœurs — statuts énergétiques par communauté. */

export const WEATHER_STATUSES = ['sunny', 'misty', 'stormy', 'calm'] as const
export type WeatherStatus = (typeof WEATHER_STATUSES)[number]

export const WEATHER_META_KEY = 'mdl_weather_by_community'

export type WeatherState = {
  status: WeatherStatus
  note: string
  updated_at: string
}

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
      const updated_at =
        typeof o.updated_at === 'string' && o.updated_at ? o.updated_at : new Date().toISOString()
      out[key] = { status, note, updated_at }
    }
    return out
  } catch {
    return {}
  }
}

export function pickWeatherForCommunity(
  map: WeatherByCommunityMap,
  communityId: number
): WeatherState | null {
  return map[String(communityId)] ?? null
}
