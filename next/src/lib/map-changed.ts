/** Événement navigateur : cartes membres / annuaire doivent recharger leurs pins. */
export const MANDALA_MAP_CHANGED_EVENT = 'mandala-member-city-changed'

export function emitMandalaMapChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(MANDALA_MAP_CHANGED_EVENT))
}

export function onMandalaMapChanged(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = () => handler()
  window.addEventListener(MANDALA_MAP_CHANGED_EVENT, listener)
  return () => window.removeEventListener(MANDALA_MAP_CHANGED_EVENT, listener)
}
