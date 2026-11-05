/** Normalisation des villes de résidence / lieux d’exercice (annuaire). */

export const MAX_PRACTICE_LOCATIONS = 8
export const MAX_CITY_LEN = 120

export function normalizeCityLabel(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_CITY_LEN)
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
