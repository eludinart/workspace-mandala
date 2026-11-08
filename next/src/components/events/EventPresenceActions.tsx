'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { calendarApi } from '@/api/calendar'
import { useAuth } from '@/contexts/AuthContext'
import { enumerateEventDays } from '@/lib/event-dates'
import { ApiError } from '@/lib/api-client'

type DayRes = {
  detail?: {
    present_users?: Array<{ user_id: number }>
    is_disabled?: boolean
  }
  settings?: { show_presence?: boolean }
}

export function EventPresenceActions({
  hostSlug,
  startsAt,
  endsAt,
  viaFriendPlace,
  hostName,
  hostAccentColor,
  variant = 'block',
}: {
  hostSlug: string | null | undefined
  startsAt: string | null | undefined
  endsAt: string | null | undefined
  viaFriendPlace?: boolean
  hostName?: string | null
  hostAccentColor?: string | null
  variant?: 'block' | 'inline'
}) {
  const { user } = useAuth()
  const myId = Number((user as { id?: number | string } | null)?.id ?? 0)
  const eventDays = useMemo(
    () => enumerateEventDays(startsAt ?? null, endsAt ?? null),
    [startsAt, endsAt]
  )

  const [ready, setReady] = useState(false)
  const [showPresence, setShowPresence] = useState(true)
  const [iAmPresent, setIAmPresent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!hostSlug || eventDays.length === 0 || myId <= 0) {
      setReady(false)
      setIAmPresent(false)
      return
    }
    setMsg(null)
    try {
      const daysToCheck = eventDays.slice(0, 14)
      const results = await Promise.all(
        daysToCheck.map((day) => calendarApi.day(hostSlug, day) as Promise<DayRes>)
      )
      const firstSettings = results[0]?.settings?.show_presence
      setShowPresence(firstSettings !== false)

      const openDays = results.filter((r) => !r.detail?.is_disabled)
      const targets = openDays.length > 0 ? openDays : results
      const allPresent = targets.every((r) =>
        (r.detail?.present_users ?? []).some((u) => u.user_id === myId)
      )
      setIAmPresent(allPresent)
      setReady(true)
    } catch {
      setReady(false)
      setIAmPresent(false)
    }
  }, [hostSlug, eventDays, myId])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async () => {
    if (!hostSlug || eventDays.length === 0) return
    setBusy(true)
    setMsg(null)
    const next = !iAmPresent
    try {
      if (eventDays.length === 1) {
        await calendarApi.setPresence({
          community_slug: hostSlug,
          day: eventDays[0],
          present: next,
        })
      } else {
        const res = (await calendarApi.setPresenceDays({
          community_slug: hostSlug,
          days: eventDays,
          present: next,
        })) as { applied?: string[]; skipped?: Array<{ day: string; reason: string }> }
        if (next) {
          const applied = res.applied?.length ?? 0
          const skipped = res.skipped?.length ?? 0
          if (applied === 0 && skipped > 0) {
            setMsg('Aucun jour ouvert ou place disponible sur ces dates.')
            return
          }
          if (skipped > 0) {
            setMsg(
              `Inscrit sur ${applied} jour${applied > 1 ? 's' : ''} · ${skipped} fermé${skipped > 1 ? 's' : ''} ou complet${skipped > 1 ? 's' : ''}.`
            )
          }
        }
      }
      setIAmPresent(next)
      await load()
    } catch (e: unknown) {
      setMsg(e instanceof ApiError ? e.detail : 'Inscription impossible')
    } finally {
      setBusy(false)
    }
  }

  if (!hostSlug || eventDays.length === 0 || myId <= 0 || !ready || !showPresence) {
    return null
  }

  const label =
    eventDays.length > 1
      ? iAmPresent
        ? 'Annuler sur tous les jours'
        : 'Je viens sur tous les jours ouverts'
      : iAmPresent
        ? 'Annuler'
        : 'Je viens'

  return (
    <div className={variant === 'block' ? 'space-y-2' : 'space-y-1.5'}>
      {viaFriendPlace && hostName && (
        <p className="text-xs text-slate-500">
          Date ouverte par{' '}
          <span style={{ color: hostAccentColor || undefined }}>{hostName}</span>
        </p>
      )}
      {!viaFriendPlace && eventDays.length > 1 && (
        <p className="text-xs text-slate-500">
          Présence sur les jours de l’événement (agenda du lieu).
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className={`w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 ${
          iAmPresent
            ? 'border border-emerald-500/40 text-emerald-200 bg-emerald-950/30 hover:bg-emerald-950/45'
            : 'border border-violet-500/50 text-violet-100 hover:bg-violet-900/30'
        }`}
      >
        {busy ? '…' : label}
      </button>
      {msg && <p className="text-xs text-amber-300/90 text-center">{msg}</p>}
    </div>
  )
}
