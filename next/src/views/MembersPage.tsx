'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  membersApi,
  type MemberDirectoryCommunity,
  type MemberDirectoryEntry,
} from '@/api/members'
import { socialApi, INTENTIONS } from '@/api/social'
import { useCommunity } from '@/contexts/CommunityContext'
import { ApiError } from '@/lib/api-client'
import { UserAvatar } from '@/components/UserAvatar'

type CommunityMember = {
  user_id: number
  pseudo: string
  display_name: string
  avatar_emoji: string
  avatar: string | null
  profile_public: boolean
  is_me: boolean
  role?: string
}

type MemberCardData = CommunityMember | MemberDirectoryEntry

function sortMembersAz<T extends { pseudo?: string; display_name?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const av = String(a.pseudo ?? a.display_name ?? '')
    const bv = String(b.pseudo ?? b.display_name ?? '')
    return av.localeCompare(bv, 'fr', { sensitivity: 'base' })
  })
}

function isDirectoryMember(m: MemberCardData): m is MemberDirectoryEntry {
  return 'communities' in m && Array.isArray((m as MemberDirectoryEntry).communities)
}

export function MembersPage({ onOpenMessages }: { onOpenMessages?: (userId: string) => void }) {
  const { active } = useCommunity()
  const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [directoryMode, setDirectoryMode] = useState(false)
  const [directoryCommunities, setDirectoryCommunities] = useState<MemberDirectoryCommunity[]>([])
  const [directoryMembers, setDirectoryMembers] = useState<MemberDirectoryEntry[]>([])
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [directoryError, setDirectoryError] = useState<string | null>(null)
  const [filterCommunitySlug, setFilterCommunitySlug] = useState('')
  const [panelMember, setPanelMember] = useState<MemberDirectoryEntry | null>(null)

  const [seedTarget, setSeedTarget] = useState<MemberCardData | null>(null)
  const [seedIntention, setSeedIntention] = useState(INTENTIONS[0]?.id ?? 'philia')

  const loadCommunity = useCallback(async () => {
    if (!active?.slug) {
      setCommunityMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = (await membersApi.listCommunity(active.slug)) as { members?: CommunityMember[] }
      setCommunityMembers(data.members ?? [])
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
      setCommunityMembers([])
    } finally {
      setLoading(false)
    }
  }, [active?.slug])

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true)
    setDirectoryError(null)
    try {
      const data = await membersApi.directory()
      setDirectoryCommunities(data.communities ?? [])
      setDirectoryMembers(data.members ?? [])
    } catch (e: unknown) {
      setDirectoryError(
        e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur',
      )
      setDirectoryCommunities([])
      setDirectoryMembers([])
    } finally {
      setDirectoryLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCommunity()
  }, [loadCommunity])

  useEffect(() => {
    if (advancedOpen && directoryMode) void loadDirectory()
  }, [advancedOpen, directoryMode, loadDirectory])

  const filteredCommunityMembers = useMemo(() => {
    let list = communityMembers
    const q = memberSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (m) =>
          m.pseudo.toLowerCase().includes(q) ||
          m.display_name.toLowerCase().includes(q) ||
          String(m.user_id).includes(q),
      )
    }
    return sortMembersAz(list)
  }, [communityMembers, memberSearch])

  const filteredDirectoryMembers = useMemo(() => {
    let list = directoryMembers
    if (filterCommunitySlug) {
      list = list.filter((m) => m.communities.some((c) => c.slug === filterCommunitySlug))
    }
    const q = memberSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (m) =>
          m.pseudo.toLowerCase().includes(q) ||
          m.display_name.toLowerCase().includes(q) ||
          String(m.user_id).includes(q),
      )
    }
    return sortMembersAz(list)
  }, [directoryMembers, filterCommunitySlug, memberSearch])

  const displayMembers: MemberCardData[] = directoryMode
    ? filteredDirectoryMembers
    : filteredCommunityMembers

  const sendSeed = async () => {
    if (!seedTarget) return
    setActionMsg(null)
    try {
      await socialApi.sendSeed(String(seedTarget.user_id), seedIntention)
      setActionMsg(`Graine envoyée à ${seedTarget.pseudo}`)
      setSeedTarget(null)
    } catch (e: unknown) {
      setActionMsg(e instanceof ApiError ? e.detail : 'Erreur envoi graine')
    }
  }

  const openDirectoryPanel = (m: MemberDirectoryEntry) => {
    if (directoryMode) setPanelMember(m)
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Membres</h1>
          <p className="text-sm text-slate-400 mt-1">
            {directoryMode
              ? 'Annuaire multi-communautés'
              : active?.name
                ? `Communauté active : ${active.name}`
                : 'Sélectionnez une communauté'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => (directoryMode ? void loadDirectory() : void loadCommunity())}
          className="text-sm px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800"
        >
          Rafraîchir
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex-1 min-w-[180px] text-xs text-slate-400">
          Rechercher
          <input
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Pseudo, nom…"
            className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-sm"
          />
        </label>
        <p className="text-xs text-slate-500 pb-2">Tri : A → Z</p>
      </div>

      <details
        open={advancedOpen}
        onToggle={(e) => {
          const open = (e.target as HTMLDetailsElement).open
          setAdvancedOpen(open)
          if (!open) {
            setDirectoryMode(false)
            setPanelMember(null)
          }
        }}
        className="rounded-xl border border-slate-800 bg-slate-900/30"
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-300 hover:text-white">
          Filtres avancés
        </summary>
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800/80 pt-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={directoryMode}
              onChange={(e) => {
                setDirectoryMode(e.target.checked)
                setPanelMember(null)
                if (e.target.checked) void loadDirectory()
              }}
              className="rounded"
            />
            <span>Annuaire global (toutes mes communautés)</span>
          </label>
          {directoryMode && (
            <label className="block text-xs text-slate-400 max-w-md">
              Filtrer par communauté
              <select
                value={filterCommunitySlug}
                onChange={(e) => setFilterCommunitySlug(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-sm text-slate-100"
              >
                <option value="">Toutes</option>
                {directoryCommunities.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.logo_emoji ? `${c.logo_emoji} ` : ''}
                    {c.name} ({c.member_count})
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-xs text-slate-500">
            L&apos;annuaire global utilise l&apos;API{' '}
            <code className="text-violet-400">membersApi.directory</code>. En mode normal, seuls
            les membres de la communauté active sont affichés.
          </p>
        </div>
      </details>

      {(loading || (directoryMode && directoryLoading)) && (
        <p className="text-slate-400 text-sm">Chargement…</p>
      )}
      {(error || (directoryMode && directoryError)) && (
        <p className="text-red-400 text-sm">{directoryMode ? directoryError : error}</p>
      )}
      {actionMsg && <p className="text-emerald-400 text-sm">{actionMsg}</p>}

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {!loading && !(directoryMode && directoryLoading) && (
            <MemberGrid
              members={displayMembers}
              directoryMode={directoryMode}
              onOpenMessages={onOpenMessages}
              onSeed={setSeedTarget}
              onMemberClick={openDirectoryPanel}
            />
          )}
        </div>
        {directoryMode && panelMember && (
          <aside className="w-full max-w-xs shrink-0 rounded-xl border border-violet-800/40 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-widest text-violet-300">Détail membre</p>
              <button
                type="button"
                onClick={() => setPanelMember(null)}
                className="text-slate-500 hover:text-slate-300 text-sm"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-3">
              <UserAvatar
                avatar={panelMember.avatar}
                avatarEmoji={panelMember.avatar_emoji}
                size="md"
                alt={panelMember.pseudo}
              />
              <div>
                <p className="font-medium">{panelMember.pseudo}</p>
                {panelMember.display_name !== panelMember.pseudo && (
                  <p className="text-xs text-slate-500">{panelMember.display_name}</p>
                )}
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Communautés</p>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {panelMember.communities.map((c) => (
                <li
                  key={c.slug}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm"
                >
                  <span>
                    {c.logo_emoji ? `${c.logo_emoji} ` : ''}
                    {c.name}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase">{c.role}</span>
                </li>
              ))}
            </ul>
            {!panelMember.is_me && onOpenMessages && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSeedTarget(panelMember)}
                  className="flex-1 text-xs py-2 rounded-lg border border-amber-700/50 text-amber-200"
                >
                  🌱 Graine
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMessages(String(panelMember.user_id))}
                  className="flex-1 text-xs py-2 rounded-lg border border-violet-700/50 text-violet-200"
                >
                  💬 Message
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {seedTarget && (
        <SeedModal
          target={seedTarget}
          intention={seedIntention}
          onIntention={setSeedIntention}
          onClose={() => setSeedTarget(null)}
          onSend={() => void sendSeed()}
        />
      )}
    </div>
  )
}

function MemberGrid({
  members,
  directoryMode,
  onOpenMessages,
  onSeed,
  onMemberClick,
}: {
  members: MemberCardData[]
  directoryMode: boolean
  onOpenMessages?: (userId: string) => void
  onSeed: (m: MemberCardData) => void
  onMemberClick?: (m: MemberDirectoryEntry) => void
}) {
  const me = members.find((m) => m.is_me)
  const others = members.filter((m) => !m.is_me)

  return (
    <>
      {me && (
        <div className="rounded-xl border border-violet-500/40 bg-violet-950/30 p-4 mb-4">
          <p className="text-[10px] uppercase tracking-widest text-violet-400 mb-2">Moi</p>
          <MemberCard
            member={me}
            directoryMode={directoryMode}
            onOpenMessages={onOpenMessages}
            onSeed={() => {}}
            onClick={isDirectoryMember(me) ? () => onMemberClick?.(me) : undefined}
            isMe
          />
          {!me.profile_public && (
            <p className="text-xs text-amber-400/90 mt-2">
              Profil non public — activez-le dans Mon compte.
            </p>
          )}
        </div>
      )}
      {!others.length && !me && (
        <p className="text-slate-500 text-sm italic">Aucun membre visible.</p>
      )}
      <ul className="grid sm:grid-cols-2 gap-3">
        {others.map((m) => (
          <li key={m.user_id}>
            <MemberCard
              member={m}
              directoryMode={directoryMode}
              onOpenMessages={onOpenMessages}
              onSeed={() => onSeed(m)}
              onClick={isDirectoryMember(m) ? () => onMemberClick?.(m) : undefined}
            />
          </li>
        ))}
      </ul>
    </>
  )
}

function MemberCard({
  member,
  directoryMode,
  onOpenMessages,
  onSeed,
  onClick,
  isMe,
}: {
  member: MemberCardData
  directoryMode: boolean
  onOpenMessages?: (userId: string) => void
  onSeed: () => void
  onClick?: () => void
  isMe?: boolean
}) {
  const communities = isDirectoryMember(member) ? member.communities : []

  const inner = (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex flex-col gap-3 h-full">
      <div className="flex items-center gap-3">
        <UserAvatar
          avatar={member.avatar}
          avatarEmoji={member.avatar_emoji}
          size="md"
          alt={member.pseudo}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{member.pseudo}</p>
          {member.display_name && member.display_name !== member.pseudo && (
            <p className="text-xs text-slate-500 truncate">{member.display_name}</p>
          )}
          {directoryMode && communities.length > 0 && (
            <p className="text-[10px] text-slate-500 mt-1 truncate">
              {communities.map((c) => c.name).join(' · ')}
            </p>
          )}
        </div>
      </div>
      {!isMe && (
        <div className="flex gap-2 mt-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSeed()
            }}
            className="flex-1 text-xs py-1.5 rounded-lg border border-amber-700/50 text-amber-200 hover:bg-amber-900/20"
          >
            🌱 Graine
          </button>
          {onOpenMessages && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenMessages(String(member.user_id))
              }}
              className="flex-1 text-xs py-1.5 rounded-lg border border-violet-700/50 text-violet-200 hover:bg-violet-900/20"
            >
              💬 Message
            </button>
          )}
        </div>
      )}
    </div>
  )

  if (onClick && directoryMode) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left hover:border-violet-500/30 transition-colors rounded-xl"
      >
        {inner}
      </button>
    )
  }

  return inner
}

function SeedModal({
  target,
  intention,
  onIntention,
  onClose,
  onSend,
}: {
  target: MemberCardData
  intention: string
  onIntention: (v: string) => void
  onClose: () => void
  onSend: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <UserAvatar avatar={target.avatar} avatarEmoji={target.avatar_emoji} size="md" />
          <h2 className="font-semibold">Graine vers {target.pseudo}</h2>
        </div>
        <select
          value={intention}
          onChange={(e) => onIntention(e.target.value)}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
        >
          {INTENTIONS.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-400">
            Annuler
          </button>
          <button
            type="button"
            onClick={onSend}
            className="px-4 py-1.5 text-sm rounded-lg bg-amber-600 text-white"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}
