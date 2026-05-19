'use client'

import { useCallback, useEffect, useState } from 'react'
import { prairieApi } from '@/api/prairie'
import { useCommunity } from '@/contexts/CommunityContext'

type Fleur = { user_id: string; pseudo: string; avatar_emoji?: string }

export function MembersPage() {
  const { active } = useCommunity()
  const [items, setItems] = useState<Fleur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = (await prairieApi.getFleurs()) as { fleurs?: Fleur[] }
      setItems(data?.fleurs ?? [])
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Impossible de charger les membres')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, active?.slug])

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Membres — {active?.name}</h1>
        <button
          type="button"
          onClick={() => void load()}
          className="text-sm px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800"
        >
          Rafraîchir
        </button>
      </div>
      {loading && <p className="text-slate-400 text-sm">Chargement…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-slate-500 text-sm italic">Aucun membre visible pour l&apos;instant.</p>
      )}
      <ul className="grid sm:grid-cols-2 gap-3">
        {items.map((m) => (
          <li
            key={m.user_id}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex items-center gap-3"
          >
            <span className="text-2xl">{m.avatar_emoji ?? '🌸'}</span>
            <div>
              <p className="font-medium">{m.pseudo}</p>
              <p className="text-[10px] text-slate-500">#{m.user_id}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
