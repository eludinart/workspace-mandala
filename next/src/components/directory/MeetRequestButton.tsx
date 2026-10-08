'use client'

import { useCallback, useEffect, useState } from 'react'
import { directoryApi, type MeetStatus } from '@/api/directory'
import { ApiError } from '@/lib/api-client'

export function MeetRequestButton({
  userId,
  onOpenConversation,
  onOpenAlerts,
}: {
  userId: number
  onOpenConversation?: (channelId: number) => void
  onOpenAlerts?: () => void
}) {
  const [status, setStatus] = useState<MeetStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setStatus(await directoryApi.meetStatus(userId))
    } catch {
      setStatus({ mode: 'none' })
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const next = await directoryApi.requestMeet(userId)
      setStatus(next)
      if (next.mode === 'conversation' && next.channel_id) onOpenConversation?.(next.channel_id)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Envoi impossible')
    } finally {
      setBusy(false)
    }
  }

  const respond = async (accept: boolean) => {
    if (!status?.request_id) return
    setBusy(true)
    setError(null)
    try {
      const next = await directoryApi.respondMeet(status.request_id, accept)
      setStatus(next)
      if (accept && next.channel_id) onOpenConversation?.(next.channel_id)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Réponse impossible')
    } finally {
      setBusy(false)
    }
  }

  const mode = status?.mode ?? 'none'

  return (
    <div className="space-y-2">
      {mode === 'conversation' && (
        <button
          type="button"
          onClick={() => status?.channel_id && onOpenConversation?.(status.channel_id)}
          className="text-sm px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
        >
          Ouvrir la conversation
        </button>
      )}
      {mode === 'pending' && (
        <p className="text-sm text-slate-400">Demande envoyée. La conversation s’ouvre si la personne accepte.</p>
      )}
      {mode === 'incoming' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void respond(true)}
            className="text-sm px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Accepter
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void respond(false)}
            className="text-sm px-4 py-2.5 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Refuser
          </button>
        </div>
      )}
      {(mode === 'none' || mode === 'shared') && (
        <button
          type="button"
          disabled={busy || status == null}
          onClick={() => void send()}
          className="text-sm px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {busy ? 'Envoi…' : 'Souhaiter se rencontrer'}
        </button>
      )}
      {mode === 'incoming' && onOpenAlerts && (
        <button type="button" onClick={onOpenAlerts} className="block text-xs text-violet-300 hover:text-violet-200">
          Voir l’alerte
        </button>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
