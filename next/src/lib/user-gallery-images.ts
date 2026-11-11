/** Validation des photos d'ambiance fiche membre (0–2). */

export const USER_GALLERY_MAX_IMAGES = 2
/** ~150 Ko décodés (aligné avatar communauté). */
export const USER_GALLERY_MAX_DECODED_BYTES = 150_000
export const USER_GALLERY_MAX_IMAGE_CHARS = 220_000

const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,/i

export function assertUserGalleryImageDataUrls(raw: unknown): string[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) {
    throw Object.assign(new Error('gallery_images doit être un tableau'), { status: 400 })
  }
  if (raw.length > USER_GALLERY_MAX_IMAGES) {
    throw Object.assign(new Error(`Maximum ${USER_GALLERY_MAX_IMAGES} photos d'ambiance.`), {
      status: 400,
    })
  }
  const out: string[] = []
  for (const item of raw) {
    const imageData = String(item ?? '')
    if (!DATA_URL_RE.test(imageData)) {
      throw Object.assign(
        new Error('Chaque photo doit être une image JPEG, PNG ou WebP (data URL).'),
        { status: 400 }
      )
    }
    if (imageData.length > USER_GALLERY_MAX_IMAGE_CHARS) {
      throw Object.assign(new Error('Photo trop lourde — réduisez la taille.'), { status: 400 })
    }
    const b64 = imageData.replace(/^data:image\/\w+;base64,/i, '')
    const decodedBytes = Math.ceil((b64.length * 3) / 4)
    if (decodedBytes > USER_GALLERY_MAX_DECODED_BYTES) {
      throw Object.assign(
        new Error(
          `Photo trop volumineuse (${Math.round(decodedBytes / 1024)} Ko). Maximum : ${Math.round(USER_GALLERY_MAX_DECODED_BYTES / 1024)} Ko.`
        ),
        { status: 400 }
      )
    }
    out.push(imageData)
  }
  return out
}

export function portraitRequiredMessage(): string {
  return 'Photo de profil requise pour une fiche compétences visible (Mandala ou lieux).'
}

export function skillScopeRequiresPortrait(scope: string): boolean {
  return scope === 'places' || scope === 'mandala'
}
