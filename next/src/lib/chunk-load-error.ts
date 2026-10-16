const STORAGE_KEY = 'mdl_chunk_reload_sig'

/** Échec de téléchargement d'un chunk Next/webpack (déploiement ou réseau). */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || (typeof error !== 'object' && typeof error !== 'string')) return false
  const name = typeof error === 'object' && 'name' in error ? String(error.name) : ''
  const message =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && 'message' in error
        ? String(error.message)
        : ''
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk \S+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  )
}

/** Même signature pour l'URL du script et le message webpack, afin de ne recharger qu'une fois. */
export function chunkErrorSignature(error: unknown): string {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Event && error.target instanceof HTMLScriptElement
        ? error.target.src
        : typeof error === 'object' && error && 'message' in error
          ? String(error.message)
          : String(error ?? '')
  return normalizeChunkSignature(message)
}

export function normalizeChunkSignature(value: string): string {
  const idx = value.indexOf('/_next/static/chunks/')
  if (idx >= 0) {
    const rest = value.slice(idx)
    const end = rest.search(/[\s)"']/)
    return end === -1 ? rest : rest.slice(0, end)
  }
  const id = value.match(/Loading chunk (\S+) failed/i)?.[1]
  if (id) return `chunk:${id}`
  return value.slice(0, 200)
}

/**
 * Recharge la page une fois pour cette signature.
 * Un second échec identique (fichier toujours absent) ne boucle pas.
 */
export function reloadOnceForStaleChunk(signature: string): boolean {
  if (typeof window === 'undefined') return false
  const sig = normalizeChunkSignature(signature) || 'chunk'
  try {
    if (sessionStorage.getItem(STORAGE_KEY) === sig) return false
    sessionStorage.setItem(STORAGE_KEY, sig)
  } catch {
    return false
  }
  window.location.reload()
  return true
}
