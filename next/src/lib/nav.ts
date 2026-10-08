import type { MandalaPage } from '@/components/MandalaApp'

export { ORGANISATION_PLACE_PAGES } from '@/lib/place-manage'

export type AdminTabId = 'people' | 'communications' | 'telemetry' | 'places' | 'support'

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

/** Personne sans lieu : pas de mur, de calendrier, ni de liste de membres. */
export const SOLO_MAIN_NAV: MainNavItem[] = [
  { id: 'home', label: 'Accueil', shortLabel: 'Accueil', icon: '🏠' },
  { id: 'directory', label: 'Annuaire', shortLabel: 'Annuaire', icon: '👥' },
  { id: 'messages', label: 'Messages', shortLabel: 'Messages', icon: '💬' },
  { id: 'notifications', label: 'Alertes', shortLabel: 'Alertes', icon: '🔔' },
  { id: 'account', label: 'Compte', shortLabel: 'Compte', icon: '👤' },
]

export const PLACE_BOUND_PAGES: MandalaPage[] = [
  'calendar',
  'events',
  'members',
  'resources',
  'charter',
  'place-settings',
  'place-profile',
  'place-charter',
  'place-members',
  'place-invites',
  'place-announcements',
  'managed-places',
  'courses',
  'logistics',
  'circles',
]

export const SECONDARY_NAV: SecondaryNavItem[] = [
  { id: 'directory', label: 'Annuaire', icon: '👥' },
  { id: 'skills', label: 'Compétences', icon: '✨' },
  { id: 'resources', label: 'Ressources', icon: '📚' },
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

/**
 * Vie du lieu — Courses / Logistique / Cercles (tous les membres du lieu).
 */
export const PLACE_LIFE_NAV: SiteManagerNavItem[] = [
  {
    id: 'skills',
    label: 'Annuaire du lieu',
    icon: '✨',
    description: 'Compétences visibles dans ce lieu',
    scope: 'active',
  },
  {
    id: 'resources',
    label: 'Ressources du lieu',
    icon: '📚',
    description: 'Textes, recettes, vidéos et documents',
    scope: 'active',
  },
  {
    id: 'courses',
    label: 'Courses',
    icon: '🛒',
    description: 'Liste partagée d’apports',
    scope: 'active',
  },
  {
    id: 'logistics',
    label: 'Logistique',
    icon: '🧰',
    description: 'Besoins matériel du lieu',
    scope: 'active',
  },
  {
    id: 'circles',
    label: 'Cercles',
    icon: '🔄',
    description: 'Journal matin / soir + photo tableau',
    scope: 'active',
  },
]

/** @deprecated utiliser PLACE_LIFE_NAV */
export const PREVIEW_OPS_NAV = PLACE_LIFE_NAV

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
    label: 'Infos & campagnes',
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
  {
    id: 'admin-support',
    label: 'Retours',
    icon: '🛟',
    adminTab: 'support',
    description: 'Questions et bugs signalés',
  },
]

export const PAGE_LABELS: Record<MandalaPage, string> = {
  home: 'Accueil',
  directory: 'Annuaire',
  calendar: 'Calendrier',
  events: 'Événements',
  members: 'Membres',
  messages: 'Messages',
  skills: 'Compétences',
  resources: 'Ressources',
  notifications: 'Alertes',
  account: 'Mon compte',
  charter: 'Charte du lieu',
  'places-map': 'Découvrir',
  'place-settings': 'Paramètres du lieu',
  'place-profile': 'Profil du lieu',
  'place-charter': 'Charte du lieu',
  'place-members': 'Membres du lieu',
  'place-invites': 'Invitations',
  'place-announcements': 'Annonces du lieu',
  'managed-places': 'Mes lieux',
  courses: 'Courses',
  logistics: 'Logistique',
  circles: 'Cercles',
  admin: 'Administration',
}
