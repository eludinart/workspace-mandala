/** Normalisation des villes de résidence / lieux d’exercice (annuaire). */

export const MAX_PRACTICE_LOCATIONS = 8
export const MAX_CITY_LEN = 120

/** Extrait un code postal FR (5 chiffres) éventuellement collé à la ville. */
export function parseCityAndPostal(raw: unknown): {
  city: string
  postal_code: string | null
} {
  let s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!s) return { city: '', postal_code: null }

  let postal_code: string | null = null
  const leading = s.match(/^(\d{5})\s+(.+)$/)
  if (leading) {
    postal_code = leading[1]
    s = leading[2]
  } else {
    const trailing = s.match(/^(.+?)(?:\s*[,(]\s*|\s+)(\d{5})\)?\s*$/)
    if (trailing && !/^\d+$/.test(trailing[1].trim())) {
      s = trailing[1].replace(/[,(]\s*$/, '').trim()
      postal_code = trailing[2]
    }
  }

  return {
    city: s.slice(0, MAX_CITY_LEN),
    postal_code,
  }
}

/** Libellé ville sans code postal (Nominatim échoue si le CP est dans `city`). */
export function normalizeCityLabel(raw: unknown): string {
  return parseCityAndPostal(raw).city
}

/** Liste dédupliquée (insensible à la casse FR), max N. */
export function normalizePracticeLocations(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed : raw.split(/[,;\n]/)
          } catch {
            return raw.split(/[,;\n]/)
          }
        })()
      : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const label = normalizeCityLabel(item)
    if (!label) continue
    const key = label.toLocaleLowerCase('fr')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(label)
    if (out.length >= MAX_PRACTICE_LOCATIONS) break
  }
  return out
}

export function practiceLocationsToJson(list: string[]): string {
  return JSON.stringify(normalizePracticeLocations(list))
}

export function practiceLocationsFromJson(raw: unknown): string[] {
  if (raw == null || raw === '') return []
  if (Array.isArray(raw)) return normalizePracticeLocations(raw)
  return normalizePracticeLocations(String(raw))
}
