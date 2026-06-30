'use client'

import { useState } from 'react'
import type { ChannelMessage } from '@/store/useSocialStore'
import type { MessageReactionSummary } from '@/lib/message-reactions'
import { MESSAGE_REACTION_EMOJIS } from '@/lib/message-reactions'
import { UserAvatar } from '@/components/UserAvatar'
import { formatMandalaDateTime } from '@/lib/format-datetime'

export function MessageBubble({
  msg,
  isMe,
  displayName,
  avatar,
  avatarEmoji,
  meId,
  onReact,
}: {
  msg: ChannelMessage
  isMe: boolean
  displayName: string
  avatar?: string | null
  avatarEmoji?: string
  meId: number | null
  onReact: (messageId: number, emoji: string) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const messageId = Number(msg.id ?? msg.messageId)
  const body = msg.body || (msg.cardSlug ? `🃏 ${msg.cardSlug}` : '')
  const reactions = msg.reactions ?? []
  const myReaction = reactions.find((r) => meId != null && r.userIds.includes(meId))?.emoji

  const handleReact = (emoji: string) => {
    if (!messageId) return
    onReact(messageId, emoji)
    setPickerOpen(false)
  }

  return (
    <div
      className={`group flex gap-2.5 max-w-[92%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
      onMouseLeave={() => setPickerOpen(false)}
    >
      <UserAvatar
        avatar={avatar}
        avatarEmoji={avatarEmoji}
        size="sm"
        alt={displayName}
        className="shrink-0 mt-5"
      />
      <div className={`min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        <div
          className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1 px-0.5 ${
            isMe ? 'flex-row-reverse' : ''
          }`}
        >
          <span className="text-sm font-semibold text-slate-200">{displayName}</span>
          {msg.createdAt && (
            <span className="text-xs text-slate-500">{formatMandalaDateTime(msg.createdAt)}</span>
          )}
        </div>

        <div
          className={`relative rounded-2xl px-4 py-2.5 text-base whitespace-pre-wrap leading-relaxed ${
            isMe
              ? 'bg-violet-600/25 text-slate-100 border border-violet-500/30'
              : 'bg-slate-800/90 text-slate-100 border border-slate-700'
          }`}
        >
          {body}
        </div>

        {reactions.length > 0 && (
          <div className={`mt-1.5 flex flex-wrap items-center gap-1 ${isMe ? 'justify-end' : ''}`}>
            {reactions.map((r) => (
              <ReactionChip
                key={r.emoji}
                reaction={r}
                active={meId != null && r.userIds.includes(meId)}
                onClick={() => handleReact(r.emoji)}
              />
            ))}
          </div>
        )}

        <div
          className={`mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ${
            pickerOpen ? 'opacity-100' : ''
          } ${isMe ? 'justify-end' : ''}`}
        >
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="text-xs px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:border-slate-600"
            title="Réagir au message"
            aria-expanded={pickerOpen}
          >
            {pickerOpen ? 'Fermer' : 'Réagir 😊'}
          </button>
          {pickerOpen && (
            <div className="flex flex-wrap gap-0.5 p-1.5 rounded-xl border border-slate-700 bg-slate-900 shadow-lg max-w-[240px]">
              {MESSAGE_REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReact(emoji)}
                  className={`w-9 h-9 rounded-lg text-lg hover:bg-slate-800 transition-colors ${
                    myReaction === emoji ? 'bg-violet-950/50 ring-1 ring-violet-500/50' : ''
                  }`}
                  title={`Réagir ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReactionChip({
  reaction,
  active,
  onClick,
}: {
  reaction: MessageReactionSummary
  active: boolean
  onClick: () => void
}) {
  const count = reaction.userIds.length
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-colors ${
        active
          ? 'border-violet-500/50 bg-violet-950/40 text-violet-100'
          : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600'
      }`}
      title={`${count} réaction${count > 1 ? 's' : ''}`}
    >
      <span aria-hidden>{reaction.emoji}</span>
      {count > 1 && <span className="text-xs text-slate-400">{count}</span>}
    </button>
  )
}
