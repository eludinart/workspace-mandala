/** URL d’image de profil utilisable (base64 ou http(s)). */
export function isAvatarImageUrl(value: string | null | undefined): boolean {
  const v = String(value ?? '').trim()
  if (!v) return false
  return /^data:image\/(jpeg|png|webp|gif);base64,/i.test(v) || /^https?:\/\//i.test(v)
}

export const DEFAULT_AVATAR_EMOJI = '🌸'
