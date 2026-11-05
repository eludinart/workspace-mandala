/** Écrans et textes des cartes d’aide contextuelle (côté client safe). */

export const EXPLAIN_SCREENS = [
  'home',
  'members',
  'messages',
  'calendar',
  'skills',
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
  skills: {
    title: 'Annuaire',
    body: 'Savoir-faire et lieux d’exercice. Filtrez Pros / Membres, et voyez les rattachements lieux Mandala.',
  },
}

export function isExplainScreen(v: unknown): v is ExplainScreen {
  return EXPLAIN_SCREENS.includes(v as ExplainScreen)
}
