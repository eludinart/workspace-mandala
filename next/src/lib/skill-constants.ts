export const SKILL_SCOPES = ['hidden', 'places', 'mandala'] as const
export type SkillScope = (typeof SKILL_SCOPES)[number]

export const SKILL_REGISTERS = ['share', 'practice', 'profession'] as const
export type SkillRegister = (typeof SKILL_REGISTERS)[number]

export const SKILL_REGISTER_LABELS: Record<SkillRegister, string> = {
  share: 'J’aime partager',
  practice: 'Je pratique régulièrement',
  profession: 'C’est mon métier',
}

export const MAX_SKILL_TAGS = 20
export const MAX_SKILL_TEXT = 2000
export const MAX_SKILL_NOTE = 500

export function isSkillScope(v: unknown): v is SkillScope {
  return v === 'hidden' || v === 'places' || v === 'mandala'
}

export function isSkillRegister(v: unknown): v is SkillRegister {
  return v === 'share' || v === 'practice' || v === 'profession'
}

/** Clé de dédoublonnage : minuscules, espaces condensés. */
export function skillLabelKey(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')
}
