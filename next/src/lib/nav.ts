import type { MandalaPage } from '@/components/MandalaApp'

export { ORGANISATION_PLACE_PAGES } from '@/lib/place-manage'

export type AdminTabId = 'people' | 'communications' | 'telemetry' | 'places'

export type MainNavItem = {
  id: MandalaPage
  label: string
  icon: string
  shortLabel: string
}

export type SecondaryNavItem = {
  id: MandalaPage
  label: string
  icon: string
}

export type AdminNavItem = {
  id: string
  label: string
  icon: string
  adminTab: AdminTabId
  description?: string
}

export type SiteManagerNavItem = {
  id: MandalaPage
  label: string
  icon: string
  description?: string
  /** Lieux gérés (hors communauté active) vs outils sur le lieu actif */
  scope: 'any' | 'active'
}

export const MAIN_NAV: MainNavItem[] = [
  { id: 'home', label: 'Accueil', shortLabel: 'Accueil', icon: '🏠' },
  { id: 'calendar', label: 'Calendrier', shortLabel: 'Agenda', icon: '🗓️' },
  { id: 'events', label: 'Événements', shortLabel: 'Événements', icon: '📅' },
  { id: 'members', label: 'Membres', shortLabel: 'Membres', icon: '👥' },
  { id: 'messages', label: 'Messages', shortLabel: 'Messages', icon: '💬' },
]

export const SECONDARY_NAV: SecondaryNavItem[] = [
  { id: 'charter', label: 'Charte du lieu', icon: '📜' },
  { id: 'notifications', label: 'Alertes', icon: '🔔' },
  { id: 'account', label: 'Mon compte', icon: '👤' },
]

/** Section Organisation — entrée unique ; le détail d’un lieu s’ouvre depuis « Mes lieux ». */
export const ORGANISATION_NAV: SiteManagerNavItem[] = [
  {
    id: 'managed-places',
    label: 'Mes lieux',
    icon: '🏛️',
    description: 'Lieux dont vous êtes gestionnaire',
    scope: 'any',
  },
  {
    id: 'place-announcements',
    label: 'Annonces du lieu',
    icon: '📢',
    description: 'Messages importants sur l\'accueil',
    scope: 'active',
  },
]

/** @deprecated Utiliser ORGANISATION_NAV */
export const SITE_MANAGER_NAV = ORGANISATION_NAV

/** Raccourcis admin application (accès tous les lieux). */
export const ADMIN_NAV: AdminNavItem[] = [
  {
    id: 'admin-people',
    label: 'Personnes & rôles',
    icon: '👥',
    adminTab: 'people',
    description: 'Utilisateurs, gestionnaires, administrateurs',
  },
  {
    id: 'admin-comms',
    label: 'Annonces & campagnes',
    icon: '📣',
    adminTab: 'communications',
    description: 'Notifications et diffusions',
  },
  {
    id: 'admin-telemetry',
    label: 'Télémétrie & usage',
    icon: '📊',
    adminTab: 'telemetry',
    description: 'Suivi des fonctionnalités utilisées',
  },
  {
    id: 'admin-places',
    label: 'Lieux & communautés',
    icon: '🏛️',
    adminTab: 'places',
    description: 'Tous les sites enregistrés',
  },
]

export const PAGE_LABELS: Record<MandalaPage, string> = {
  home: 'Accueil',
  calendar: 'Calendrier',
  events: 'Événements',
  members: 'Membres',
  messages: 'Messages',
  notifications: 'Alertes',
  account: 'Mon compte',
  charter: 'Charte du lieu',
  'place-settings': 'Paramètres du lieu',
  'place-profile': 'Profil du lieu',
  'place-charter': 'Charte du lieu',
  'place-members': 'Membres du lieu',
  'place-announcements': 'Annonces du lieu',
  'managed-places': 'Mes lieux',
  admin: 'Administration',
}
