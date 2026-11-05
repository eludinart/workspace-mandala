/** Écrans et textes des cartes d’aide contextuelle (côté client safe). */

export const EXPLAIN_SCREENS = [
  'home',
  'members',
  'messages',
  'calendar',
  'events',
  'skills',
  'directory',
  'resources',
  'discover',
  'courses',
  'logistics',
  'circles',
  'announcements',
  'agora',
  'heart_weather',
  'admin',
  'account',
  'notifications',
] as const

export type ExplainScreen = (typeof EXPLAIN_SCREENS)[number]

export const EXPLAIN_COPY: Record<ExplainScreen, { title: string; body: string }> = {
  home: {
    title: 'Accueil du lieu',
    body: 'Ici : le fil du lieu actif, les prochaines dates, et les raccourcis vers le reste de Mandala.',
  },
  members: {
    title: 'Membres',
    body: 'Les personnes de ce lieu. Vous pouvez leur écrire si vous partagez le lieu, ou via le seuil si la porte est ouverte.',
  },
  messages: {
    title: 'Messages',
    body: 'Conversations à deux ou en groupe. Les sondages et réactions aident à répondre sans tout écrire.',
  },
  calendar: {
    title: 'Calendrier',
    body: 'Les présences et événements de ce lieu. Les dates des lieux amis n’y sont pas mélangées.',
  },
  events: {
    title: 'Événements',
    body: 'Liste des rendez-vous du lieu. Ouvrez une carte pour le programme, les inscriptions et les retours.',
  },
  skills: {
    title: 'Annuaire',
    body: 'Savoir-faire et lieux d’exercice. Filtrez Pros / Membres, et voyez les rattachements lieux Mandala.',
  },
  directory: {
    title: 'Annuaire personnes',
    body: 'Personnes visibles sur Mandala, avec ou sans lieu. Ouvrez une fiche pour écrire ou voir les compétences.',
  },
  resources: {
    title: 'Ressources',
    body: 'Recettes, textes, vidéos et documents partagés. Filtrez par lieu ou par tout Mandala, puis ouvrez une carte pour lire.',
  },
  discover: {
    title: 'Découvrir',
    body: 'Carte des lieux, fil d’événements et messages d’organisateurs — le réseau Mandala hors du seul lieu actif.',
  },
  courses: {
    title: 'Courses',
    body: 'Liste partagée de ce qu’il faut apporter. Cochez ce que vous prenez et indiquez la date.',
  },
  logistics: {
    title: 'Logistique',
    body: 'Besoins matériel et chantiers du lieu. Plusieurs personnes peuvent s’engager ; photos bienvenues.',
  },
  circles: {
    title: 'Cercles',
    body: 'Journal matin / soir du lieu, avec photo du tableau rempli pendant le cercle.',
  },
  announcements: {
    title: 'Annonces du lieu',
    body: 'Messages importants affichés sur l’accueil — distincts des événements et des alertes personnelles.',
  },
  agora: {
    title: 'Agora',
    body: 'Le mur de la communauté : brèves d’inspiration ou de logistique, avec texte et image si besoin.',
  },
  heart_weather: {
    title: 'Météo du cœur',
    body: 'Une fois par jour, partagez comment vous vous sentez dans le lieu. Visible pour les autres membres.',
  },
  admin: {
    title: 'Administration',
    body: 'Outils réservés aux administrateurs : personnes, communications, télémétrie, portes et retours.',
  },
  account: {
    title: 'Mon compte',
    body: 'Photo, profil, notifications et abonnement. C’est aussi ici que vous gérez votre fiche publique.',
  },
  notifications: {
    title: 'Alertes',
    body: 'Notifications reçues. Ouvrez-en une pour aller directement à la page concernée.',
  },
}

export function isExplainScreen(v: unknown): v is ExplainScreen {
  return EXPLAIN_SCREENS.includes(v as ExplainScreen)
}
