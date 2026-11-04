'use client'

import { useCallback, useEffect, useState } from 'react'
import { weatherApi } from '@/api/weather'
import { useCommunity } from '@/contexts/CommunityContext'
import { ApiError } from '@/lib/api-client'
import { WEATHER_OPTIONS, type WeatherStatus } from '@/lib/weather-status'

const SESSION_HIDE_KEY = 'mdl_weather_home_invite_hidden'

function isHiddenThisSession(communityId: number): boolean {
  try {
    return sessionStorage.getItem(`${SESSION_HIDE_KEY}:${communityId}`) === '1'
  } catch {
    return false
  }
}

function hideThisSession(communityId: number): void {
  try {
    sessionStorage.setItem(`${SESSION_HIDE_KEY}:${communityId}`, '1')
  } catch {
    /* ignore */
  }
}

/** Invitation discrète Accueil : visible seulement si aucune météo du jour. */
export function HeartWeatherHomeCard() {
  const { active } = useCommunity()
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!active?.id) {
      setReady(true)
      setVisible(false)
      return
    }
    if (isHiddenThisSession(active.id)) {
      setReady(true)
      setVisible(false)
      return
    }
    try {
      const res = await weatherApi.get(active.id)
      setVisible(!res.weather?.status)
    } catch {
      setVisible(false)
    } finally {
      setReady(true)
    }
  }, [active?.id])

  useEffect(() => {
    setReady(false)
    void load()
  }, [load])

  const dismiss = () => {
    if (!active?.id) return
    hideThisSession(active.id)
    setVisible(false)
  }

  const pick = async (next: WeatherStatus) => {
    if (!active?.id) return
    setSaving(true)
    setErr(null)
    try {
      await weatherApi.update({
        community_id: active.id,
        weather_status: next,
        weather_note: note.trim() || undefined,
      })
      setVisible(false)
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (!active || !ready || !visible) return null

  return (
    <section
      className="mx-4 sm:mx-6 lg:mx-8 mt-6 rounded-2xl border border-violet-500/25 bg-violet-950/20 px-4 py-3.5 space-y-3"
      aria-label="Météo des Cœurs"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-100">Comment va ton cœur aujourd’hui ?</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Un mot discret pour {active.name}. Tu pourras le modifier dans Membres.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-xs text-slate-500 hover:text-slate-300"
        >
          Plus tard
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {WEATHER_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={saving}
            onClick={() => void pick(o.id)}
            title={o.label}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:border-violet-500/50 hover:bg-violet-950/40 transition-colors disabled:opacity-60"
          >
            <span className={`w-2 h-2 rounded-full ${o.dotClass}`} aria-hidden />
            <span>{o.emoji}</span>
            <span className="text-xs hidden sm:inline">{o.label}</span>
          </button>
        ))}
      </div>
      <label className="block text-xs text-slate-500">
        <span className="sr-only">Note courte optionnelle</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 100))}
          maxLength={100}
          placeholder="Un mot sur ta journée… (optionnel)"
          className="w-full rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
        />
      </label>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </section>
  )
}
