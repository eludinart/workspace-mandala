'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { socialApi } from '@/api/social'
import { DialogueStream } from '@/components/social/DialogueStream'
import { ConversationMemberSidebar } from '@/components/social/ConversationMemberSidebar'
import { useCommunity } from '@/contexts/CommunityContext'
import { useAuth } from '@/contexts/AuthContext'
import { useSocialStore } from '@/store/useSocialStore'
import { ApiError } from '@/lib/api-client'
import { UserAvatar } from '@/components/UserAvatar'
import { membersApi, type CommunityMember } from '@/api/members'

type Channel = {
  channelId: number
  channelType: 'direct' | 'group'
  otherUserId?: number
  otherPseudo: string
  otherAvatar?: string | null
  otherAvatarEmoji?: string
  otherIsOnline: boolean
  unreadCount: number
  memberCount?: number
  memberIds?: number[]
  createdBy?: number | null
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
  const { user } = useAuth()
  const fetchClairiereUnread = useSocialStore((s) => s.fetchClairiereUnread)
  const [channels, setChannels] = useState<Channel[]>([])
  const [pending, setPending] = useState<PendingSeed[]>([])
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const openedForRef = useRef<string | null>(null)

  const loadChannels = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const slug = active?.slug
      const [chData, seedsData, membersData] = await Promise.all([
        socialApi.getMyChannels(slug) as Promise<{ channels?: Channel[] }>,
        socialApi.pendingSeedsIncoming({ limit: 20 }) as Promise<{ items?: PendingSeed[] }>,
        slug
          ? (membersApi.listCommunity(slug) as Promise<{ members?: CommunityMember[] }>)
          : Promise.resolve({ members: [] }),
      ])
      const list = chData?.channels ?? []
      setChannels(list)
      setPending(seedsData?.items ?? [])
      setMembers(membersData?.members ?? [])
      void fetchClairiereUnread()
      return list
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
      setChannels([])
      return []
    } finally {
      setLoading(false)
    }
  }, [active?.slug, fetchClairiereUnread])

  useEffect(() => {
    void loadChannels()
    const t = setInterval(() => void loadChannels(), 60000)
    return () => clearInterval(t)
  }, [loadChannels])

  useEffect(() => {
    if (!openWithUserId || !active?.slug) return
    if (openedForRef.current === openWithUserId) return
    openedForRef.current = openWithUserId

    const openForUser = async () => {
      try {
        const list = await loadChannels()
        const existing = list.find((c) => String(c.otherUserId) === String(openWithUserId))
        if (existing) {
          setSelectedId(existing.channelId)
          return
        }
        const res = await socialApi.openChannel(Number(openWithUserId), active.slug)
        setSelectedId(res.channelId)
        await loadChannels()
      } catch (e: unknown) {
        setError(e instanceof ApiError ? e.detail : 'Impossible d\'ouvrir le dialogue')
      }
    }
    void openForUser()
  }, [openWithUserId, active?.slug, loadChannels])

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

  const participantsById = useMemo(() => {
    const map: Record<
      number,
      { pseudo: string; avatar: string | null; avatarEmoji: string }
    > = {}
    for (const m of members) {
      map[m.user_id] = {
        pseudo: m.pseudo,
        avatar: m.avatar,
        avatarEmoji: m.avatar_emoji,
      }
    }
    if (user?.id) {
      const me = members.find((m) => m.is_me)
      map[Number(user.id)] = {
        pseudo:
          me?.pseudo ??
          (typeof user.pseudo === 'string' ? user.pseudo : 'Moi'),
        avatar: me?.avatar ?? null,
        avatarEmoji: me?.avatar_emoji ?? '🌸',
      }
    }
    return map
  }, [members, user])

  const handleChannelOpened = (channelId: number) => {
    setSelectedId(channelId)
    void loadChannels()
  }

  return (
    <div className="h-full min-h-[min(70vh,720px)] flex flex-col gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Messages</h1>
        <p className="text-slate-400 text-sm mt-1">
          Conversations entre membres — <strong className="text-slate-200">{active?.name}</strong>
        </p>
      </div>

      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {pending.length > 0 && (
        <section className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 space-y-2 shrink-0">
          <h2 className="text-sm font-semibold text-amber-200">Graines reçues ({pending.length})</h2>
          {pending.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-amber-900/30 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar avatar={s.from_avatar} avatarEmoji={s.from_avatar_emoji} size="sm" />
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

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(200px,240px)_minmax(200px,260px)_1fr] gap-3">
        <div className="min-h-[220px] lg:min-h-0">
          <ConversationMemberSidebar
            onChannelOpened={handleChannelOpened}
            highlightUserId={openWithUserId}
          />
        </div>

        <section className="flex flex-col min-h-[200px] lg:min-h-0 border border-slate-800 rounded-xl bg-slate-900/30 overflow-hidden">
          <div className="shrink-0 px-3 py-2 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-200">Dialogues</h2>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
            {loading && <p className="text-slate-400 text-xs p-2">Chargement…</p>}
            {!loading && channels.length === 0 && (
              <p className="text-slate-500 text-xs p-2 text-center">
                Sélectionnez un ou plusieurs membres à gauche pour démarrer.
              </p>
            )}
            {channels.map((ch) => (
              <button
                key={ch.channelId}
                type="button"
                onClick={() => setSelectedId(ch.channelId)}
                className={`w-full flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
                  selectedId === ch.channelId
                    ? 'border-violet-500/50 bg-violet-950/30'
                    : 'border-slate-800 bg-slate-900/50 hover:border-violet-500/30'
                }`}
              >
                <UserAvatar
                  avatar={ch.otherAvatar}
                  avatarEmoji={ch.otherAvatarEmoji}
                  size="sm"
                  alt={ch.otherPseudo}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">
                    {ch.channelType === 'group' ? (
                      <span className="text-[10px] text-violet-400 shrink-0">👥</span>
                    ) : (
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${ch.otherIsOnline ? 'bg-emerald-500' : 'bg-slate-500'}`}
                      />
                    )}
                    {ch.otherPseudo}
                  </p>
                  {ch.channelType === 'group' && ch.memberCount && (
                    <p className="text-[10px] text-slate-500">{ch.memberCount} participants</p>
                  )}
                </div>
                {ch.unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-violet-600 text-[10px] text-white shrink-0">
                    {ch.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col min-h-[320px] lg:min-h-0">
          {selectedId && selected ? (
            <DialogueStream
              channelId={selectedId}
              otherPseudo={selected.otherPseudo}
              otherAvatar={selected.otherAvatar}
              otherAvatarEmoji={selected.otherAvatarEmoji}
              otherIsOnline={selected.otherIsOnline}
              isGroup={selected.channelType === 'group'}
              memberCount={selected.memberCount}
              memberIds={selected.memberIds ?? []}
              participantsById={participantsById}
              createdBy={selected.createdBy ?? null}
              onGroupRenamed={() => void loadChannels()}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-slate-700 text-slate-500 text-sm p-6 text-center">
              Choisissez un dialogue ou démarrez une conversation avec les membres du lieu.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
