'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  skillsApi,
  type AnnuaireMapMarker,
  type SkillCard,
  type SkillProfile,
  type SkillTag,
} from '@/api/skills'
import { MeetRequestButton } from '@/components/directory/MeetRequestButton'
import { ReturnsBlock } from '@/components/returns/ReturnsBlock'
import { UserAvatar } from '@/components/UserAvatar'
import { ACCOUNT_SKILLS_ANCHOR } from '@/components/skills/SkillsProfileSection'
import { ApiError } from '@/lib/api-client'
import { RESOURCE_KINDS } from '@/lib/resource-constants'
import { publicPlaceProfileHref } from '@/lib/skill-place-link'
import {
  SKILL_REGISTER_LABELS,
  SKILL_REGISTERS,
  type SkillRegister,
} from '@/lib/skill-constants'
import { ExplainCard } from '@/components/help/ExplainCard'
import { MandalaProBadge } from '@/components/pro/MandalaProBadge'
import type { MandalaPage } from '@/components/MandalaApp'
import { registerPullRefreshHandler } from '@/lib/pull-refresh'
import { onMandalaMapChanged } from '@/lib/map-changed'

const AnnuaireCitiesMap = dynamic(
  () =>
    import('@/components/public/AnnuaireCitiesMap').then((m) => m.AnnuaireCitiesMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(36vh,14rem)] sm:h-[min(42vh,18rem)] rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-500">Chargement de la carte…</p>
      </div>
    ),
  }
)

export const OPEN_SKILL_USER_KEY = 'mandala_skill_user'

export function queueSkillFiche(userId: number) {
  if (typeof window === 'undefined' || !userId) return
  sessionStorage.setItem(OPEN_SKILL_USER_KEY, String(userId))
}

function resourceKindLabel(kind: string): string {
  return RESOURCE_KINDS.find((item) => item.id === kind)?.label ?? 'Ressource'
}

type ProseBlock = { title: string | null; body: string }

/** Découpe une description en paragraphes, et isole « Titre : suite ». */
function skillProseBlocks(text: string): ProseBlock[] {
  const pieces = text
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((piece) =>
      piece
        .split(/(?<=\.)\)?\s+(?=[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇŒÆ][^:\n]{2,80} : )/)
        .map((part) => part.trim())
        .filter(Boolean)
    )

  return pieces.map((piece) => {
    const match = piece.match(/^([^:\n]{3,80})\s*:\s+([\s\S]+)$/)
    if (!match || match[1].includes('.')) return { title: null, body: piece }
    return { title: match[1].trim(), body: match[2].trim() }
  })
}

function SkillProse({ text }: { text: string }) {
  const blocks = skillProseBlocks(text)
  if (blocks.length === 0) return null
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <div key={index} className="space-y-1">
          {block.title && (
            <p className="text-sm font-semibold text-slate-100">{block.title}</p>
          )}
          <p className="text-[15px] leading-7 text-slate-300 max-w-[68ch] break-words">{block.body}</p>
        </div>
      ))}
    </div>
  )
}

function matchesTag(tags: SkillTag[], tag: string): boolean {
  const key = tag.trim().toLocaleLowerCase('fr')
  if (!key) return true
  return tags.some((t) => t.label.toLocaleLowerCase('fr').includes(key))
}

export function SkillsDirectory({
  variant = 'app',
  communitySlug,
  communityName,
  lockToPlace = false,
  initialUserId,
  peopleDirectory = false,
  audience: audienceProp,
  onAudienceChange,
  onOpenMessages,
  onOpenConversation,
  onOpenAlerts,
  onEditProfile,
  pullRefreshPage,
}: {
  /** `public` : fiches ouvertes à Mandala, sans compte. */
  variant?: 'app' | 'public'
  communitySlug?: string
  communityName?: string
  /** Sur la fiche d'un lieu : uniquement les personnes de ce lieu. */
  lockToPlace?: boolean
  /** Annuaire des personnes, y compris sans lieu. */
  peopleDirectory?: boolean
  initialUserId?: number | null
  /** Contrôle externe du filtre Tous / Pro / Membres (ex. sync carte). */
  audience?: 'all' | 'pro' | 'members'
  onAudienceChange?: (audience: 'all' | 'pro' | 'members') => void
  onOpenMessages?: (userId: string, communitySlug?: string) => void
  onOpenConversation?: (channelId: number) => void
  onOpenAlerts?: () => void
  onEditProfile?: () => void
  pullRefreshPage?: MandalaPage
}) {
  const [view, setView] = useState<'place' | 'mandala'>(
    peopleDirectory ? 'mandala' : lockToPlace || communitySlug ? 'place' : 'mandala'
  )
  const [placeFilter, setPlaceFilter] = useState<'all' | 'mine' | 'unattached'>(
    peopleDirectory ? 'mine' : 'all'
  )
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [register, setRegister] = useState<SkillRegister | ''>('')
  /** Double vision : tout l’annuaire, Mandala Pro, ou membres sans badge Pro. */
  const [audienceInternal, setAudienceInternal] = useState<'all' | 'pro' | 'members'>('all')
  const audience = audienceProp ?? audienceInternal
  const setAudience = (next: 'all' | 'pro' | 'members') => {
    if (audienceProp === undefined) setAudienceInternal(next)
    onAudienceChange?.(next)
  }
  const [networkOnly, setNetworkOnly] = useState(false)
  const [cards, setCards] = useState<SkillCard[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(initialUserId ?? null)
  const [opened, setOpened] = useState<SkillCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [mine, setMine] = useState<SkillProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapMarkers, setMapMarkers] = useState<AnnuaireMapMarker[]>([])
  const [mapLoading, setMapLoading] = useState(false)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)

  /** Carte sur l’annuaire app (Ce lieu / Mandala) et sur la fiche publique d’un lieu — pas sur /competences (déjà une carte au-dessus). */
  const showMap =
    (variant === 'app' && !peopleDirectory) || (variant === 'public' && lockToPlace)

  const placeScoped =
    lockToPlace || (variant === 'app' && !peopleDirectory && view === 'place')

  const load = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res =
        variant === 'public'
          ? await skillsApi.publicDirectory({
              communitySlug: lockToPlace ? communitySlug : undefined,
            })
          : await skillsApi.directory({
              view: peopleDirectory || (!lockToPlace && view === 'mandala') ? 'mandala' : 'place',
              communitySlug:
                peopleDirectory || (!lockToPlace && view === 'mandala')
                  ? undefined
                  : communitySlug,
            })
      setCards(res.cards ?? [])
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Impossible de charger l’annuaire')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [variant, view, communitySlug, lockToPlace, peopleDirectory])

  useEffect(() => {
    if (variant !== 'app') return
    void skillsApi.getMine().then((res) => setMine(res.profile)).catch(() => setMine(null))
  }, [variant])

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(handle)
  }, [load])

  const loadMap = useCallback(async () => {
    if (!showMap) {
      setMapMarkers([])
      return
    }
    if (placeScoped && !communitySlug) {
      setMapMarkers([])
      return
    }
    setMapLoading(true)
    try {
      const res = await skillsApi.mapMarkers({
        audience,
        communitySlug: placeScoped ? communitySlug : undefined,
      })
      setMapMarkers(res.markers ?? [])
    } catch {
      setMapMarkers([])
    } finally {
      setMapLoading(false)
    }
  }, [showMap, placeScoped, communitySlug, audience])

  useEffect(() => {
    const handle = window.setTimeout(() => void loadMap(), 180)
    return () => window.clearTimeout(handle)
  }, [loadMap])

  useEffect(() => {
    if (!showMap) return
    return onMandalaMapChanged(() => {
      void load()
      void loadMap()
    })
  }, [showMap, load, loadMap])

  const onPull = useCallback(async () => {
    await load()
    if (showMap) await loadMap()
  }, [load, loadMap, showMap])

  useEffect(() => {
    if (!pullRefreshPage || variant !== 'app') return
    return registerPullRefreshHandler(pullRefreshPage, onPull)
  }, [pullRefreshPage, variant, onPull])

  useEffect(() => {
    if (!initialUserId) return
    setSelectedId(initialUserId)
    const t = window.setTimeout(() => {
      document
        .getElementById('annuaire-fiche')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(t)
  }, [initialUserId])

  useEffect(() => {
    if (selectedId == null || variant !== 'app') return
    let cancelled = false
    void skillsApi
      .card(selectedId)
      .then((res) => {
        if (!cancelled) {
          setOpened(res.card)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOpened(null)
          setError('Cette fiche n’est pas visible')
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, variant])

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('fr')
    return cards.filter((card) => {
      if (
        peopleDirectory &&
        placeFilter === 'mine' &&
        !card.shares_place &&
        !(card.is_me && card.places.length > 0)
      ) {
        return false
      }
      if (peopleDirectory && placeFilter === 'unattached' && card.places.length > 0) return false
      if (networkOnly && !card.shares_place && !card.is_me) return false
      if (audience === 'pro' && !card.pro_verified) return false
      if (audience === 'members' && card.pro_verified) return false
      if (register && !card.tags.some((t) => t.register === register)) return false
      if (!matchesTag(card.tags, tag)) return false
      if (!q) return true
      const hay = [
        card.pseudo,
        card.display_name,
        card.offer_text,
        card.seek_text,
        card.frame_text,
        card.pro_tagline,
        card.pro_service_area,
        card.residence_city,
        ...(card.practice_locations ?? []),
        ...card.tags.map((t) => `${t.label} ${SKILL_REGISTER_LABELS[t.register]}`),
        ...card.places.map((p) => p.name),
      ]
        .join(' ')
        .toLocaleLowerCase('fr')
      return hay.includes(q)
    })
  }, [
    cards,
    register,
    tag,
    query,
    peopleDirectory,
    placeFilter,
    audience,
    networkOnly,
  ])

  const featuredPros = useMemo(
    () => visible.filter((c) => c.pro_verified).slice(0, 6),
    [visible]
  )

  async function contactPro(card: SkillCard) {
    if (variant !== 'app' || card.is_me) return
    if (card.pro_verified || card.pro_boost) {
      void skillsApi.notifyContactLead(card.user_id).catch(() => {})
    }
    if (card.shares_place && card.shared_place_slug && onOpenMessages) {
      onOpenMessages(String(card.user_id), card.shared_place_slug)
      return
    }
    if (card.pro_verified && onOpenMessages) {
      onOpenMessages(String(card.user_id))
    }
  }

  const skillCloud = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of cards) {
      for (const t of card.tags) {
        counts.set(t.label, (counts.get(t.label) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr', { sensitivity: 'base' })
    )
  }, [cards])

  const mineAppears = mine != null && cards.some((c) => c.user_id === mine.user_id)
  const others = visible.filter((c) => !c.is_me)

  const selected =
    (opened && opened.user_id === selectedId ? opened : null) ??
    visible.find((c) => c.user_id === selectedId) ??
    cards.find((c) => c.user_id === selectedId) ??
    null

  const openMine = () => {
    if (typeof window !== 'undefined') sessionStorage.setItem(ACCOUNT_SKILLS_ANCHOR, 'competences')
    onEditProfile?.()
  }

  const title = peopleDirectory
    ? 'Annuaire'
    : lockToPlace
      ? `Annuaire · ${communityName ?? 'ce lieu'}`
      : variant === 'public'
        ? audience === 'pro'
          ? 'Mandala Pro'
          : 'Annuaire Mandala'
        : view === 'place'
          ? `Annuaire · ${communityName ?? 'ce lieu'}`
          : audience === 'pro'
            ? 'Mandala Pro'
            : 'Annuaire Mandala'

  const subtitle = peopleDirectory
    ? 'Personnes qui ont choisi Tout Mandala sur leur fiche, avec ou sans lieu.'
    : audience === 'pro'
      ? 'Professionnels validés — badge, zone d’intervention, contact facilité.'
      : audience === 'members'
        ? 'Membres qui partagent leurs pratiques, sans badge Mandala Pro.'
        : lockToPlace
          ? 'Pros et membres de ce lieu, filtrables.'
          : variant === 'public'
            ? 'Pros validés et membres du réseau — filtrez selon ce que vous cherchez.'
            : view === 'place'
              ? 'Fiches du lieu : pros et membres, visibles ensemble.'
              : 'Fiches ouvertes à Mandala : pros et membres, filtrables.'

  return (
    <div className="space-y-5">
      {variant === 'app' && <ExplainCard screen={peopleDirectory ? 'directory' : 'skills'} />}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300/80">
            Annuaire
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-50">{title}</h2>
          <p className="text-sm text-slate-400 max-w-xl">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-0.5"
            role="tablist"
            aria-label="Filtrer pros et membres"
          >
            {(
              [
                ['all', 'Tous'],
                ['pro', 'Mandala Pro'],
                ['members', 'Membres'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={audience === id}
                onClick={() => {
                  setAudience(id)
                  setSelectedId(null)
                  setSelectedMarkerId(null)
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium ${
                  audience === id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {peopleDirectory && (
            <div className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-0.5" role="tablist">
              {(
                [
                  ['all', 'Tous'],
                  ['mine', 'Mon lieu'],
                  ['unattached', 'Sans lieu'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={placeFilter === id}
                  onClick={() => {
                    setPlaceFilter(id)
                    setSelectedId(null)
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium ${
                    placeFilter === id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {variant === 'app' && !lockToPlace && !peopleDirectory && (
            <div className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-0.5" role="tablist">
              {(
                [
                  ['place', 'Ce lieu'],
                  ['mandala', 'Mandala'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => {
                    setView(id)
                    setSelectedId(null)
                    setSelectedMarkerId(null)
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium ${
                    view === id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {onEditProfile && (
            <button
              type="button"
              onClick={openMine}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-600 text-slate-200 hover:bg-slate-800"
            >
              Ma fiche
            </button>
          )}
        </div>
      </header>

      {variant === 'app' && !loading && mine && !mineAppears && (
        <div className="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium text-slate-100">Vous n’apparaissez pas encore</p>
            <p className="text-sm text-slate-400 mt-1">
              {peopleDirectory
                ? 'Choisissez Tout Mandala sur votre fiche pour apparaître ici, même sans lieu.'
                : others.length === 0
                  ? 'Les fiches cachées ne s’affichent pas. Rendez la vôtre visible pour ce lieu.'
                  : 'Votre fiche est cachée, ou limitée à d’autres lieux.'}
            </p>
          </div>
          {onEditProfile && (
            <button
              type="button"
              onClick={openMine}
              className="shrink-0 text-sm px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500"
            >
              Compléter ma fiche
            </button>
          )}
        </div>
      )}

      {showMap && (
        <div id="annuaire-carte" className="space-y-2 scroll-mt-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                {placeScoped ? 'Carte des membres du lieu' : 'Carte des membres'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {placeScoped
                  ? 'Positions géographiques des fiches de ce lieu. Cliquez un pin pour ouvrir la fiche.'
                  : 'Villes d’exercice sur tout Mandala. Le filtre Pros / Membres s’applique aussi ici.'}
              </p>
            </div>
            {mapLoading && (
              <p className="text-[11px] text-slate-500">Mise à jour carte…</p>
            )}
          </div>
          <AnnuaireCitiesMap
            markers={mapMarkers}
            selectedId={selectedMarkerId}
            heightClassName="h-[min(40vh,16rem)] sm:h-[min(48vh,22rem)]"
            onSelectMarker={(m) => {
              setSelectedMarkerId(m.id)
              if ((m.kind === 'practice' || m.kind === 'residence') && m.user_id) {
                setSelectedId(m.user_id)
                window.setTimeout(() => {
                  document
                    .getElementById('annuaire-fiche')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 80)
              }
            }}
          />
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4 space-y-3">
        <label className="block text-xs text-slate-400">
          Que cherchez-vous ?
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Un savoir-faire, un nom, ce que quelqu’un peut apporter…"
            className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        {skillCloud.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTag('')}
              className={`text-[11px] px-2.5 py-1 rounded-full border ${
                tag === '' ? 'border-violet-500 bg-violet-600/30 text-violet-100' : 'border-slate-700 text-slate-400'
              }`}
            >
              Tous les savoir-faire
            </button>
            {skillCloud.map(([label, count]) => (
              <button
                key={label}
                type="button"
                onClick={() => setTag((cur) => (cur.toLocaleLowerCase('fr') === label.toLocaleLowerCase('fr') ? '' : label))}
                className={`text-[11px] px-2.5 py-1 rounded-full border ${
                  tag.toLocaleLowerCase('fr') === label.toLocaleLowerCase('fr')
                    ? 'border-violet-500 bg-violet-600/30 text-violet-100'
                    : 'border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {label}
                <span className="ml-1 text-slate-500">{count}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="text-xs text-slate-400 hover:text-slate-200"
          aria-expanded={filtersOpen}
        >
          {filtersOpen ? 'Masquer les filtres' : 'Affiner'}
        </button>
        {filtersOpen && (
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Registre
              <select
                value={register}
                onChange={(e) => setRegister(e.target.value as SkillRegister | '')}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Tous</option>
                {SKILL_REGISTERS.map((id) => (
                  <option key={id} value={id}>
                    {SKILL_REGISTER_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            {variant === 'app' && !lockToPlace && (
              <label className="text-xs text-slate-400 flex items-center gap-2 pt-5 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={networkOnly}
                  onChange={(e) => setNetworkOnly(e.target.checked)}
                  className="rounded"
                />
                Mon réseau de lieux seulement (personnes avec qui je partage un lieu)
              </label>
            )}
          </div>
        )}
      </div>

      {featuredPros.length > 0 && audience !== 'pro' && audience !== 'members' && (
        <section className="space-y-2 rounded-2xl border border-violet-800/40 bg-violet-950/20 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
            Pros mis en avant
            {communityName ? ` · ${communityName}` : ''}
          </h3>
          <p className="text-[11px] text-slate-500">
            Badge endossé par un lieu du réseau — pas un simple abonnement.
          </p>
          <ul className="flex flex-wrap gap-2">
            {featuredPros.map((card) => (
              <li key={`feat-${card.user_id}`}>
                <button
                  type="button"
                  onClick={() => setSelectedId(card.user_id)}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-violet-600/50 bg-violet-900/40 text-violet-100 hover:bg-violet-800/50"
                >
                  {card.display_name || card.pseudo}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-slate-500">
        {loading && cards.length === 0
          ? 'Chargement…'
          : refreshing
            ? 'Mise à jour…'
            : `${visible.length} fiche${visible.length > 1 ? 's' : ''}`}
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] items-start">
        <ul className={`grid min-w-0 gap-3 ${selected ? 'order-2 lg:order-1' : ''}`}>
          {!loading && !refreshing && visible.length === 0 && (
            <li className="sm:col-span-2 rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
              Aucune fiche ne correspond. Les personnes choisissent elles-mêmes d’apparaître ici.
            </li>
          )}
          {visible.map((card) => {
            const active = selected?.user_id === card.user_id
            return (
              <li key={card.user_id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(card.user_id)}
                  className={`w-full min-w-0 overflow-hidden text-left rounded-2xl border p-4 space-y-3 transition-colors ${
                    card.pro_verified
                      ? `m-pro-card ${active ? 'ring-2 ring-violet-400/40' : ''}`
                      : active
                        ? 'border-violet-500/70 bg-violet-950/30'
                        : 'border-slate-800 bg-slate-900/50 hover:border-violet-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar avatar={card.avatar} avatarEmoji={card.avatar_emoji} size="md" alt={card.pseudo} />
                    <div className="min-w-0">
                      <p className="font-medium truncate flex flex-wrap items-center gap-2">
                        <span className="truncate">{card.display_name || card.pseudo}</span>
                        {card.pro_verified ? (
                          <MandalaProBadge endorsementPlace={card.pro_endorsement_place} />
                        ) : card.pro_boost ? (
                          <MandalaProBadge variant="boost" />
                        ) : null}
                      </p>
                      {card.places.length > 0 ? (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {card.places.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-amber-700/50 bg-amber-950/40 px-2 py-0.5 text-[11px] text-amber-100"
                            >
                              <span aria-hidden>{p.logo_emoji || '🏛️'}</span>
                              <span className="truncate">Lieu Mandala · {p.name}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500">Sans lieu Mandala</p>
                      )}
                      {card.residence_city && (
                        <p className="text-[11px] text-emerald-300/90 truncate">
                          Habite · {card.residence_city}
                        </p>
                      )}
                      {(card.practice_locations?.length ?? 0) > 0 && (
                        <p className="text-[11px] text-sky-300/90 truncate">
                          Exerce · {(card.practice_locations ?? []).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                  {(card.pro_tagline || card.offer_text) && (
                    <p className="min-w-0 text-sm leading-relaxed text-slate-400 line-clamp-3 break-words">
                      {(card.pro_tagline || card.offer_text || '')
                        .replace(/\s+/g, ' ')
                        .trim()}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 min-w-0">
                    {card.tags.slice(0, 4).map((t) => (
                      <span
                        key={`${t.label}-${t.register}`}
                        className="max-w-full text-[11px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-300 break-words"
                      >
                        {t.label}
                      </span>
                    ))}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>

        <article
          id="annuaire-fiche"
          className={`relative z-10 min-w-0 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-7 min-h-[16rem] scroll-mt-24 ${
            selected ? 'order-1 lg:order-2' : 'order-2'
          } ${selected?.pro_verified ? 'm-pro-card' : ''}`}
        >
          {!selected && (
            <p className="text-sm text-slate-500">Sélectionnez une personne pour lire sa fiche.</p>
          )}
          {selected && (
            <div className="space-y-7">
              <header className="flex items-start gap-4">
                <UserAvatar
                  avatar={selected.avatar}
                  avatarEmoji={selected.avatar_emoji}
                  size="xl"
                  alt={selected.pseudo}
                />
                <div className="min-w-0 pt-1">
                  <h3 className="text-2xl font-semibold text-slate-50 leading-tight flex flex-wrap items-center gap-2">
                    <span>{selected.display_name || selected.pseudo}</span>
                    {selected.pro_verified ? (
                      <MandalaProBadge endorsementPlace={selected.pro_endorsement_place} />
                    ) : selected.pro_boost ? (
                      <MandalaProBadge variant="boost" />
                    ) : null}
                  </h3>
                  {selected.pro_tagline && (
                    <p className="mt-1 text-sm text-slate-200">{selected.pro_tagline}</p>
                  )}
                  {selected.skills_visible !== false && selected.scope === 'mandala' && (
                    <p className="mt-1 text-xs font-medium text-violet-300">Visible sur Mandala</p>
                  )}
                  {selected.places.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {selected.places.map((p) => {
                        const href = publicPlaceProfileHref(p)
                        const label = (
                          <>
                            <span aria-hidden>{p.logo_emoji || '🏛️'}</span>
                            <span>
                              Rattaché au lieu Mandala · <strong>{p.name}</strong>
                            </span>
                          </>
                        )
                        const className =
                          'inline-flex items-center gap-1.5 rounded-full border border-amber-700/50 bg-amber-950/35 px-2.5 py-1 text-xs text-amber-100'
                        return (
                          <li key={p.id}>
                            {href ? (
                              <a href={href} className={`${className} hover:bg-amber-900/40`}>
                                {label}
                              </a>
                            ) : (
                              <span className={className} title="Profil du lieu privé">
                                {label}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Sans rattachement à un lieu Mandala</p>
                  )}
                  {selected.residence_city && (
                    <p className="mt-1.5 text-xs text-emerald-300/90">
                      Habite à {selected.residence_city}
                    </p>
                  )}
                  {(selected.practice_locations?.length ?? 0) > 0 && (
                    <p className="mt-1.5 text-xs text-sky-300/90">
                      Exerce à {(selected.practice_locations ?? []).join(' · ')}
                    </p>
                  )}
                  {selected.is_me && selected.profile_views_30d != null && (
                    <p className="mt-1 text-xs text-slate-400">
                      {selected.profile_views_30d} vue
                      {selected.profile_views_30d > 1 ? 's' : ''} de fiche sur 30 jours
                    </p>
                  )}
                  <a
                    href={`/competences/${selected.user_id}`}
                    className="mt-2 inline-block text-xs text-violet-300 underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Page publique SEO
                  </a>
                </div>
              </header>

              {(selected.pro_modalities ||
                selected.pro_service_area ||
                selected.pro_external_url) && (
                <section className="space-y-1 rounded-xl border border-violet-900/40 bg-violet-950/20 px-4 py-3 text-sm text-slate-300">
                  {selected.pro_service_area && (
                    <p>Zone : {selected.pro_service_area}</p>
                  )}
                  {selected.pro_modalities && <p>{selected.pro_modalities}</p>}
                  {selected.pro_external_url && (
                    <a
                      href={selected.pro_external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-300 underline underline-offset-2"
                    >
                      Site / prise de rendez-vous
                    </a>
                  )}
                </section>
              )}

              {!!selected.bio?.trim() && (
                <section className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bio</h4>
                  <p className="text-[15px] leading-7 text-slate-300 whitespace-pre-wrap max-w-[68ch]">
                    {selected.bio.trim()}
                  </p>
                </section>
              )}

              {selected.skills_visible !== false && selected.tags.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Savoir-faire</h4>
                  <ul className="flex min-w-0 flex-wrap gap-2">
                    {selected.tags.map((t) => (
                      <li
                        key={`${t.label}-${t.register}`}
                        className="max-w-full rounded-2xl border border-slate-700 bg-slate-950/40 px-3 py-2"
                      >
                        <p className="text-sm text-slate-100 break-words">{t.label}</p>
                        <p className="text-[11px] text-slate-500">{SKILL_REGISTER_LABELS[t.register]}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {selected.skills_visible !== false && selected.offer_text && (
                <section className="space-y-3 border-t border-slate-800 pt-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Ce que je peux apporter
                  </h4>
                  <SkillProse text={selected.offer_text} />
                </section>
              )}

              {selected.skills_visible !== false && selected.seek_text && (
                <section className="space-y-3 border-t border-slate-800 pt-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Ce que je cherche
                  </h4>
                  <SkillProse text={selected.seek_text} />
                </section>
              )}

              {selected.skills_visible !== false && selected.frame_text && (
                <section className="space-y-3 border-t border-slate-800 pt-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mon cadre</h4>
                  <SkillProse text={selected.frame_text} />
                </section>
              )}

              <div className="border-t border-slate-800 pt-6">
                <ReturnsBlock
                  key={selected.user_id}
                  mode="person"
                  userId={selected.user_id}
                  communitySlug={communitySlug || selected.shared_place_slug || undefined}
                  compact
                  heading="Retours"
                  allowDesignate={!selected.is_me}
                />
              </div>

              {(selected.resources?.length ?? 0) > 0 && (
                <section className="space-y-3 border-t border-slate-800 pt-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ressources</h4>
                  <ul className="space-y-2">
                    {selected.resources!.map((resource) => (
                      <li key={resource.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                          {resourceKindLabel(resource.kind)}
                        </p>
                        <p className="text-sm font-medium text-slate-100">{resource.title}</p>
                        {resource.summary && (
                          <p className="mt-1 text-sm leading-6 text-slate-400">{resource.summary}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!selected.bio?.trim() &&
                selected.skills_visible === false &&
                (selected.resources?.length ?? 0) === 0 && (
                  <p className="text-sm text-slate-500">
                    Cette personne n’a pas encore partagé sa bio, ses compétences ni ses ressources.
                  </p>
                )}

              {variant === 'app' && !selected.is_me && (
                <div className="flex flex-wrap gap-2">
                  {(selected.shares_place || selected.pro_verified) && onOpenMessages && (
                    <button
                      type="button"
                      onClick={() => void contactPro(selected)}
                      className="text-sm px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
                    >
                      {selected.pro_verified && !selected.shares_place
                        ? 'Contacter (Mandala Pro)'
                        : 'Envoyer un message'}
                    </button>
                  )}
                  {!selected.shares_place && !selected.pro_verified && (
                    <MeetRequestButton
                      userId={selected.user_id}
                      onOpenConversation={onOpenConversation}
                      onOpenAlerts={onOpenAlerts}
                    />
                  )}
                  {!selected.shares_place && selected.pro_verified && (
                    <MeetRequestButton
                      userId={selected.user_id}
                      onOpenConversation={onOpenConversation}
                      onOpenAlerts={onOpenAlerts}
                    />
                  )}
                </div>
              )}
              {variant === 'public' && (
                <a
                  href="/app"
                  className="inline-block text-sm px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
                >
                  Se connecter pour écrire
                </a>
              )}
            </div>
          )}
        </article>
      </div>
    </div>
  )
}
