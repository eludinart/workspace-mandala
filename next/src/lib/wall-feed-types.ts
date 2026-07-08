/** Types partagés pour le mur d'actualité (landing + espace connecté). */

export type WallFeedSort = 'date' | 'place'

export type WallPlaceRef = {
  id: number
  slug: string
  name: string
  logo_emoji: string | null
  accent_color: string | null
  avatar: string | null
}

export type WallFeedItemBase = {
  id: string
  sort_at: string
  place: WallPlaceRef
  /** Contenu tronqué pour visiteurs non connectés / non membres */
  is_teaser?: boolean
}

export type WallAnnouncementItem = WallFeedItemBase & {
  kind: 'announcement'
  announcement_id: number
  title: string
  body: string
  image_data: string | null
  author_pseudo: string
  author_avatar_emoji: string
}

export type WallPostItem = WallFeedItemBase & {
  kind: 'post'
  post_id: number
  post_type: 'logistics' | 'inspiration'
  content: string
  author_pseudo: string
  author_avatar_emoji: string
}

export type WallEventItem = WallFeedItemBase & {
  kind: 'event'
  event_id: number
  title: string
  description: string | null
  starts_at: string | null
  ends_at: string | null
  location: string | null
  phase: string
  cover_image: string | null
  /** Calendrier : l'événement est terminé (distinct de la phase organisateur). */
  is_past: boolean
  /** Calendrier : l'événement a lieu maintenant. */
  is_ongoing?: boolean
}

export type WallFeedItem = WallAnnouncementItem | WallPostItem | WallEventItem

export type WallFeedResponse = {
  items: WallFeedItem[]
  sort: WallFeedSort
  is_authenticated: boolean
  member_place_count: number
  /** Nombre d'éléments masqués — incite à se connecter */
  hidden_count?: number
}
