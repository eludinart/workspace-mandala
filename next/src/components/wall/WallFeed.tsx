'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { wallApi } from '@/api/wall'
import { skillsApi, type SkillNote } from '@/api/skills'
import { WallFeedItemCard } from '@/components/wall/WallFeedItemCard'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { UserAvatar } from '@/components/UserAvatar'
import { placeAccentSurface } from '@/lib/place-accent'
import { formatMandalaDate } from '@/lib/format-datetime'
import { OPEN_SKILL_USER_KEY } from '@/components/skills/SkillsDirectory'
import type { WallFeedItem, WallFeedSort } from '@/lib/wall-feed-types'

function groupByPlace(items: WallFeedItem[]): Array<{ place: WallFeedItem['place']; items: WallFeedItem[] }> {
  const map = new Map<number, { place: WallFeedItem['place']; items: WallFeedItem[] }>()
  for (const item of items) {
    const cur = map.get(item.place.id)
    if (cur) cur.items.push(item)
    else map.set(item.place.id, { place: item.place, items: [item] })
  }
  return [...map.values()].sort((a, b) => a.place.name.localeCompare(b.place.name, 'fr'))
}

function isPastEventItem(item: WallFeedItem): boolean {
  return item.kind === 'event' && item.is_past
}

function filterPastEvents(items: WallFeedItem[], showPastEvents: boolean): WallFeedItem[] {
  if (showPastEvents) return items
  return items.filter((item) => !isPastEventItem(item))
}

export function WallFeed({
  initialSort = 'date',
  limit = 30,
  onEventClick,
  onOpenProfile,
  showConnectBanner = true,
  className = '',
}: {
  initialSort?: WallFeedSort
  limit?: number
  onEventClick?: (eventId: number) => void
  onOpenProfile?: (userId: number) => void
  showConnectBanner?: boolean
  className?: string
}) {
  const [channel, setChannel] = useState<'places' | 'people'>('places')
  const [sort, setSort] = useState<WallFeedSort>(initialSort)
  const [showPastEvents, setShowPastEvents] = useState(false)
  const [items, setItems] = useState<WallFeedItem[]>([])
  const [notes, setNotes] = useState<SkillNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [memberPlaceCount, setMemberPlaceCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (channel === 'people') {
        const res = await skillsApi.notes(limit)
        setNotes(res.notes ?? [])
        setIsAuthenticated(true)
      } else {
        const res = await wallApi.feed({ sort, limit })
        setItems(res.items ?? [])
        setIsAuthenticated(!!res.is_authenticated)
        setMemberPlaceCount(res.member_place_count ?? 0)
      }
    } catch (e: unknown) {
      setError((e as { detail?: string; message?: string })?.detail ?? 'Impossible de charger le fil')
      setItems([])
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [sort, limit, channel])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onEventsChanged = () => void load()
    window.addEventListener('mandala-events-changed', onEventsChanged)
    return () => window.removeEventListener('mandala-events-changed', onEventsChanged)
  }, [load])

  const visibleItems = useMemo(
    () => filterPastEvents(items, showPastEvents),
    [items, showPastEvents],
  )
  const hiddenPastCount = useMemo(
    () => items.filter(isPastEventItem).length,
    [items],
  )

  const grouped = useMemo(
    () => (sort === 'place' ? groupByPlace(visibleItems) : null),
    [visibleItems, sort],
  )

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl text-slate-100">Fil d&apos;actualité</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {channel === 'people'
              ? 'Brèves des personnes qui montrent leurs compétences'
              : isAuthenticated
              ? memberPlaceCount > 0
                ? `Messages et événements de vos ${memberPlaceCount} lieu(x)`
                : 'Rejoignez un lieu pour voir plus de contenu'
              : 'Mur public — contenus publiés par les organisateurs de chaque lieu'}
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
          {isAuthenticated && (
            <div
              className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-0.5 shrink-0 self-end"
              role="tablist"
              aria-label="Source du fil"
            >
              {(
                [
                  { id: 'places' as const, label: 'Lieux' },
                  { id: 'people' as const, label: 'Personnes' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={channel === opt.id}
                  onClick={() => setChannel(opt.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    channel === opt.id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {channel === 'places' && (
          <>
          <div
            className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-0.5 shrink-0 self-end"
            role="tablist"
            aria-label="Trier le fil"
          >
            {(
              [
                { id: 'date' as const, label: 'Par date' },
                { id: 'place' as const, label: 'Par lieu' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={sort === opt.id}
                onClick={() => setSort(opt.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    sort === opt.id
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none self-end">
            <input
              type="checkbox"
              checked={showPastEvents}
              onChange={(e) => setShowPastEvents(e.target.checked)}
              className="rounded border-slate-600 text-violet-600 focus:ring-violet-500/40"
            />
            Afficher les événements passés
            {!showPastEvents && hiddenPastCount > 0 && (
              <span className="text-slate-500">({hiddenPastCount} masqué{hiddenPastCount > 1 ? 's' : ''})</span>
            )}
          </label>
          </>
          )}
        </div>
      </div>

      {!isAuthenticated && showConnectBanner && (
        <div className="rounded-xl border border-violet-500/25 bg-violet-950/25 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-violet-100">
            Connectez-vous pour accéder au mur complet de vos lieux : annonces, brèves Agora et
            événements réservés aux membres.
          </p>
          <Link
            href="/app"
            className="shrink-0 text-sm px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-center"
          >
            Se connecter
          </Link>
        </div>
      )}

      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-800/50" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && channel === 'people' && notes.length === 0 && (
        <p className="text-sm text-slate-500 italic rounded-xl border border-slate-800 p-6 text-center">
          Aucune brève pour le moment. Publiez-en une depuis Compétences, dans Mon compte.
        </p>
      )}

      {!loading && !error && channel === 'people' && notes.length > 0 && (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <UserAvatar
                  avatar={note.author_avatar}
                  avatarEmoji={note.author_avatar_emoji}
                  size="sm"
                  alt={note.author_pseudo}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400">
                    {note.author_pseudo} · {formatMandalaDate(note.created_at)}
                    <span className="ml-1 opacity-70">
                      · {note.scope === 'mandala' ? 'Mandala' : note.places.map((p) => p.name).join(', ') || 'Lieux'}
                    </span>
                  </p>
                  <p className="mt-1.5 text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenProfile) onOpenProfile(note.author_id)
                    else if (typeof window !== 'undefined') {
                      sessionStorage.setItem(OPEN_SKILL_USER_KEY, String(note.author_id))
                      window.location.href = '/app?page=skills'
                    }
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg border border-violet-700/50 text-violet-200"
                >
                  Voir la fiche
                </button>
                {note.is_mine && (
                  <button
                    type="button"
                    onClick={() => {
                      void skillsApi.deleteNote(note.id).then(() => void load())
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg border border-slate-700 text-slate-400"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && channel === 'places' && visibleItems.length === 0 && (
        <p className="text-sm text-slate-500 italic rounded-xl border border-slate-800 p-6 text-center">
          {items.length > 0 && hiddenPastCount > 0 && !showPastEvents
            ? 'Aucune actualité récente. Cochez « Afficher les événements passés » pour voir l\u2019historique.'
            : 'Aucune actualité pour le moment. Revenez bientôt ou explorez les lieux sur la carte.'}
        </p>
      )}

      {!loading && !error && channel === 'places' && sort === 'date' && visibleItems.length > 0 && (
        <ul className="space-y-3">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <WallFeedItemCard item={item} onEventClick={onEventClick} />
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && channel === 'places' && sort === 'place' && grouped && grouped.length > 0 && (
        <div className="space-y-6">
          {grouped.map(({ place, items: placeItems }) => {
            const surface = placeAccentSurface(place.accent_color)
            return (
            <section key={place.id} className="space-y-3">
              <div
                className="flex items-center gap-3 sticky top-0 z-10 py-2.5 px-3 rounded-xl border backdrop-blur-sm -mx-1 bg-slate-950/90"
                style={{
                  backgroundColor: surface.headerBg,
                  borderColor: surface.cardBorder,
                }}
              >
                <CommunityAvatar
                  avatar={place.avatar}
                  logoEmoji={place.logo_emoji ?? '🏛️'}
                  accentColor={place.accent_color ?? '#7c3aed'}
                  size="sm"
                  alt={place.name}
                />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400/90">Lieu</p>
                  <h3 className="font-bold text-slate-50 truncate">{place.name}</h3>
                  <p className="text-[10px] text-slate-400">{placeItems.length} publication(s)</p>
                </div>
              </div>
              <ul className="space-y-3 pl-1">
                {placeItems.map((item) => (
                  <li key={item.id}>
                    <WallFeedItemCard item={item} onEventClick={onEventClick} compact />
                  </li>
                ))}
              </ul>
            </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
