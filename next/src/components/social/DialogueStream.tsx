'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSocialStore, type ChannelMessage } from '@/store/useSocialStore'
import { socialApi } from '@/api/social'
import { GroupParticipantsPreview } from './GroupParticipantsPreview'
import { AddGroupMembersPanel } from './AddGroupMembersPanel'
import { MessageBubble } from './MessageBubble'
import { UserAvatar } from '@/components/UserAvatar'
import type { CommunityMember } from '@/api/members'
import { chatDayKey, formatChatDayLabel } from '@/lib/format-datetime'
import {
  CHAT_FILE_ACCEPT,
  chatFileError,
  formatFileSize,
  isChatImagePreview,
  messageReplyExcerpt,
  resolveChatFileMime,
  type MessageReplyQuote,
} from '@/lib/chat-attachments'
import { ApiError } from '@/lib/api-client'

export function DialogueStream({
  channelId,
  otherPseudo,
  otherAvatar,
  otherAvatarEmoji,
  otherIsOnline = false,
  isGroup = false,
  memberCount,
  memberIds = [],
  participantsById = {},
  createdBy,
  onGroupRenamed,
  communityMembers = [],
  onGroupMembersChanged,
  onBack,
}: {
  channelId: number
  otherPseudo?: string
  otherAvatar?: string | null
  otherAvatarEmoji?: string
  otherIsOnline?: boolean
  isGroup?: boolean
  memberCount?: number
  memberIds?: number[]
  participantsById?: Record<number, { pseudo: string; avatar?: string | null; avatarEmoji?: string }>
  createdBy?: number | null
  onGroupRenamed?: (name: string) => void
  communityMembers?: CommunityMember[]
  onGroupMembersChanged?: () => void
  onBack?: () => void
}) {
  const { user } = useAuth()
  const u = user as {
    id?: number
    pseudo?: string
    name?: string
    avatar?: string
    avatar_emoji?: string
  } | null
  const meId = u?.id ? Number(u.id) : null
  const mePseudo = u?.pseudo || u?.name || 'Vous'
  const meAvatar = u?.avatar
  const meAvatarEmoji = u?.avatar_emoji

  const {
    messagesByChannel,
    loadChannelMessages,
    sendMessage,
    toggleMessageReaction,
    markChannelRead,
  } = useSocialStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const [pendingMessages, setPendingMessages] = useState<ChannelMessage[]>([])
  const [renaming, setRenaming] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)

  const [iconEditing, setIconEditing] = useState(false)
  const [iconSaving, setIconSaving] = useState(false)
  const [iconEmojiDraft, setIconEmojiDraft] = useState('')
  const [iconImageDraft, setIconImageDraft] = useState<string | null>(null)
  const [iconError, setIconError] = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [unreadFromId, setUnreadFromId] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [replyDraft, setReplyDraft] = useState<MessageReplyQuote | null>(null)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [readCursorReady, setReadCursorReady] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const unreadBoundaryRef = useRef<HTMLDivElement>(null)
  const readCursorCaptured = useRef(false)
  const initialScrollDone = useRef(false)

  const messages = messagesByChannel[String(channelId)] || []
  const visibleMessages = [...messages, ...pendingMessages]
  const canRename = isGroup && createdBy != null && meId != null && Number(createdBy) === Number(meId)

  useEffect(() => {
    if (!editingName) return
    setNameDraft(otherPseudo || '')
    setRenameError(null)
  }, [editingName, otherPseudo])

  useEffect(() => {
    if (!iconEditing) return
    setIconError(null)
    setIconEmojiDraft(otherAvatarEmoji ?? (isGroup ? '👥' : ''))
    setIconImageDraft(otherAvatar ?? null)
    // If the user starts editing the icon, stop any name editing UI.
    setEditingName(false)
  }, [iconEditing, otherAvatarEmoji, otherAvatar, isGroup])

  const fitMessageInput = useCallback(() => {
    const el = messageInputRef.current
    if (!el) return
    const max = 160
    el.style.height = 'auto'
    const next = Math.min(Math.max(el.scrollHeight, 44), max)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    fitMessageInput()
  }, [input, fitMessageInput])

  useEffect(() => {
    setInfoOpen(false)
    setEditingName(false)
    setIconEditing(false)
    setUnreadFromId(null)
    setUnreadCount(0)
    setReplyDraft(null)
    setHighlightId(null)
    setReadCursorReady(false)
    readCursorCaptured.current = false
    initialScrollDone.current = false
  }, [channelId])

  useEffect(() => {
    if (!channelId) return
    let alive = true
    let inFlight = false
    const refresh = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const loaded = await loadChannelMessages(channelId)
        if (!alive) return
        if (!readCursorCaptured.current) {
          readCursorCaptured.current = true
          setUnreadFromId(loaded.unreadFromMessageId)
          setUnreadCount(loaded.unreadCount)
          setReadCursorReady(true)
        }
        markChannelRead?.(channelId)
      } finally {
        inFlight = false
      }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 15000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [channelId, loadChannelMessages, markChannelRead])

  useEffect(() => {
    const el = listRef.current
    if (!el || !readCursorReady || visibleMessages.length === 0) return
    if (!initialScrollDone.current) {
      requestAnimationFrame(() => {
        const boundary = unreadBoundaryRef.current
        if (unreadFromId != null && boundary) {
          const delta = boundary.getBoundingClientRect().top - el.getBoundingClientRect().top
          el.scrollTop += delta - 120
        } else {
          el.scrollTop = el.scrollHeight
        }
        initialScrollDone.current = true
      })
      return
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [readCursorReady, unreadFromId, visibleMessages.length])

  const resolveSender = useCallback(
    (msg: ChannelMessage, isMe: boolean) => {
      if (isMe) {
        return {
          displayName: `${mePseudo} (vous)`,
          avatar: meAvatar,
          avatarEmoji: meAvatarEmoji,
        }
      }
      if (msg.senderPseudo) {
        return {
          displayName: msg.senderPseudo,
          avatar: msg.senderAvatar,
          avatarEmoji: msg.senderAvatarEmoji ?? undefined,
        }
      }
      const fromParticipants =
        msg.senderId != null ? participantsById[msg.senderId] : undefined
      if (fromParticipants) {
        return {
          displayName: fromParticipants.pseudo,
          avatar: fromParticipants.avatar,
          avatarEmoji: fromParticipants.avatarEmoji,
        }
      }
      if (!isGroup) {
        return {
          displayName: otherPseudo || 'Interlocuteur',
          avatar: otherAvatar,
          avatarEmoji: otherAvatarEmoji,
        }
      }
      return {
        displayName: msg.senderId ? `Membre #${msg.senderId}` : 'Membre',
        avatar: null,
        avatarEmoji: '🌸',
      }
    },
    [
      mePseudo,
      meAvatar,
      meAvatarEmoji,
      participantsById,
      isGroup,
      otherPseudo,
      otherAvatar,
      otherAvatarEmoji,
    ],
  )

  const clearFile = () => {
    setFile(null)
    setFilePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const pickFile = (next: File | null) => {
    setSendError(null)
    if (filePreview) URL.revokeObjectURL(filePreview)
    setFilePreview(null)
    if (!next) {
      setFile(null)
      return
    }
    const problem = chatFileError(next)
    if (problem) {
      setFile(null)
      setSendError(problem)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setFile(next)
    const mime = resolveChatFileMime(next)
    if (isChatImagePreview(mime)) setFilePreview(URL.createObjectURL(next))
  }

  const quoteFromMessage = (msg: ChannelMessage): MessageReplyQuote => {
    const id = Number(msg.id ?? msg.messageId)
    const mine = meId != null && msg.senderId === meId
    const rawName = String(msg.senderPseudo || '')
      .replace(/\s*\(vous\)\s*$/i, '')
      .trim()
    return {
      id,
      senderId: msg.senderId,
      senderName: mine ? 'Vous' : rawName || 'Membre',
      excerpt: messageReplyExcerpt({
        body: msg.body,
        cardSlug: msg.cardSlug,
        attachmentMime: msg.attachment?.mime,
        attachmentName: msg.attachment?.name,
      }),
    }
  }

  const startReply = (msg: ChannelMessage) => {
    const id = Number(msg.id ?? msg.messageId)
    if (!Number.isFinite(id) || id <= 0) return
    setReplyDraft(quoteFromMessage(msg))
    requestAnimationFrame(() => messageInputRef.current?.focus())
  }

  const jumpToMessage = (id: number) => {
    const el = document.getElementById(`chat-msg-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(id)
    window.setTimeout(() => {
      setHighlightId((current) => (current === id ? null : current))
    }, 1400)
  }

  const handleSendText = async () => {
    const text = input.trim()
    const attachment = file
    if ((!text && !attachment) || sending) return
    const quoted = replyDraft
    const tempId = `tmp-${Date.now()}`
    const mime = attachment ? resolveChatFileMime(attachment) : ''
    const preview = attachment && isChatImagePreview(mime) ? URL.createObjectURL(attachment) : null
    setPendingMessages((prev) => [
      ...prev,
      {
        id: tempId as unknown as number,
        senderId: meId ?? undefined,
        body: text,
        createdAt: new Date().toISOString(),
        senderPseudo: mePseudo,
        senderAvatar: meAvatar,
        senderAvatarEmoji: meAvatarEmoji,
        reactions: [],
        replyTo: quoted,
        localPreviewUrl: preview,
        attachment: attachment
          ? { mime, name: attachment.name, size: attachment.size }
          : null,
      },
    ])
    setInput('')
    clearFile()
    setSending(true)
    setSendError(null)
    try {
      await sendMessage(channelId, {
        body: text,
        file: attachment ?? undefined,
        replyToId: quoted?.id,
      })
      setReplyDraft(null)
      requestAnimationFrame(() => {
        const el = listRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    } catch (e: unknown) {
      setInput(text)
      if (attachment) {
        setFile(attachment)
        if (isChatImagePreview(mime)) setFilePreview(URL.createObjectURL(attachment))
      }
      setSendError(e instanceof ApiError ? e.detail : 'Envoi impossible')
    } finally {
      if (preview) URL.revokeObjectURL(preview)
      setPendingMessages((prev) => prev.filter((m) => String(m.id) !== tempId))
      setSending(false)
    }
  }

  const handleReact = (messageId: number, emoji: string) => {
    void toggleMessageReaction(channelId, messageId, emoji)
  }

  const submitRename = async () => {
    if (!canRename || renaming) return
    const next = nameDraft.trim()
    if (!next) {
      setRenameError('Nom requis')
      return
    }
    setRenaming(true)
    setRenameError(null)
    try {
      await socialApi.renameGroupChannel(channelId, next)
      setEditingName(false)
      onGroupRenamed?.(next)
    } catch (e: unknown) {
      setRenameError((e as { detail?: string; message?: string })?.detail || (e as { message?: string })?.message || 'Impossible de renommer')
    } finally {
      setRenaming(false)
    }
  }

  const submitIcon = async () => {
    if (!canRename || iconSaving) return
    setIconSaving(true)
    setIconError(null)
    try {
      await socialApi.updateGroupChannelIcon(channelId, {
        emoji: iconEmojiDraft.trim() || null,
        image: iconImageDraft,
      })
      setIconEditing(false)
      // Reload channels list so the new icon shows in the sidebar + header.
      onGroupRenamed?.(otherPseudo || '')
    } catch (e: unknown) {
      setIconError((e as { detail?: string; message?: string })?.detail || (e as { message?: string })?.message || 'Impossible de modifier l’icône')
    } finally {
      setIconSaving(false)
    }
  }

  const pickIconImage = (file: File | null) => {
    if (!file) {
      setIconImageDraft(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setIconImageDraft(String(reader.result ?? ''))
    }
    reader.readAsDataURL(file)
  }

  const statusLabel = isGroup
    ? `${memberCount ?? (memberIds.length || Object.keys(participantsById).length)} participants`
    : otherIsOnline
      ? 'en ligne'
      : 'hors ligne'

  return (
    <div className="min-h-0 min-w-0 w-full max-w-full flex-1 grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] bg-slate-950 overflow-hidden">
      <header className="min-w-0 bg-slate-950/95 border-b border-slate-800">
        <div className="flex items-center gap-1 px-1 py-1.5 min-h-[56px]">
          <button
            type="button"
            onClick={onBack}
            className="lg:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-violet-400 hover:bg-slate-800/80 shrink-0"
            aria-label="Retour aux messages"
          >
            <ChevronLeftIcon />
          </button>
          <span className="relative shrink-0">
            <UserAvatar
              avatar={otherAvatar}
              avatarEmoji={otherAvatarEmoji ?? (isGroup ? '👥' : undefined)}
              size="sm"
              alt={otherPseudo}
            />
            {!isGroup && otherIsOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950" />
            )}
          </span>
          <div className="min-w-0 flex-1 px-1">
            <p className="text-[15px] font-semibold truncate leading-tight">{otherPseudo || 'Conversation'}</p>
            <p className={`text-xs truncate ${!isGroup && otherIsOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
              {statusLabel}
            </p>
          </div>
          {isGroup && (
            <button
              type="button"
              onClick={() => setInfoOpen((v) => !v)}
              className={`shrink-0 min-w-[44px] min-h-[44px] rounded-full text-sm ${
                infoOpen ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:bg-slate-800/80'
              }`}
              aria-expanded={infoOpen}
              aria-label="Infos du groupe"
            >
              ···
            </button>
          )}
        </div>
        {infoOpen && isGroup && (
          <div className="max-h-[46vh] overflow-y-auto border-t border-slate-800 bg-slate-900/90 px-3 py-3 space-y-3">
            {canRename && (
              <div className="flex flex-wrap items-center gap-2">
                {editingName ? (
                  <>
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void submitRename()
                        if (e.key === 'Escape') setEditingName(false)
                      }}
                      autoFocus
                      className="min-w-0 flex-1 px-3 py-2 rounded-full border border-slate-700 bg-slate-950 text-slate-100 text-sm"
                      aria-label="Nom du groupe"
                    />
                    <button
                      type="button"
                      onClick={() => void submitRename()}
                      disabled={renaming}
                      className="px-3 py-2 rounded-full bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-50"
                    >
                      {renaming ? '…' : 'OK'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingName(false)}
                      disabled={renaming}
                      className="px-3 py-2 rounded-full border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 disabled:opacity-50"
                    >
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingName(true)
                        setIconEditing(false)
                      }}
                      className="px-3 py-1.5 rounded-full border border-slate-700 text-slate-300 text-xs hover:bg-slate-800"
                    >
                      Renommer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIconEditing(true)
                        setEditingName(false)
                      }}
                      className="px-3 py-1.5 rounded-full border border-slate-700 text-slate-300 text-xs hover:bg-slate-800"
                    >
                      Icône
                    </button>
                  </>
                )}
              </div>
            )}
            {renameError && <p className="text-xs text-red-400">{renameError}</p>}
            {iconEditing && canRename && (
          <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Icône</p>
                <p className="text-xs text-slate-400 mt-0.5">Emoji ou image (optionnel)</p>
              </div>
              <UserAvatar
                avatar={iconImageDraft}
                avatarEmoji={iconEmojiDraft.trim() || '👥'}
                size="sm"
                alt="Aperçu icône"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1 text-xs text-slate-500">
                Emoji
                <input
                  type="text"
                  value={iconEmojiDraft}
                  onChange={(e) => setIconEmojiDraft(e.target.value)}
                  placeholder="Ex: 👥"
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>
              <label className="flex-1 text-xs text-slate-500">
                Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => pickIconImage(e.target.files?.[0] ?? null)}
                  className="mt-1 text-sm text-slate-400"
                />
              </label>
            </div>

            {iconImageDraft && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIconImageDraft(null)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Retirer l'image
                </button>
              </div>
            )}

            {iconError && <p className="text-xs text-red-400">{iconError}</p>}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIconEditing(false)
                  setIconError(null)
                }}
                disabled={iconSaving}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void submitIcon()}
                disabled={iconSaving}
                className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
              >
                {iconSaving ? '…' : 'Enregistrer'}
              </button>
            </div>
            </div>
            )}
          </div>
        )}
        {isGroup && (
          <div className="px-3 pb-2 space-y-1 border-t border-slate-800/70">
            {memberIds.length > 0 && (
              <GroupParticipantsPreview
                memberIds={memberIds}
                participantsById={participantsById}
                meId={meId}
              />
            )}
            <AddGroupMembersPanel
              channelId={channelId}
              existingMemberIds={memberIds}
              communityMembers={communityMembers}
              onMembersAdded={onGroupMembersChanged}
            />
          </div>
        )}
      </header>

      <div ref={listRef} className="m-chat-wallpaper min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-1">
        {visibleMessages.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-16">Envoyez le premier message.</p>
        )}
        {visibleMessages.map((msg, index) => {
          const isMe = msg.senderId === meId
          const itemKey = String(msg.id ?? msg.messageId ?? index)
          const sender = resolveSender(msg, isMe)
          const day = chatDayKey(msg.createdAt)
          const prevDay = index > 0 ? chatDayKey(visibleMessages[index - 1]?.createdAt) : ''
          const showDay = day !== '' && day !== prevDay
          const showUnreadBoundary =
            unreadFromId != null && Number(msg.id ?? msg.messageId) === unreadFromId
          return (
            <div key={itemKey}>
              {showUnreadBoundary && (
                <div
                  ref={unreadBoundaryRef}
                  className="flex items-center gap-3 py-3"
                  role="separator"
                  aria-label={
                    unreadCount > 1
                      ? `${unreadCount} messages non lus`
                      : '1 message non lu'
                  }
                >
                  <span className="h-px flex-1 bg-violet-500/80" />
                  <span className="shrink-0 rounded-full bg-violet-600 px-3 py-1 text-[12px] font-semibold text-white">
                    {unreadCount > 1 ? `${unreadCount} messages non lus` : '1 message non lu'}
                  </span>
                  <span className="h-px flex-1 bg-violet-500/80" />
                </div>
              )}
              {showDay && (
                <p className="mx-auto my-2 w-fit rounded-full bg-slate-900/90 px-3 py-1 text-[11px] text-slate-300 shadow-sm">
                  {formatChatDayLabel(msg.createdAt)}
                </p>
              )}
              <MessageBubble
                msg={msg}
                isMe={isMe}
                displayName={sender.displayName}
                avatar={sender.avatar}
                avatarEmoji={sender.avatarEmoji}
                meId={meId}
                showAvatar={isGroup && !isMe}
                showName={isGroup && !isMe}
                highlighted={highlightId != null && Number(msg.id ?? msg.messageId) === highlightId}
                onReact={handleReact}
                onReply={startReply}
                onJumpTo={jumpToMessage}
              />
            </div>
          )
        })}
      </div>

      <div className="m-chat-composer min-w-0 border-t border-slate-800 bg-slate-950/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] space-y-2">
        {replyDraft && (
          <div className="flex items-start gap-2 min-w-0 rounded-xl border-l-4 border-violet-500 bg-slate-900 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-violet-300 leading-tight">{replyDraft.senderName}</p>
              <p className="truncate text-xs text-slate-400">{replyDraft.excerpt || 'Message'}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyDraft(null)}
              className="shrink-0 h-7 w-7 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              aria-label="Annuler la réponse"
              title="Annuler la réponse"
            >
              ×
            </button>
          </div>
        )}
        {file && (
          <div className="flex items-center gap-2 min-w-0 rounded-xl border border-slate-700 bg-slate-950/70 px-2 py-1.5">
            {filePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={filePreview} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
            ) : (
              <span className="shrink-0 text-lg" aria-hidden>📄</span>
            )}
            <span className="min-w-0 flex-1 truncate text-xs text-slate-200">
              {file.name}
              <span className="text-slate-500"> · {formatFileSize(file.size)}</span>
            </span>
            <button
              type="button"
              onClick={clearFile}
              className="shrink-0 text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
            >
              Retirer
            </button>
          </div>
        )}
        {sendError && <p className="text-xs text-red-400">{sendError}</p>}
        <div className="flex gap-2 items-end min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            accept={CHAT_FILE_ACCEPT}
            className="sr-only"
            aria-label="Choisir une photo ou un document"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="shrink-0 h-11 w-11 rounded-full border border-slate-700 text-lg text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            aria-label="Joindre une photo ou un document"
            title="Photo ou document"
          >
            📎
          </button>
          <textarea
            ref={messageInputRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSendText()
              }
            }}
            placeholder="Écrire un message…"
            className="m-chat-input flex-1 min-w-0 w-0 min-h-[44px] px-4 py-2.5 rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500 text-[15px] leading-snug resize-none"
            aria-label="Écrire un message"
          />
          <button
            type="button"
            onClick={() => void handleSendText()}
            disabled={(!input.trim() && !file) || sending}
            className="shrink-0 h-11 w-11 rounded-full bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 disabled:bg-slate-700 inline-flex items-center justify-center"
            aria-label="Envoyer"
          >
            {sending ? <span className="text-sm">…</span> : <SendIcon />}
          </button>
        </div>
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

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3.2 20.8 21 12 3.2 3.2l2.1 7.1L16.2 12l-10.9 1.7-2.1 7.1Z" />
    </svg>
  )
}
