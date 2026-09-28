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
import { formatChatListTime } from '@/lib/format-datetime'

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
  lastMessage?: string | null
  lastMessageAt?: string | null
}

type PendingSeed = {
  id: number
  from_user_id: number
  from_pseudo?: string
  from_avatar?: string | null
  from_avatar_emoji?: string
  intention_id: string
}

export function MessagesPage({
  openWithUserId,
  openWithChannelId,
  openCommunitySlug,
  onLeave,
  onOpenChannel,
}: {
  openWithUserId?: string | null
  openWithChannelId?: string | null
  openCommunitySlug?: string | null
  onLeave?: () => void
  onOpenChannel?: (channelId: number | null) => void
}) {
  const { active, setActiveSlug } = useCommunity()
  const { user } = useAuth()
  const fetchClairiereUnread = useSocialStore((s) => s.fetchClairiereUnread)
  const [channels, setChannels] = useState<Channel[]>([])
  const [pending, setPending] = useState<PendingSeed[]>([])
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [listTab, setListTab] = useState<'dialogues' | 'members'>('dialogues')
  const openedForRef = useRef<string | null>(null)
  const openedChannelRef = useRef<string | null>(null)

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
    if (openCommunitySlug && active?.slug !== openCommunitySlug) {
      setActiveSlug(openCommunitySlug)
    }
  }, [openCommunitySlug, active?.slug, setActiveSlug])

  useEffect(() => {
    if (!openWithUserId) {
      openedForRef.current = null
      return
    }
    if (!active?.slug) return
    if (openCommunitySlug && active.slug !== openCommunitySlug) return
    if (openedForRef.current === openWithUserId) return
    openedForRef.current = openWithUserId

    const openForUser = async () => {
      try {
        const list = await loadChannels()
        const existing = list.find((c) => String(c.otherUserId) === String(openWithUserId))
        if (existing) {
          setSelectedId(existing.channelId)
          onOpenChannel?.(existing.channelId)
          return
        }
        const res = await socialApi.openChannel(Number(openWithUserId), active.slug)
        setSelectedId(res.channelId)
        onOpenChannel?.(res.channelId)
        await loadChannels()
      } catch (e: unknown) {
        setError(e instanceof ApiError ? e.detail : 'Impossible d\'ouvrir la conversation')
      }
    }
    void openForUser()
  }, [openWithUserId, openCommunitySlug, active?.slug, loadChannels, onOpenChannel])

  useEffect(() => {
    if (openWithChannelId) return
    setSelectedId(null)
  }, [openWithChannelId])

  useEffect(() => {
    if (!openWithChannelId) {
      openedChannelRef.current = null
      return
    }
    if (openCommunitySlug && active?.slug !== openCommunitySlug) {
      setActiveSlug(openCommunitySlug)
      return
    }
    if (!active?.slug) return

    const openKey = `${openWithChannelId}:${active.slug}`
    if (openedChannelRef.current === openKey) return
    openedChannelRef.current = openKey

    const openForChannel = async () => {
      try {
        const channelId = Number(openWithChannelId)
        if (!channelId) return
        const list = await loadChannels()
        const existing = list.find((c) => c.channelId === channelId)
        if (existing) {
          setSelectedId(channelId)
          onOpenChannel?.(channelId)
          return
        }
        const ctx = await socialApi.getChannelContext(channelId)
        if (ctx.communitySlug && active.slug !== ctx.communitySlug) {
          openedChannelRef.current = null
          setActiveSlug(ctx.communitySlug)
          return
        }
        if (ctx.otherUserId && ctx.channelType === 'direct') {
          const res = await socialApi.openChannel(ctx.otherUserId, active.slug)
          setSelectedId(res.channelId)
          onOpenChannel?.(res.channelId)
        } else {
          setSelectedId(channelId)
          onOpenChannel?.(channelId)
        }
        await loadChannels()
      } catch (e: unknown) {
        openedChannelRef.current = null
        setError(e instanceof ApiError ? e.detail : 'Impossible d\'ouvrir la conversation')
      }
    }
    void openForChannel()
  }, [openWithChannelId, openCommunitySlug, active?.slug, loadChannels, setActiveSlug, onOpenChannel])

  const acceptSeed = async (seedId: number) => {
    try {
      const res = (await socialApi.acceptConnection(String(seedId))) as { channelId?: number }
      setMsg('Connexion acceptée')
      if (res.channelId) {
        setSelectedId(res.channelId)
        onOpenChannel?.(res.channelId)
      }
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
    setListTab('dialogues')
    setSelectedId(channelId)
    onOpenChannel?.(channelId)
    void loadChannels()
  }

  const closeDialogue = () => {
    const st = window.history.state as { mdl?: boolean; channelId?: string | null } | null
    if (st?.mdl && st.channelId) {
      window.history.back()
      return
    }
    setSelectedId(null)
    onOpenChannel?.(null)
  }

  const visibleChannels = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return channels
    return channels.filter((c) => c.otherPseudo.toLowerCase().includes(q))
  }, [channels, query])

  const chatOpen = selectedId != null

  return (
    <div className="relative flex-1 min-h-0 min-w-0 w-full flex flex-col overflow-hidden bg-slate-950">
      {(error || msg) && (
        <p className={`shrink-0 px-4 py-2 text-sm ${error ? 'text-red-400' : 'text-emerald-400'}`}>{error || msg}</p>
      )}

      <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden">
        <section
          className={`${
            chatOpen && listTab !== 'members' ? 'hidden lg:flex' : 'flex'
          } flex-col w-full lg:w-[340px] xl:w-[380px] lg:shrink-0 lg:border-r border-slate-800 min-h-0 bg-slate-950`}
        >
          <header className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-2 pt-2 pb-1 border-b border-slate-800">
            <button
              type="button"
              onClick={onLeave}
              className="justify-self-start inline-flex items-center gap-0.5 min-h-[44px] pl-1 pr-2 rounded-full text-violet-400 hover:bg-slate-800/80"
              aria-label="Retour à Mandala"
            >
              <ChevronLeftIcon />
              <span className="text-sm font-medium">Mandala</span>
            </button>
            <div className="text-center min-w-0 px-1">
              <h1 className="font-serif text-[1.35rem] leading-none text-slate-100">Messages</h1>
              {active?.name && (
                <p className="text-[11px] text-slate-500 truncate max-w-[9rem] mx-auto mt-0.5">{active.name}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setListTab('members')}
              className="justify-self-end inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-violet-400 hover:bg-slate-800/80"
              aria-label="Membres du lieu"
            >
              <ComposeIcon />
            </button>
          </header>

          <div
            className="shrink-0 mx-3 mt-2 flex rounded-xl border border-slate-800 bg-slate-900/40 p-1 gap-1"
            role="tablist"
            aria-label="Conversations et membres"
          >
            <button
              type="button"
              role="tab"
              aria-selected={listTab === 'dialogues'}
              onClick={() => setListTab('dialogues')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                listTab === 'dialogues' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Conversations
              {channels.some((c) => c.unreadCount > 0) && (
                <span className="ml-1.5 text-[10px]" aria-hidden>●</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={listTab === 'members'}
              onClick={() => setListTab('members')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                listTab === 'members' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Membres
            </button>
          </div>

          {listTab === 'members' ? (
            <div className="flex-1 min-h-0 mt-2">
              <ConversationMemberSidebar
                embedded
                className="border-0 rounded-none bg-transparent"
                onChannelOpened={handleChannelOpened}
                highlightUserId={openWithUserId}
              />
            </div>
          ) : (
          <>
          <div className="shrink-0 px-3 py-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher"
              aria-label="Rechercher une conversation"
              className="w-full rounded-full bg-slate-900 border border-slate-800 px-4 py-2 text-sm text-slate-100 placeholder-slate-500"
            />
          </div>

          {pending.length > 0 && (
            <section className="shrink-0 mx-3 mb-2 rounded-2xl border border-amber-700/40 bg-amber-950/30 px-3 py-2 space-y-2">
              <h2 className="text-xs font-semibold text-amber-200">Graines reçues ({pending.length})</h2>
              {pending.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <UserAvatar avatar={s.from_avatar} avatarEmoji={s.from_avatar_emoji} size="sm" />
                  <span className="text-sm truncate flex-1 min-w-0">
                    {s.from_pseudo ?? `Jardinier #${s.from_user_id}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => void acceptSeed(s.id)}
                    className="text-xs px-2 py-1 rounded-full bg-emerald-700 text-white"
                  >
                    Accepter
                  </button>
                  <button
                    type="button"
                    onClick={() => void rejectSeed(s.id)}
                    className="text-xs px-2 py-1 rounded-full text-slate-400"
                    aria-label="Refuser"
                  >
                    Refuser
                  </button>
                </div>
              ))}
            </section>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading && channels.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-10">Chargement…</p>
            )}
            {!loading && !error && channels.length === 0 && (
              <div className="px-6 py-12 text-center">
                <p className="font-serif text-xl text-slate-200">Aucune conversation</p>
                <p className="text-sm text-slate-500 mt-2">
                  Écrivez à un membre du lieu pour commencer.
                </p>
                <button
                  type="button"
                  onClick={() => setListTab('members')}
                  className="mt-4 px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-500"
                >
                  Choisir des membres
                </button>
              </div>
            )}
            {!loading && channels.length > 0 && visibleChannels.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-10">Aucun résultat</p>
            )}
            {visibleChannels.map((ch) => {
              const activeRow = selectedId === ch.channelId
              const preview =
                ch.lastMessage ||
                (ch.channelType === 'group'
                  ? `${ch.memberCount ?? 0} participants`
                  : ch.otherIsOnline
                    ? 'En ligne'
                    : 'Aucun message')
              return (
                <button
                  key={ch.channelId}
                  type="button"
                  onClick={() => {
                    setSelectedId(ch.channelId)
                    onOpenChannel?.(ch.channelId)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-slate-800/70 ${
                    activeRow ? 'bg-slate-800/80' : 'hover:bg-slate-900/80'
                  }`}
                >
                  <span className="relative shrink-0">
                    <UserAvatar
                      avatar={ch.otherAvatar}
                      avatarEmoji={ch.otherAvatarEmoji}
                      size="md"
                      alt={ch.otherPseudo}
                    />
                    {ch.channelType === 'direct' && ch.otherIsOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-[15px] ${
                          ch.unreadCount > 0 ? 'font-semibold text-slate-50' : 'font-medium text-slate-100'
                        }`}
                      >
                        {ch.otherPseudo}
                      </span>
                      {ch.lastMessageAt && (
                        <span
                          className={`shrink-0 text-[11px] ${
                            ch.unreadCount > 0 ? 'text-violet-400' : 'text-slate-500'
                          }`}
                        >
                          {formatChatListTime(ch.lastMessageAt)}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm ${
                          ch.unreadCount > 0 ? 'text-slate-200' : 'text-slate-500'
                        }`}
                      >
                        {preview}
                      </span>
                      {ch.unreadCount > 0 && (
                        <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-violet-600 text-[11px] font-semibold text-white inline-flex items-center justify-center">
                          {ch.unreadCount > 99 ? '99+' : ch.unreadCount}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          </>
          )}
        </section>

        <section
          className={`${
            listTab === 'members' ? 'hidden lg:flex' : chatOpen ? 'flex' : 'hidden lg:flex'
          } flex-1 min-h-0 min-w-0 flex-col bg-slate-950`}
        >
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
              communityMembers={members}
              onGroupRenamed={() => void loadChannels()}
              onGroupMembersChanged={() => void loadChannels()}
              onBack={closeDialogue}
            />
          ) : (
            <div className="m-chat-wallpaper flex-1 flex flex-col items-center justify-center text-center px-8">
              <p className="font-serif text-3xl text-slate-200">Messages</p>
              <p className="mt-2 max-w-sm text-sm text-slate-400">
                Choisissez une conversation pour écrire, sans quitter cet écran.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 5.5 8.5 12l6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ComposeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m13.5 6.5 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
