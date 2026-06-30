'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { membersApi, type CommunityMember } from '@/api/members'
import { socialApi } from '@/api/social'
import { useAuth } from '@/contexts/AuthContext'
import { useCommunity } from '@/contexts/CommunityContext'
import { UserAvatar } from '@/components/UserAvatar'
import { ApiError } from '@/lib/api-client'

export function ConversationMemberSidebar({
  onChannelOpened,
  highlightUserId,
}: {
  onChannelOpened: (channelId: number) => void
  highlightUserId?: string | null
}) {
  const { user } = useAuth()
  const { active } = useCommunity()
  const meId = user?.id ? Number(user.id) : null
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [opening, setOpening] = useState(false)
  const [search, setSearch] = useState('')

  const loadMembers = useCallback(async () => {
    if (!active?.slug) {
      setMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = (await membersApi.listCommunity(active.slug)) as { members?: CommunityMember[] }
      const list = (data.members ?? []).filter((m) => !m.is_me)
      setMembers(list)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Impossible de charger les membres')
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [active?.slug])

  useEffect(() => {
    void loadMembers()
    setSelected(new Set())
  }, [loadMembers])

  useEffect(() => {
    if (!highlightUserId) return
    const id = Number(highlightUserId)
    if (!id || id === meId) return
    setSelected(new Set([id]))
  }, [highlightUserId, meId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) =>
        m.pseudo.toLowerCase().includes(q) ||
        m.display_name.toLowerCase().includes(q)
    )
  }, [members, search])

  const selectableIds = useMemo(() => filtered.map((m) => m.user_id), [filtered])
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))

  const toggleMember = (userId: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(selectableIds))
  }

  const openConversation = async () => {
    if (!active?.slug || !selected.size || opening) return
    setOpening(true)
    setError(null)
    try {
      const ids = [...selected]
      let channelId: number
      if (ids.length === 1) {
        const res = await socialApi.openChannel(ids[0], active.slug)
        channelId = res.channelId
      } else {
        const res = await socialApi.openGroupChannel(ids, active.slug)
        channelId = res.channelId
      }
      onChannelOpened(channelId)
      setSelected(new Set())
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Impossible d\'ouvrir la discussion')
    } finally {
      setOpening(false)
    }
  }

  return (
    <aside className="flex flex-col h-full min-h-0 border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
      <div className="shrink-0 p-3 border-b border-slate-800 space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Membres du lieu</h2>
          <p className="text-[11px] text-slate-500 truncate">{active?.name ?? '—'}</p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs placeholder-slate-500"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={!selectableIds.length}
            className="text-[11px] text-violet-400 hover:text-violet-300 disabled:opacity-40"
          >
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
          <span className="text-[10px] text-slate-500">{selected.size} sélectionné(s)</span>
        </div>
        <button
          type="button"
          onClick={() => void openConversation()}
          disabled={!selected.size || opening || !active?.slug}
          className="w-full py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-50"
        >
          {opening
            ? 'Ouverture…'
            : selected.size > 1
              ? `Groupe (${selected.size})`
              : selected.size === 1
                ? 'Discuter'
                : 'Choisir des membres'}
        </button>
      </div>

      {error && <p className="shrink-0 px-3 py-2 text-xs text-red-400">{error}</p>}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && <p className="p-3 text-xs text-slate-500">Chargement…</p>}
        {!loading && filtered.length === 0 && (
          <p className="p-3 text-xs text-slate-500">Aucun membre visible.</p>
        )}
        <ul className="divide-y divide-slate-800/80">
          {filtered.map((member) => {
            const checked = selected.has(member.user_id)
            const highlighted = highlightUserId === String(member.user_id)
            return (
              <li key={member.user_id}>
                <label
                  className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-800/40 ${
                    checked || highlighted ? 'bg-violet-950/30' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMember(member.user_id)}
                    className="rounded border-slate-600 text-violet-600 focus:ring-violet-500 shrink-0"
                  />
                  <UserAvatar
                    avatar={member.avatar}
                    avatarEmoji={member.avatar_emoji}
                    size="sm"
                    alt={member.pseudo}
                  />
                  <span className="text-sm truncate flex-1 min-w-0">{member.pseudo}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
