'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import {
  FEATURE_DOOR_AUDIENCES,
  type FeatureDoorAudience,
  type FeatureDoorKey,
} from '@/lib/feature-door-constants'

type Door = {
  feature_key: FeatureDoorKey
  label: string
  audience: FeatureDoorAudience
  named_user_ids: number[]
  updated_at: string | null
}

const AUDIENCE_LABELS: Record<FeatureDoorAudience, string> = {
  administrateurs: 'Administrateurs seulement',
  gestionnaires: 'Gestionnaires de lieu (+ admins)',
  everyone: 'Tout le monde (connecté)',
}

export function AdminFeatureDoorsTab() {
  const [doors, setDoors] = useState<Door[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [namedDraft, setNamedDraft] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const data = (await api.get('/api/admin/feature-doors')) as { doors: Door[] }
      setDoors(data.doors ?? [])
      const drafts: Record<string, string> = {}
      for (const d of data.doors ?? []) {
        drafts[d.feature_key] = (d.named_user_ids ?? []).join(', ')
      }
      setNamedDraft(drafts)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(door: Door, audience: FeatureDoorAudience) {
    setSavingKey(door.feature_key)
    setMsg(null)
    setErr(null)
    const raw = namedDraft[door.feature_key] ?? ''
    const named_user_ids = raw
      .split(/[\s,;]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)

    try {
      await api.put('/api/admin/feature-doors', {
        feature_key: door.feature_key,
        audience,
        named_user_ids,
      })
      setMsg(`Porte « ${door.label} » enregistrée.`)
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Enregistrement impossible')
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Chargement des portes…</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Chaque fonction de la suite reste invisible tant que sa porte n’est pas ouverte au
        public voulu. Les administrateurs d’application passent toujours. Les personnes
        nommées (IDs utilisateur) s’ajoutent à l’audience.
      </p>
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      {err && <p className="text-sm text-rose-400">{err}</p>}

      <ul className="space-y-4">
        {doors.map((door) => (
          <li
            key={door.feature_key}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3"
          >
            <div>
              <h3 className="text-sm font-semibold text-slate-100">{door.label}</h3>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">{door.feature_key}</p>
            </div>
            <label className="block text-xs text-slate-400">
              Public
              <select
                value={door.audience}
                disabled={savingKey === door.feature_key}
                onChange={(e) => {
                  const audience = e.target.value as FeatureDoorAudience
                  setDoors((prev) =>
                    prev.map((d) =>
                      d.feature_key === door.feature_key ? { ...d, audience } : d
                    )
                  )
                }}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
              >
                {FEATURE_DOOR_AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_LABELS[a]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Personnes nommées (IDs, séparés par des virgules)
              <input
                value={namedDraft[door.feature_key] ?? ''}
                onChange={(e) =>
                  setNamedDraft((prev) => ({
                    ...prev,
                    [door.feature_key]: e.target.value,
                  }))
                }
                placeholder="ex. 12, 45"
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <button
              type="button"
              disabled={savingKey === door.feature_key}
              onClick={() => void save(door, door.audience)}
              className="text-sm px-3 py-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-40"
            >
              {savingKey === door.feature_key ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
