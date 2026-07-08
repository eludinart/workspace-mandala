'use client'

import { useMemo, useState } from 'react'
import type { CommunityMember } from '@/api/members'
import { socialApi } from '@/api/social'
import { UserAvatar } from '@/components/UserAvatar'
import { ApiError } from '@/lib/api-client'

export function AddGroupMembersPanel({
  channelId,
  existingMemberIds,
  communityMembers,
  onMembersAdded,
}: {
  channelId: number
  existingMemberIds: number[]
  communityMembers: CommunityMember[]
  onMembersAdded?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const existing = useMemo(() => new Set(existingMemberIds), [existingMemberIds])

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return communityMembers
      .filter((m) => !m.is_me && !existing.has(m.user_id))
      .filter((m) => {
        if (!q) return true
        return (
          m.pseudo.toLowerCase().includes(q) ||
          m.display_name.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'))
  }, [communityMembers, existing, search])

  const toggle = (userId: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const submit = async () => {
    if (!selected.size || busy) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await socialApi.addGroupMembers(channelId, [...selected])
      setMsg(
        selected.size === 1
          ? '1 participant ajouté au groupe'
          : `${selected.size} participants ajoutés au groupe`
      )
      setSelected(new Set())
      setOpen(false)
      onMembersAdded?.()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Impossible d\'ajouter ces membres')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            setError(null)
            setMsg(null)
          }}
          className="text-xs font-medium text-violet-300 hover:text-violet-200 px-2.5 py-1.5 rounded-lg border border-violet-700/40 bg-violet-950/30 hover:bg-violet-950/50 transition-colors"
        >
          + Ajouter des personnes
        </button>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-200">Ajouter au groupe</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setSelected(new Set())
                setSearch('')
                setError(null)
              }}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              Annuler
            </button>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un membre du lieu…"
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-xs"
          />
          {candidates.length === 0 ? (
            <p className="text-[11px] text-slate-500 px-1">
              Aucun autre membre du lieu à ajouter.
            </p>
          ) : (
            <ul className="max-h-36 overflow-y-auto divide-y divide-slate-800/80 rounded-lg border border-slate-800/80">
              {candidates.map((m) => (
                <li key={m.user_id}>
                  <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-800/40">
                    <input
                      type="checkbox"
                      checked={selected.has(m.user_id)}
                      onChange={() => toggle(m.user_id)}
                      className="rounded border-slate-600 text-violet-600"
                    />
                    <UserAvatar
                      avatar={m.avatar}
                      avatarEmoji={m.avatar_emoji}
                      size="xs"
                      alt={m.pseudo}
                      className="!w-6 !h-6"
                    />
                    <span className="text-xs text-slate-200 truncate">{m.pseudo}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={!selected.size || busy}
            onClick={() => void submit()}
            className="w-full py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? 'Ajout…' : `Ajouter (${selected.size})`}
          </button>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
      )}
      {msg && <p className="text-[11px] text-emerald-400">{msg}</p>}
    </div>
  )
}
