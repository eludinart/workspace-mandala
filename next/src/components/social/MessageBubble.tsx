'use client'

import { useRef, useState } from 'react'
import type { ChannelMessage } from '@/store/useSocialStore'
import type { MessageReactionSummary } from '@/lib/message-reactions'
import { MESSAGE_REACTION_EMOJIS } from '@/lib/message-reactions'
import { UserAvatar } from '@/components/UserAvatar'
import { formatChatBubbleTime } from '@/lib/format-datetime'
import {
  formatFileSize,
  isChatImagePreview,
  messageMediaUrl,
} from '@/lib/chat-attachments'

export function MessageBubble({
  msg,
  isMe,
  displayName,
  avatar,
  avatarEmoji,
  meId,
  showAvatar = false,
  showName = false,
  highlighted = false,
  senderId,
  onOpenProfile,
  onReact,
  onReply,
  onJumpTo,
}: {
  msg: ChannelMessage
  isMe: boolean
  displayName: string
  avatar?: string | null
  avatarEmoji?: string
  meId: number | null
  showAvatar?: boolean
  showName?: boolean
  highlighted?: boolean
  senderId?: number | null
  onOpenProfile?: (userId: number) => void
  onReact: (messageId: number, emoji: string) => void
  onReply?: (msg: ChannelMessage) => void
  onJumpTo?: (messageId: number) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const holdRef = useRef<number | null>(null)
  const messageId = Number(msg.id ?? msg.messageId)
  const canReply = Number.isFinite(messageId) && messageId > 0
  const body = msg.body || (msg.cardSlug ? `🃏 ${msg.cardSlug}` : '')
  const reactions = msg.reactions ?? []
  const myReaction = reactions.find((r) => meId != null && r.userIds.includes(meId))?.emoji
  const time = formatChatBubbleTime(msg.createdAt)

  const handleReact = (emoji: string) => {
    if (!messageId) return
    onReact(messageId, emoji)
    setPickerOpen(false)
  }

  const armHold = () => {
    holdRef.current = window.setTimeout(() => setPickerOpen(true), 420)
  }
  const clearHold = () => {
    if (holdRef.current != null) {
      window.clearTimeout(holdRef.current)
      holdRef.current = null
    }
  }

  const attachment = msg.attachment
  const previewUrl =
    msg.localPreviewUrl ||
    (attachment && messageId && isChatImagePreview(attachment.mime)
      ? messageMediaUrl(messageId)
      : null)
  const fileUrl =
    attachment && messageId
      ? messageMediaUrl(messageId, !isChatImagePreview(attachment.mime))
      : null

  const canOpenProfile = senderId != null && senderId > 0 && !!onOpenProfile
  const openProfile = () => {
    if (senderId != null) onOpenProfile?.(senderId)
  }

  return (
    <div
      id={canReply ? `chat-msg-${messageId}` : undefined}
      className={`group flex items-end gap-2 max-w-full min-w-0 rounded-2xl transition-shadow ${
        highlighted ? 'ring-2 ring-violet-400/80' : ''
      } ${isMe ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
      onPointerDown={armHold}
      onPointerUp={clearHold}
      onPointerLeave={clearHold}
      onPointerCancel={clearHold}
    >
      {showAvatar ? (
        canOpenProfile ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={openProfile}
            className="mb-1 shrink-0 rounded-full hover:ring-2 hover:ring-violet-500/60"
            aria-label={`Voir la fiche de ${displayName}`}
          >
            <UserAvatar
              avatar={avatar}
              avatarEmoji={avatarEmoji}
              size="xs"
              alt={displayName}
            />
          </button>
        ) : (
          <UserAvatar
            avatar={avatar}
            avatarEmoji={avatarEmoji}
            size="xs"
            alt={displayName}
            className="mb-1 shrink-0"
          />
        )
      ) : null}

      <div className={`min-w-0 max-w-[min(100%,26rem)] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        <div
          className={`relative max-w-full min-w-0 rounded-2xl px-3 py-1.5 shadow-sm ${
            isMe
              ? 'rounded-br-md bg-violet-600 text-white'
              : 'rounded-bl-md bg-slate-800 text-slate-100'
          }`}
        >
          {showName &&
            (canOpenProfile ? (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={openProfile}
                className="text-[12px] font-semibold text-violet-300 leading-tight mb-0.5 break-words text-left hover:underline"
              >
                {displayName}
              </button>
            ) : (
              <p className="text-[12px] font-semibold text-violet-400 leading-tight mb-0.5 break-words">{displayName}</p>
            ))}
          {msg.replyTo && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                const quoted = msg.replyTo
                if (quoted && !quoted.missing) onJumpTo?.(quoted.id)
              }}
              className={`mb-1 block w-full min-w-0 text-left rounded-lg border-l-4 px-2 py-1 ${
                isMe ? 'border-white/80 bg-white/15' : 'border-violet-400 bg-slate-950/40'
              }`}
            >
              {msg.replyTo.missing ? (
                <span className="text-xs italic opacity-80">Message d’origine indisponible</span>
              ) : (
                <>
                  <span className={`block text-[11px] font-semibold leading-tight ${isMe ? 'text-white' : 'text-violet-300'}`}>
                    {meId != null && msg.replyTo.senderId === meId ? 'Vous' : msg.replyTo.senderName || 'Membre'}
                  </span>
                  <span className="block truncate text-xs opacity-80">{msg.replyTo.excerpt || 'Message'}</span>
                </>
              )}
            </button>
          )}
          {previewUrl && (
            <a href={fileUrl || previewUrl} target="_blank" rel="noreferrer" className="block mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={attachment?.name || 'Photo'}
                className="block max-w-full max-h-72 w-auto h-auto rounded-lg object-contain"
              />
            </a>
          )}
          {attachment && !previewUrl && fileUrl && (
            <a
              href={fileUrl}
              className="mb-1 flex items-center gap-2 min-w-0 rounded-lg border border-current/25 px-2.5 py-1.5 text-sm"
            >
              <span aria-hidden>📄</span>
              <span className="min-w-0 truncate">{attachment.name}</span>
              {attachment.size > 0 && (
                <span className="shrink-0 text-[10px] opacity-75">{formatFileSize(attachment.size)}</span>
              )}
            </a>
          )}
          {(body || time) && (
            <div className="min-w-0 max-w-full">
              {body ? (
                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[15px] leading-snug">
                  {body}
                </div>
              ) : null}
              {time && (
                <p
                  className={`text-right text-[10px] leading-none mt-1 ${
                    isMe ? 'text-white/75' : 'text-slate-400'
                  }`}
                >
                  {time}
                </p>
              )}
            </div>
          )}
        </div>

        {reactions.length > 0 && (
          <div className={`mt-1 flex flex-wrap items-center gap-1 ${isMe ? 'justify-end' : ''}`}>
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
          className={`mt-0.5 flex items-center gap-1 ${
            pickerOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
          } ${isMe ? 'justify-end' : ''}`}
        >
          {canReply && onReply && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                setPickerOpen(false)
                onReply(msg)
              }}
              className="h-7 px-2 rounded-full text-[12px] text-slate-400 hover:text-slate-100 hover:bg-slate-800/80"
              title="Répondre"
              aria-label="Répondre au message"
            >
              Répondre
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPickerOpen((v) => !v)}
            className="text-sm w-7 h-7 rounded-full text-slate-500 hover:text-slate-200 hover:bg-slate-800/80"
            title="Réagir"
            aria-label="Réagir au message"
            aria-expanded={pickerOpen}
          >
            😊
          </button>
          {pickerOpen && (
            <div className="flex flex-wrap gap-0.5 p-1 rounded-full border border-slate-700 bg-slate-900 shadow-lg">
              {MESSAGE_REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReact(emoji)}
                  className={`w-8 h-8 rounded-full text-base hover:bg-slate-800 transition-colors ${
                    myReaction === emoji ? 'bg-violet-600/30 ring-1 ring-violet-400' : ''
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
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-sm border transition-colors ${
        active
          ? 'border-violet-500/50 bg-violet-600/25 text-slate-100'
          : 'border-slate-700 bg-slate-900/80 text-slate-200 hover:border-slate-600'
      }`}
      title={`${count} réaction${count > 1 ? 's' : ''}`}
    >
      <span aria-hidden>{reaction.emoji}</span>
      {count > 1 && <span className="text-[10px] text-slate-400">{count}</span>}
    </button>
  )
}
