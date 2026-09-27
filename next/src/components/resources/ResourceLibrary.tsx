'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { resourcesApi, resourceMediaUrl, type ResourceCard, type ResourceDetail } from '@/api/resources'
import { ResourceComposer } from '@/components/resources/ResourceComposer'
import { ResourceReader } from '@/components/resources/ResourceReader'
import { ApiError } from '@/lib/api-client'
import { RESOURCE_KINDS, resourceKindMeta, type ResourceKind } from '@/lib/resource-constants'

export function ResourceLibrary({
  variant = 'app',
  communitySlug,
  communityName,
  lockToPlace = false,
}: {
  variant?: 'app' | 'public'
  communitySlug?: string
  communityName?: string
  lockToPlace?: boolean
}) {
  const [view, setView] = useState<'place' | 'mandala'>(lockToPlace || communitySlug ? 'place' : 'mandala')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<ResourceKind | ''>('')
  const [cards, setCards] = useState<ResourceCard[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<ResourceDetail | null>(null)
  const [composing, setComposing] = useState(false)
  const [hiddenMine, setHiddenMine] = useState(0)

  const load = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res =
        variant === 'public'
          ? await resourcesApi.publicList(lockToPlace ? communitySlug : undefined)
          : await resourcesApi.list({
              view: lockToPlace ? 'place' : view,
              communitySlug: lockToPlace || view === 'place' ? communitySlug : undefined,
            })
      setCards(res.cards ?? [])
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Impossible de charger les ressources')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [variant, view, communitySlug, lockToPlace])

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(handle)
  }, [load])

  useEffect(() => {
    if (variant !== 'app') return
    void resourcesApi
      .mine()
      .then((res) => setHiddenMine((res.cards ?? []).filter((c) => c.scope === 'hidden').length))
      .catch(() => setHiddenMine(0))
  }, [variant, composing])

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('fr')
    return cards.filter((card) => {
      if (kind && card.kind !== kind) return false
      if (!q) return true
      const hay = [card.title, card.summary, card.author_pseudo, ...card.tags].join(' ').toLocaleLowerCase('fr')
      return hay.includes(q)
    })
  }, [cards, query, kind])

  async function openCard(card: ResourceCard) {
    setError(null)
    try {
      const res = await resourcesApi.get(card.id)
      setOpen(res.resource)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Cette ressource n’est pas visible')
    }
  }

  const title = lockToPlace ? `Ressources · ${communityName || 'ce lieu'}` : 'Ressources'

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300/80">Bibliothèque</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>
          {variant === 'app' && (
            <button type="button" onClick={() => setComposing(true)} className="px-3 py-2 rounded-lg bg-violet-600 text-sm">
              Partager
            </button>
          )}
        </div>
        {refreshing && cards.length > 0 && <p className="text-xs text-slate-500">Mise à jour…</p>}
      </header>

      {variant === 'app' && !lockToPlace && (
        <div className="flex gap-2">
          <button type="button" onClick={() => setView('place')} className={`px-3 py-1.5 rounded-full text-sm border ${view === 'place' ? 'border-violet-400 text-violet-200' : 'border-slate-700 text-slate-400'}`}>
            Ce lieu
          </button>
          <button type="button" onClick={() => setView('mandala')} className={`px-3 py-1.5 rounded-full text-sm border ${view === 'mandala' ? 'border-violet-400 text-violet-200' : 'border-slate-700 text-slate-400'}`}>
            Tout Mandala
          </button>
        </div>
      )}

      {hiddenMine > 0 && variant === 'app' && (
        <p className="text-sm text-slate-300 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
          {hiddenMine === 1
            ? 'Une de vos ressources est cachée. Elle reste dans Mon compte.'
            : `${hiddenMine} de vos ressources sont cachées. Elles restent dans Mon compte.`}
        </p>
      )}

      <label className="block">
        <span className="text-sm text-slate-300">Que cherchez-vous ?</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setKind('')} className={`shrink-0 px-3 py-1.5 rounded-full text-sm border ${kind === '' ? 'border-violet-400 text-violet-200' : 'border-slate-700 text-slate-300'}`}>
          Tout
        </button>
        {RESOURCE_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm border ${kind === k.id ? 'border-violet-400 text-violet-200' : 'border-slate-700 text-slate-300'}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && cards.length === 0 && <p className="text-sm text-slate-500">Chargement…</p>}
      {!loading && visible.length === 0 && (
        <p className="text-sm text-slate-500">
          {query || kind ? 'Aucune ressource pour cette recherche.' : 'Aucune ressource pour le moment.'}
        </p>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.map((card) => (
          <li key={card.id}>
            <button type="button" onClick={() => void openCard(card)} className="w-full text-left rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              {card.has_cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resourceMediaUrl(card.id, 'cover')} alt="" className="w-full h-36 object-cover bg-slate-950" />
              ) : (
                <div className="h-24 bg-slate-950/80" />
              )}
              <div className="p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-[0.16em] text-violet-300">{resourceKindMeta(card.kind).label}</p>
                <p className="font-medium text-slate-100">{card.title}</p>
                <p className="text-xs text-slate-400">
                  {card.author_avatar_emoji} {card.author_pseudo}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {open && <ResourceReader resource={open} onClose={() => setOpen(null)} />}
      {composing && (
        <ResourceComposer
          host="resources"
          onClose={() => setComposing(false)}
          onSaved={() => {
            setComposing(false)
            void load()
          }}
        />
      )}
    </div>
  )
}
