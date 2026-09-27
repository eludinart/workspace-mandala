'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { skillsApi, type SkillCard, type SkillProfile, type SkillTag } from '@/api/skills'
import { UserAvatar } from '@/components/UserAvatar'
import { ACCOUNT_SKILLS_ANCHOR } from '@/components/skills/SkillsProfileSection'
import { ApiError } from '@/lib/api-client'
import {
  SKILL_REGISTER_LABELS,
  SKILL_REGISTERS,
  SKILL_TRAITS,
  skillTraitLabel,
  type SkillRegister,
} from '@/lib/skill-constants'

export const OPEN_SKILL_USER_KEY = 'mandala_skill_user'

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
  onOpenMessages,
  onEditProfile,
}: {
  /** `public` : fiches ouvertes à Mandala, sans compte. */
  variant?: 'app' | 'public'
  communitySlug?: string
  communityName?: string
  /** Sur la fiche d'un lieu : uniquement les personnes de ce lieu. */
  lockToPlace?: boolean
  initialUserId?: number | null
  onOpenMessages?: (userId: string) => void
  onEditProfile?: () => void
}) {
  const [view, setView] = useState<'place' | 'mandala'>(lockToPlace || communitySlug ? 'place' : 'mandala')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [register, setRegister] = useState<SkillRegister | ''>('')
  const [trait, setTrait] = useState('')
  const [cards, setCards] = useState<SkillCard[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(initialUserId ?? null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [mine, setMine] = useState<SkillProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

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
              view: lockToPlace ? 'place' : view,
              communitySlug: lockToPlace || view === 'place' ? communitySlug : undefined,
            })
      setCards(res.cards ?? [])
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Impossible de charger l’annuaire')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [variant, view, communitySlug, lockToPlace])

  useEffect(() => {
    if (variant !== 'app') return
    void skillsApi.getMine().then((res) => setMine(res.profile)).catch(() => setMine(null))
  }, [variant])

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(handle)
  }, [load])

  useEffect(() => {
    if (!initialUserId || variant !== 'app') return
    setSelectedId(initialUserId)
    let cancelled = false
    void skillsApi
      .card(initialUserId)
      .then((res) => {
        if (cancelled) return
        setCards((prev) => (prev.some((c) => c.user_id === res.card.user_id) ? prev : [res.card, ...prev]))
      })
      .catch(() => {
        if (!cancelled) setError('Cette fiche n’est pas visible')
      })
    return () => {
      cancelled = true
    }
  }, [initialUserId, variant])

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('fr')
    return cards.filter((card) => {
      if (register && !card.tags.some((t) => t.register === register)) return false
      if (trait && !card.traits.includes(trait as SkillCard['traits'][number])) return false
      if (!matchesTag(card.tags, tag)) return false
      if (!q) return true
      const hay = [
        card.pseudo,
        card.display_name,
        card.offer_text,
        card.seek_text,
        ...card.tags.map((t) => `${t.label} ${SKILL_REGISTER_LABELS[t.register]}`),
        ...card.traits.map(skillTraitLabel),
        ...card.places.map((p) => p.name),
      ]
        .join(' ')
        .toLocaleLowerCase('fr')
      return hay.includes(q)
    })
  }, [cards, register, trait, tag, query])

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

  const selected = visible.find((c) => c.user_id === selectedId) ?? cards.find((c) => c.user_id === selectedId) ?? null

  const openMine = () => {
    if (typeof window !== 'undefined') sessionStorage.setItem(ACCOUNT_SKILLS_ANCHOR, 'competences')
    onEditProfile?.()
  }

  const title = lockToPlace
    ? `Annuaire · ${communityName ?? 'ce lieu'}`
    : variant === 'public'
      ? 'Annuaire des compétences'
      : view === 'place'
        ? `Annuaire · ${communityName ?? 'ce lieu'}`
        : 'Annuaire Mandala'

  const subtitle = lockToPlace || variant === 'public'
    ? 'Personnes qui ont choisi de montrer leurs compétences à tout Mandala.'
    : view === 'place'
      ? 'Fiches visibles pour les membres de ce lieu, et celles ouvertes à Mandala.'
      : 'Fiches ouvertes à tout membre connecté.'

  return (
    <div className="space-y-5">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300/80">Compétences</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-50">{title}</h2>
          <p className="text-sm text-slate-400 max-w-xl">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {variant === 'app' && !lockToPlace && (
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
              {others.length === 0
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
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Savoir-être</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTrait('')}
              className={`text-[11px] px-2.5 py-1 rounded-full border ${
                trait === '' ? 'border-violet-500 bg-violet-600/30 text-violet-100' : 'border-slate-700 text-slate-400'
              }`}
            >
              Tous les savoir-être
            </button>
          {SKILL_TRAITS.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => setTrait((cur) => (cur === item.code ? '' : item.code))}
              className={`text-[11px] px-2.5 py-1 rounded-full border ${
                trait === item.code
                  ? 'border-violet-500 bg-violet-600/30 text-violet-100'
                  : 'border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
          </div>
        </div>
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
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {loading && cards.length === 0
          ? 'Chargement…'
          : refreshing
            ? 'Mise à jour…'
            : `${visible.length} fiche${visible.length > 1 ? 's' : ''}`}
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid lg:grid-cols-[1fr_20rem] gap-4 items-start">
        <ul className="grid sm:grid-cols-2 gap-3">
          {!loading && !refreshing && visible.length === 0 && (
            <li className="sm:col-span-2 rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
              Aucune fiche ne correspond. Les personnes choisissent elles-mêmes d’apparaître ici.
            </li>
          )}
          {visible.map((card) => {
            const active = selected?.user_id === card.user_id
            return (
              <li key={card.user_id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(card.user_id)}
                  className={`w-full text-left rounded-2xl border p-4 space-y-3 transition-colors ${
                    active
                      ? 'border-violet-500/70 bg-violet-950/30'
                      : 'border-slate-800 bg-slate-900/50 hover:border-violet-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar avatar={card.avatar} avatarEmoji={card.avatar_emoji} size="md" alt={card.pseudo} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{card.display_name || card.pseudo}</p>
                      {card.places.length > 0 && (
                        <p className="text-[11px] text-slate-500 truncate">
                          {card.places.map((p) => p.name).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                  {card.offer_text && (
                    <p className="text-sm text-slate-300 line-clamp-2">{card.offer_text}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {card.tags.slice(0, 3).map((t) => (
                      <span
                        key={`${t.label}-${t.register}`}
                        className="text-[11px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-300"
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

        <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:sticky lg:top-4 min-h-[12rem]">
          {!selected && (
            <p className="text-sm text-slate-500">Sélectionnez une personne pour lire sa fiche.</p>
          )}
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <UserAvatar
                  avatar={selected.avatar}
                  avatarEmoji={selected.avatar_emoji}
                  size="lg"
                  alt={selected.pseudo}
                />
                <div>
                  <p className="font-semibold text-lg">{selected.display_name || selected.pseudo}</p>
                  {selected.scope === 'mandala' && (
                    <p className="text-[11px] uppercase tracking-wide text-violet-300">Visible sur Mandala</p>
                  )}
                </div>
              </div>
              {selected.tags.length > 0 && (
                <ul className="space-y-1.5">
                  {selected.tags.map((t) => (
                    <li key={`${t.label}-${t.register}`} className="flex justify-between gap-3 text-sm">
                      <span>{t.label}</span>
                      <span className="text-[10px] uppercase text-slate-500 text-right">
                        {SKILL_REGISTER_LABELS[t.register]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {selected.traits.length > 0 && (
                <p className="text-sm text-slate-300">{selected.traits.map(skillTraitLabel).join(' · ')}</p>
              )}
              {selected.offer_text && (
                <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">
                  <span className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Peut apporter</span>
                  {selected.offer_text}
                </p>
              )}
              {selected.seek_text && (
                <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">
                  <span className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Cherche</span>
                  {selected.seek_text}
                </p>
              )}
              {selected.places.length > 0 && variant === 'app' && (
                <p className="text-xs text-slate-500">Lieux en commun : {selected.places.map((p) => p.name).join(', ')}</p>
              )}
              {variant === 'app' && !selected.is_me && onOpenMessages && (
                <button
                  type="button"
                  onClick={() => onOpenMessages(String(selected.user_id))}
                  className="w-full text-sm py-2 rounded-lg border border-violet-700/50 text-violet-200"
                >
                  Envoyer un message
                </button>
              )}
              {variant === 'public' && (
                <a
                  href="/app"
                  className="block text-center text-sm py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500"
                >
                  Se connecter pour écrire
                </a>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
