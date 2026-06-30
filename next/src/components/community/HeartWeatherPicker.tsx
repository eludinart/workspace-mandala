'use client'

import { useCallback, useEffect, useState } from 'react'
import { weatherApi } from '@/api/weather'
import { useCommunity } from '@/contexts/CommunityContext'
import { ApiError } from '@/lib/api-client'
import {
  WEATHER_OPTIONS,
  type WeatherStatus,
  weatherOption,
} from '@/lib/weather-status'

export function HeartWeatherPicker() {
  const { active } = useCommunity()
  const [status, setStatus] = useState<WeatherStatus | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!active?.id) return
    setLoading(true)
    try {
      const res = await weatherApi.get(active.id)
      setStatus(res.weather?.status ?? null)
      setNote(res.weather?.note ?? '')
    } catch {
      setStatus(null)
      setNote('')
    } finally {
      setLoading(false)
    }
  }, [active?.id])

  useEffect(() => {
    void load()
  }, [load])

  const pick = async (next: WeatherStatus) => {
    if (!active?.id) return
    setSaving(true)
    setMsg(null)
    setErr(null)
    try {
      const res = await weatherApi.update({
        community_id: active.id,
        weather_status: next,
        weather_note: note.trim() || undefined,
      })
      setStatus(res.weather.status)
      setNote(res.weather.note)
      setMsg('Météo mise à jour')
      setTimeout(() => setMsg(null), 2000)
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const saveNote = async () => {
    if (!active?.id || !status) return
    await pick(status)
  }

  if (!active) {
    return (
      <p className="text-xs text-slate-500">Sélectionnez une communauté pour partager votre météo.</p>
    )
  }

  const current = weatherOption(status)

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-200">La Météo des Cœurs</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Votre état du jour dans <span className="text-violet-300">{active.name}</span>
        </p>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Chargement…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {WEATHER_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={saving}
                onClick={() => void pick(o.id)}
                title={o.label}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  status === o.id
                    ? 'border-violet-500/60 bg-violet-950/50 text-violet-100'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${o.dotClass}`} aria-hidden />
                <span>{o.emoji}</span>
                <span className="text-xs hidden sm:inline">{o.label}</span>
              </button>
            ))}
          </div>
          {current && (
            <p className="text-xs text-slate-400">
              Actuel : {current.emoji} {current.label}
            </p>
          )}
          <label className="block text-xs text-slate-500">
            Note courte (optionnel, 100 car.)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 100))}
              maxLength={100}
              placeholder="Un mot sur votre journée…"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-sm"
            />
          </label>
          {status && note.trim() && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveNote()}
              className="text-xs text-violet-300 hover:underline"
            >
              Enregistrer la note
            </button>
          )}
        </>
      )}
      {msg && <p className="text-xs text-emerald-400">{msg}</p>}
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  )
}
