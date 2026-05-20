'use client'

import { useCallback, useEffect, useState } from 'react'
import { socialApi } from '@/api/social'
import { DialogueStream } from '@/components/social/DialogueStream'
import { useCommunity } from '@/contexts/CommunityContext'
import { useSocialStore } from '@/store/useSocialStore'
import { ApiError } from '@/lib/api-client'
import { UserAvatar } from '@/components/UserAvatar'

type Channel = {
  channelId: number
  otherUserId: number
  otherPseudo: string
  otherAvatar?: string | null
  otherAvatarEmoji?: string
  otherIsOnline: boolean
  unreadCount: number
}

type PendingSeed = {
  id: number
  from_user_id: number
  from_pseudo?: string
  from_avatar?: string | null
  from_avatar_emoji?: string
  intention_id: string
}

export function MessagesPage({ openWithUserId }: { openWithUserId?: string | null }) {
  const { active } = useCommunity()
  const fetchClairiereUnread = useSocialStore((s) => s.fetchClairiereUnread)
  const [channels, setChannels] = useState<Channel[]>([])
  const [pending, setPending] = useState<PendingSeed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const loadChannels = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [chData, seedsData] = await Promise.all([
        socialApi.getMyChannels() as Promise<{ channels?: Channel[] }>,
        socialApi.pendingSeedsIncoming({ limit: 20 }) as Promise<{ items?: PendingSeed[] }>,
      ])
      const list = chData?.channels ?? []
      setChannels(list)
      setPending(seedsData?.items ?? [])
      if (openWithUserId) {
        const ch = list.find((c) => String(c.otherUserId) === String(openWithUserId))
        if (ch) setSelectedId(ch.channelId)
      }
      void fetchClairiereUnread()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
      setChannels([])
    } finally {
      setLoading(false)
    }
  }, [openWithUserId, fetchClairiereUnread])

  useEffect(() => {
    void loadChannels()
    const t = setInterval(() => void loadChannels(), 60000)
    return () => clearInterval(t)
  }, [loadChannels, active?.slug])

  const acceptSeed = async (seedId: number) => {
    try {
      const res = (await socialApi.acceptConnection(String(seedId))) as { channelId?: number }
      setMsg('Connexion acceptée')
      if (res.channelId) setSelectedId(res.channelId)
      void loadChannels()
    } catch (e: unknown) {
      setMsg(e instanceof ApiError ? e.detail : 'Erreur')
    }
  }

  const rejectSeed = async (seedId: number) => {
    try {
      await socialApi.rejectConnection(String(seedId))
      void loadChannels()
    } catch (e: unknown) {
      setMsg(e instanceof ApiError ? e.detail : 'Erreur')
    }
  }

  const selected = channels.find((c) => c.channelId === selectedId)

  if (selectedId && selected) {
    return (
      <div className="max-w-2xl h-full flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="text-sm text-violet-400 hover:underline w-fit"
        >
          ← Retour aux dialogues
        </button>
        <DialogueStream
          channelId={selectedId}
          otherPseudo={selected.otherPseudo}
          otherAvatar={selected.otherAvatar}
          otherAvatarEmoji={selected.otherAvatarEmoji}
          otherIsOnline={selected.otherIsOnline}
        />
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-slate-400 text-sm mt-1">
          La Clairière — dialogues pour <strong className="text-slate-200">{active?.name}</strong>
        </p>
      </div>

      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      {loading && <p className="text-slate-400 text-sm">Chargement…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {pending.length > 0 && (
        <section className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-amber-200">Graines reçues ({pending.length})</h2>
          {pending.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-amber-900/30 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar
                  avatar={s.from_avatar}
                  avatarEmoji={s.from_avatar_emoji}
                  size="sm"
                />
                <span className="text-sm truncate">
                  {s.from_pseudo ?? `Jardinier #${s.from_user_id}`} — {s.intention_id}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void acceptSeed(s.id)}
                  className="text-xs px-2 py-1 rounded bg-emerald-700 text-white"
                >
                  Accepter
                </button>
                <button
                  type="button"
                  onClick={() => void rejectSeed(s.id)}
                  className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-400"
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {!loading && channels.length === 0 && pending.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-6 space-y-2 text-center text-slate-500 text-sm">
          <p>Aucun dialogue actif.</p>
          <p>
            Allez sur <strong className="text-slate-300">Membres</strong>, déposez une graine 🌱 ou
            acceptez une demande ci-dessus pour démarrer un échange.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {channels.map((ch) => (
          <li key={ch.channelId}>
            <button
              type="button"
              onClick={() => setSelectedId(ch.channelId)}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-violet-500/40 text-left"
            >
              <UserAvatar
                avatar={ch.otherAvatar}
                avatarEmoji={ch.otherAvatarEmoji}
                size="md"
                alt={ch.otherPseudo}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${ch.otherIsOnline ? 'bg-emerald-500' : 'bg-slate-500'}`}
                  />
                  {ch.otherPseudo}
                </p>
              </div>
              {ch.unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-violet-600 text-xs text-white">
                  {ch.unreadCount}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}