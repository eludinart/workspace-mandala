/**
 * Parsing / fusion des meta `mdl_explain_dismissed_json`.
 * Sans UNIQUE (user_id, meta_key), plusieurs lignes peuvent coexister —
 * il faut fusionner, pas lire LIMIT 1 au hasard.
 */

export function mergeDismissedMetaValues(rawValues: string[]): string[] {
  const set = new Set<string>()
  for (const raw of rawValues) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) continue
      for (const x of parsed) set.add(String(x))
    } catch {
      // ignore invalid JSON rows
    }
  }
  return [...set]
}

export function serializeDismissedScreens(keys: Iterable<string>): string {
  return JSON.stringify([...new Set([...keys].map(String))])
}
