/** Validation des captures jointes aux retours (?). */

export const SUPPORT_MAX_IMAGES = 3
/** Longueur max d’une data URL (≈ 300 Ko décodés). */
export const SUPPORT_MAX_IMAGE_CHARS = 420_000

export function assertSupportImageDataUrls(raw: unknown): string[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) {
    throw Object.assign(new Error('images doit être un tableau'), { status: 400 })
  }
  if (raw.length > SUPPORT_MAX_IMAGES) {
    throw Object.assign(new Error(`Maximum ${SUPPORT_MAX_IMAGES} images par retour.`), {
      status: 400,
    })
  }
  const out: string[] = []
  for (const item of raw) {
    const imageData = String(item ?? '')
    if (!imageData.startsWith('data:image/')) {
      throw Object.assign(new Error('Chaque image doit être une data URL image.'), {
        status: 400,
      })
    }
    if (imageData.length > SUPPORT_MAX_IMAGE_CHARS) {
      throw Object.assign(
        new Error('Image trop lourde — réduisez la taille des captures.'),
        { status: 400 }
      )
    }
    out.push(imageData)
  }
  return out
}
