import type { MandalaPage } from '@/components/MandalaApp'
import { PAGE_LABELS } from '@/lib/nav'

const TIPS: Partial<Record<MandalaPage, string[]>> = {
  home: [
    'L’accueil montre le fil et les annonces du lieu actif.',
    'Le lieu en cours se change dans la barre en haut.',
  ],
  calendar: [
    'Les jours sont fermés tant qu’un gestionnaire ne les ouvre pas, ou ne coche pas un rythme de semaine.',
    'Un jour ou plusieurs : Ouvrir, Fermer et Créer un événement sont dans le même bloc de détail.',
    'Sur un événement de plusieurs jours, « Je viens sur tous les jours ouverts » inscrit la présence d’un coup.',
  ],
  events: [
    'Liste des événements du lieu. Ouvrez une carte pour le programme.',
    'Les gestionnaires peuvent créer et modifier un événement.',
    'Après la date, une personne présente peut écrire un retour. L’équipe de l’événement ne le fait pas.',
  ],
  members: [
    'Annuaire des personnes du lieu actif.',
    'Le groupe cœur est listé à part. Les gestionnaires le cochent. Ça ne donne pas les droits de gestion.',
    'Ouvrez une fiche pour envoyer un message.',
  ],
  messages: [
    'Conversations du lieu actif. Le badge compte les messages non lus de ce lieu.',
    'La conversation du groupe cœur est réservée à ce cercle et aux gestionnaires. Les gestionnaires peuvent la renommer. Elle ne se supprime pas.',
    '« Supprimer » n’apparaît qu’au créateur. L’effacement retire la conversation pour tous les participants, après un avertissement.',
    'Le bouton en haut à droite sert à écrire à un membre.',
    '« Mandala » en haut à gauche ramène à la page précédente.',
  ],
  skills: [
    'Les savoir-faire servent à vous retrouver. Le texte décrit des rôles, pas une liste de qualités.',
    'L’annuaire montre les fiches que les membres ont choisi de rendre visibles.',
    'Un retour sur un moment passé avec quelqu’un s’ouvre après une présence passée, si la personne accepte d’être désignée.',
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
    'La section Évaluations ouvre les retours sur ce que vous proposez, et montre les demandes reçues.',
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
    'Le groupe cœur est un cercle du lieu. Le cocher ne donne pas les droits de gestion.',
  ],
  'place-invites': [
    'Créez un lien ou un code pour inviter quelqu’un dans le lieu.',
  ],
  'place-announcements': [
    'Message important affiché sur l’accueil du lieu.',
    'Choisissez Tout le lieu, ou seulement le groupe cœur et les gestionnaires.',
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
