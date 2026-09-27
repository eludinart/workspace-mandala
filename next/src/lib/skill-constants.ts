export const SKILL_SCOPES = ['hidden', 'places', 'mandala'] as const
export type SkillScope = (typeof SKILL_SCOPES)[number]

export const SKILL_REGISTERS = ['share', 'practice', 'profession'] as const
export type SkillRegister = (typeof SKILL_REGISTERS)[number]

export const SKILL_REGISTER_LABELS: Record<SkillRegister, string> = {
  share: 'J’aime partager',
  practice: 'Je pratique régulièrement',
  profession: 'C’est mon métier',
}

export const SKILL_TRAITS = [
  { code: 'ecoute', label: 'Écoute' },
  { code: 'organisation', label: 'Organisation' },
  { code: 'discretion', label: 'Discrétion' },
  { code: 'accueil', label: 'Accueil' },
  { code: 'perseverance', label: 'Persévérance' },
  { code: 'patience', label: 'Patience' },
  { code: 'fiabilite', label: 'Fiabilité' },
  { code: 'mediation', label: 'Médiation' },
] as const

export type SkillTraitCode = (typeof SKILL_TRAITS)[number]['code']

export const MAX_SKILL_TAGS = 20
export const MAX_SKILL_TRAITS = 5
export const MAX_SKILL_TEXT = 280
export const MAX_SKILL_NOTE = 500

const TRAIT_CODES = new Set<string>(SKILL_TRAITS.map((t) => t.code))

export function isSkillScope(v: unknown): v is SkillScope {
  return v === 'hidden' || v === 'places' || v === 'mandala'
}

export function isSkillRegister(v: unknown): v is SkillRegister {
  return v === 'share' || v === 'practice' || v === 'profession'
}

export function isSkillTraitCode(v: unknown): v is SkillTraitCode {
  return typeof v === 'string' && TRAIT_CODES.has(v)
}

export function skillTraitLabel(code: string): string {
  return SKILL_TRAITS.find((t) => t.code === code)?.label ?? code
}

/** Clé de dédoublonnage : minuscules, espaces condensés. */
export function skillLabelKey(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')
}
