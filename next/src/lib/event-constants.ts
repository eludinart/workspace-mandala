export type EventPhase = 'preparation' | 'day' | 'after' | 'closed'

export const EVENT_PHASES: { id: EventPhase; label: string }[] = [
  { id: 'preparation', label: 'Préparation' },
  { id: 'day', label: 'Jour J' },
  { id: 'after', label: 'Après' },
  { id: 'closed', label: 'Clôturé' },
]

export const STAFF_ROLES: { id: string; label: string }[] = [
  { id: 'lead', label: 'Responsable' },
  { id: 'welcome', label: 'Accueil' },
  { id: 'logistics', label: 'Logistique' },
  { id: 'communication', label: 'Communication' },
  { id: 'volunteer', label: 'Volontaire' },
]
