'use client'

import { useCallback, useEffect, useState } from 'react'
import { resourcesApi, resourceMediaUrl, type ResourceCard, type ResourceDetail } from '@/api/resources'
import { ResourceComposer } from '@/components/resources/ResourceComposer'
import { ApiError } from '@/lib/api-client'
import { resourceKindMeta } from '@/lib/resource-constants'

const SCOPE_LABEL = { hidden: 'Cachée', places: 'Mes lieux', mandala: 'Tout Mandala' } as const

export function MyResourcesSection() {
  const [cards, setCards] = useState<ResourceCard[]>([])
  const [editing, setEditing] = useState<ResourceDetail | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await resourcesApi.mine()
      setCards(res.cards ?? [])
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Impossible de charger vos ressources')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function edit(card: ResourceCard) {
    setError(null)
    try {
      const res = await resourcesApi.get(card.id)
      setEditing(res.resource)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Ouverture impossible')
    }
  }

  async function remove(card: ResourceCard) {
    if (!window.confirm(`Retirer « ${card.title} » ? Le fichier sera effacé.`)) return
    try {
      await resourcesApi.remove(card.id)
      setCards((prev) => prev.filter((c) => c.id !== card.id))
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Suppression impossible')
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Recettes, textes, vidéos, audios et documents que vous partagez.</p>
        <button type="button" onClick={() => setCreating(true)} className="shrink-0 px-3 py-2 rounded-lg bg-violet-600 text-sm">
          Ajouter
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {cards.length === 0 && <p className="text-sm text-slate-500">Aucune ressource pour le moment.</p>}
      <ul className="space-y-2">
        {cards.map((card) => (
          <li key={card.id} className="flex gap-3 items-center rounded-lg border border-slate-800 bg-slate-950/40 p-2">
            {card.has_cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resourceMediaUrl(card.id, 'cover')} alt="" className="w-14 h-14 rounded-lg object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-slate-900" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-100 truncate">{card.title}</p>
              <p className="text-xs text-slate-500">
                {resourceKindMeta(card.kind).label} · {SCOPE_LABEL[card.scope]}
                {card.downloadable ? ' · téléchargeable' : ''}
              </p>
            </div>
            <button type="button" className="text-xs text-violet-300" onClick={() => void edit(card)}>
              Modifier
            </button>
            <button type="button" className="text-xs text-red-300" onClick={() => void remove(card)}>
              Retirer
            </button>
          </li>
        ))}
      </ul>
      {(creating || editing) && (
        <ResourceComposer
          host="account"
          editing={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
