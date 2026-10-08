import type { MandalaPage } from '@/components/MandalaApp'
import { PAGE_LABELS } from '@/lib/nav'

const TIPS: Partial<Record<MandalaPage, string[]>> = {
  home: [
    'L’accueil montre le fil et les annonces du lieu actif.',
    'Le lieu en cours se change dans la barre en haut.',
  ],
  calendar: [
    'Le calendrier affiche les événements du lieu sur le mois, la semaine ou le jour.',
    'Ouvrez une date pour voir le détail de la journée.',
  ],
  events: [
    'Liste des événements du lieu. Ouvrez une carte pour le programme.',
    'Les gestionnaires peuvent créer et modifier un événement.',
  ],
  members: [
    'Annuaire des personnes du lieu actif.',
    'Ouvrez une fiche pour envoyer un message.',
  ],
  messages: [
    'Conversations du lieu actif. Le badge compte les messages non lus de ce lieu.',
    'Le bouton en haut à droite sert à écrire à un membre.',
    '« Mandala » en haut à gauche ramène à la page précédente.',
  ],
  skills: [
    'Les savoir-faire servent à vous retrouver. Le texte décrit des rôles, pas une liste de qualités.',
    'L’annuaire montre les fiches que les membres ont choisi de rendre visibles.',
  ],
  resources: [
    'Textes, recettes, vidéos et documents partagés dans le lieu.',
    'Publiez depuis « Mes ressources ». Un brouillon non publié est perdu si vous quittez la page.',
  ],
  notifications: [
    'Alertes reçues. Ouvrez-en une pour aller à la page concernée.',
  ],
  account: [
    'Photo, nom, mot de passe et notifications sur cet appareil.',
  ],
  charter: [
    'Texte du lieu à lire et à accepter pour participer.',
  ],
  'places-map': [
    'Lieux publics que vous pouvez découvrir et rejoindre.',
  ],
  'place-settings': [
    'Nom, description et image du lieu. Réservé aux gestionnaires.',
  ],
  'place-profile': [
    'Nom, description et image du lieu. Réservé aux gestionnaires.',
  ],
  'place-charter': [
    'Texte de la charte que les membres acceptent en arrivant.',
  ],
  'place-members': [
    'Membres du lieu : rôles et retraits, pour les gestionnaires.',
  ],
  'place-invites': [
    'Créez un lien ou un code pour inviter quelqu’un dans le lieu.',
  ],
  'place-announcements': [
    'Message important affiché sur l’accueil du lieu.',
  ],
  'managed-places': [
    'Lieux dont vous êtes gestionnaire. Ouvrez-en un pour ses réglages.',
  ],
  courses: [
    'Liste partagée de ce qu’il faut apporter au lieu.',
  ],
  logistics: [
    'Besoins en matériel du lieu.',
  ],
  circles: [
    'Journal du matin et du soir, et photo du tableau.',
  ],
  admin: [
    'Outils réservés aux administrateurs : personnes, infos, usage et retours.',
    'Les questions et bugs envoyés par le bouton ? arrivent dans l’onglet Retours.',
  ],
}

export function helpForPage(page: MandalaPage): { title: string; tips: string[] } {
  return {
    title: PAGE_LABELS[page] ?? 'Cette page',
    tips: TIPS[page] ?? [
      'Utilisez Signaler pour poser une question ou décrire un problème.',
      'La page en cours est jointe automatiquement à votre message.',
    ],
  }
}
