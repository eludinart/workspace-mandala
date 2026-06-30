export const META_FIRST_NAME = 'mdl_first_name'
export const META_LAST_NAME = 'mdl_last_name'
export const META_SHOW_FULL_LAST_NAME = 'mdl_show_full_last_name'

const NAME_MAX_LEN = 80

/** Valide et normalise un prénom ou nom de famille. */
export function validatePersonName(value: string, fieldLabel: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) throw new Error(`${fieldLabel} requis`)
  if (trimmed.length > NAME_MAX_LEN) {
    throw new Error(`${fieldLabel} trop long (${NAME_MAX_LEN} caractères max.)`)
  }
  if (!/^[\p{L}\p{M}' -]+$/u.test(trimmed)) {
    throw new Error(`${fieldLabel} : lettres, espaces, tirets et apostrophes uniquement`)
  }
  return trimmed
}

function capitalizeWord(word: string): string {
  if (!word) return ''
  return word.charAt(0).toLocaleUpperCase('fr-FR') + word.slice(1).toLocaleLowerCase('fr-FR')
}

/** Met en forme un prénom ou nom (ex. « jean-pierre » → « Jean-Pierre »). */
export function formatNamePart(value: string): string {
  const t = value.trim().replace(/\s+/g, ' ')
  if (!t) return ''
  return t
    .split(/(\s+|-)/)
    .map((part) => {
      if (part === '-') return '-'
      if (/^\s+$/.test(part)) return ' '
      return capitalizeWord(part)
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Trois premières lettres du nom de famille, avec majuscule initiale. */
export function lastNameShortPrefix(lastName: string, len = 3): string {
  const letters = lastName.replace(/[^\p{L}]/gu, '')
  if (!letters) return ''
  return capitalizeWord(letters.slice(0, len))
}

/**
 * Nom affiché dans les listes (calendrier, agora, membres connectés).
 * Par défaut : Prénom-XXX (3 lettres du nom). Option : Prénom Nom complet.
 */
export function formatPublicDisplayName(
  firstName: string,
  lastName: string,
  showFullLastName: boolean
): string {
  const first = formatNamePart(firstName)
  if (!first) return ''
  const last = formatNamePart(lastName)
  if (!last) return first
  if (showFullLastName) return `${first} ${last}`
  const prefix = lastNameShortPrefix(last)
  return prefix ? `${first}-${prefix}` : first
}

/** Nom complet pour la fiche profil (Prénom Nom). */
export function formatFullName(firstName: string, lastName: string): string {
  const first = formatNamePart(firstName)
  const last = formatNamePart(lastName)
  return [first, last].filter(Boolean).join(' ')
}
