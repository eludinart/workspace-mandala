'use client'

import { useMemo, useState } from 'react'
import { UserAvatar } from '@/components/UserAvatar'

export type GroupParticipant = {
  userId: number
  pseudo: string
  avatar?: string | null
  avatarEmoji?: string
  isMe?: boolean
}

const PREVIEW_AVATARS = 4
const PREVIEW_NAMES = 3

export function GroupParticipantsPreview({
  memberIds,
  participantsById,
  meId,
  className = '',
}: {
  memberIds: number[]
  participantsById: Record<number, { pseudo: string; avatar?: string | null; avatarEmoji?: string }>
  meId?: number | null
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)

  const participants = useMemo(() => {
    const list: GroupParticipant[] = memberIds
      .map((userId) => {
        const p = participantsById[userId]
        return {
          userId,
          pseudo: p?.pseudo ?? `Membre #${userId}`,
          avatar: p?.avatar ?? null,
          avatarEmoji: p?.avatarEmoji ?? '🌸',
          isMe: meId != null && userId === meId,
        }
      })
      .sort((a, b) => {
        if (a.isMe) return -1
        if (b.isMe) return 1
        return a.pseudo.localeCompare(b.pseudo, 'fr')
      })
    return list
  }, [memberIds, participantsById, meId])

  if (!participants.length) return null

  const previewNames = participants.slice(0, PREVIEW_NAMES)
  const extraCount = participants.length - previewNames.length
  const namesLabel =
    extraCount > 0
      ? `${previewNames.map((p) => (p.isMe ? 'Moi' : p.pseudo)).join(', ')} et ${extraCount} autre${extraCount > 1 ? 's' : ''}`
      : previewNames.map((p) => (p.isMe ? 'Moi' : p.pseudo)).join(', ')

  return (
    <div className={`mt-1.5 space-y-2 ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 rounded-lg px-1 py-1 -mx-1 hover:bg-slate-800/50 text-left transition-colors"
        aria-expanded={expanded}
        aria-label={expanded ? 'Masquer les participants' : 'Voir tous les participants'}
      >
        <div className="flex items-center -space-x-2 shrink-0">
          {participants.slice(0, PREVIEW_AVATARS).map((p) => (
            <span
              key={p.userId}
              className="ring-2 ring-slate-900 rounded-full"
              title={p.isMe ? 'Moi' : p.pseudo}
            >
              <UserAvatar
                avatar={p.avatar}
                avatarEmoji={p.avatarEmoji}
                size="xs"
                alt={p.pseudo}
                className="!w-6 !h-6"
              />
            </span>
          ))}
          {participants.length > PREVIEW_AVATARS && (
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-[9px] font-medium text-slate-200 ring-2 ring-slate-900">
              +{participants.length - PREVIEW_AVATARS}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400 truncate flex-1 min-w-0">{namesLabel}</span>
        <span className="text-[10px] text-violet-400 shrink-0 whitespace-nowrap">
          {expanded ? 'Masquer' : 'Voir tous'}
        </span>
      </button>

      {expanded && (
        <ul className="rounded-lg border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/80 max-h-40 overflow-y-auto">
          {participants.map((p) => (
            <li key={p.userId} className="flex items-center gap-2 px-2.5 py-2">
              <UserAvatar
                avatar={p.avatar}
                avatarEmoji={p.avatarEmoji}
                size="xs"
                alt={p.pseudo}
                className="!w-7 !h-7 shrink-0"
              />
              <span className="text-xs text-slate-200 truncate">
                {p.isMe ? (
                  <>
                    {p.pseudo}
                    <span className="text-slate-500 ml-1">(moi)</span>
                  </>
                ) : (
                  p.pseudo
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
