import type { MandalaPage } from '@/components/MandalaApp'

export type PlaceManageAction = {
  id: MandalaPage
  label: string
  icon: string
  description: string
}

/** Actions disponibles depuis le détail d’un lieu (hub « Mes lieux »). */
export const PLACE_MANAGE_ACTIONS: PlaceManageAction[] = [
  {
    id: 'place-profile',
    label: 'Profil du lieu',
    icon: '📋',
    description: 'Nom, présentation, contact, visuel',
  },
  {
    id: 'place-charter',
    label: 'Charte du lieu',
    icon: '📜',
    description: 'Règles et valeurs du lieu',
  },
  {
    id: 'place-members',
    label: 'Membres du lieu',
    icon: '🤝',
    description: 'Rôles et équipe',
  },
  {
    id: 'place-announcements',
    label: 'Annonces du lieu',
    icon: '📢',
    description: 'Messages importants sur l\'accueil',
  },
  {
    id: 'calendar',
    label: 'Calendrier',
    icon: '🗓️',
    description: 'Présences et agenda',
  },
  {
    id: 'events',
    label: 'Événements',
    icon: '📅',
    description: 'Programmation du lieu',
  },
]

export const ORGANISATION_PLACE_PAGES: MandalaPage[] = [
  'place-settings',
  'place-profile',
  'place-charter',
  'place-members',
  'place-announcements',
]
