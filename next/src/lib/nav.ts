import type { MandalaPage } from '@/components/MandalaApp'

export const MAIN_NAV: { id: MandalaPage; label: string; icon: string; shortLabel: string }[] = [
  { id: 'home', label: 'Accueil', shortLabel: 'Accueil', icon: '🏠' },
  { id: 'events', label: 'Événements', shortLabel: 'Événements', icon: '📅' },
  { id: 'members', label: 'Membres', shortLabel: 'Membres', icon: '👥' },
  { id: 'messages', label: 'Messages', shortLabel: 'Messages', icon: '💬' },
]

export const PAGE_LABELS: Record<MandalaPage, string> = {
  home: 'Accueil',
  events: 'Événements',
  members: 'Membres',
  messages: 'Messages',
  notifications: 'Alertes',
  account: 'Mon compte',
  admin: 'Administration',
}
