'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSocialStore, type ChannelMessage } from '@/store/useSocialStore'
import { socialApi } from '@/api/social'
import { TemperatureIndicator } from './TemperatureIndicator'
import { GroupParticipantsPreview } from './GroupParticipantsPreview'
import { AddGroupMembersPanel } from './AddGroupMembersPanel'
import { MessageBubble } from './MessageBubble'
import { UserAvatar } from '@/components/UserAvatar'
import type { CommunityMember } from '@/api/members'

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
    temperatureByChannel,
    loadChannelMessages,
    sendMessage,
    toggleMessageReaction,
    markChannelRead,
  } = useSocialStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
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
  const listRef = useRef<HTMLDivElement>(null)

  const messages = messagesByChannel[String(channelId)] || []
  const visibleMessages = [...messages, ...pendingMessages]
  const temperature = temperatureByChannel[String(channelId)] || 'calm'
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

  useEffect(() => {
    if (!channelId) return
    let inFlight = false
    const refresh = async () => {
      if (inFlight) return
      inFlight = true
      try {
        await loadChannelMessages(channelId)
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
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [channelId, loadChannelMessages, markChannelRead])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [channelId])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    requestAnimationFrame(() => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      if (nearBottom) el.scrollTop = el.scrollHeight
    })
  }, [visibleMessages.length])

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

  const handleSendText = async () => {
    const text = input.trim()
    if (!text || sending) return
    const tempId = `tmp-${Date.now()}`
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
      },
    ])
    setInput('')
    setSending(true)
    try {
      await sendMessage(channelId, { body: text })
    } finally {
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

  return (
    <div className="flex-1 min-h-[min(70vh,600px)] flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <header className="shrink-0 px-3 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <TemperatureIndicator temperature={temperature} className="shrink-0" />
          <UserAvatar
            avatar={otherAvatar}
            avatarEmoji={otherAvatarEmoji ?? (isGroup ? '👥' : undefined)}
            size="sm"
            alt={otherPseudo}
          />
          {!isGroup && (
            <span
              className={`inline-block w-2 h-2 rounded-full shrink-0 ${otherIsOnline ? 'bg-emerald-500' : 'bg-slate-500'}`}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitRename()
                      if (e.key === 'Escape') setEditingName(false)
                    }}
                    autoFocus
                    className="min-w-0 flex-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm"
                    aria-label="Nom du groupe"
                  />
                  <button
                    type="button"
                    onClick={() => void submitRename()}
                    disabled={renaming}
                    className="px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-50"
                    aria-label="Enregistrer le nom"
                  >
                    {renaming ? '…' : 'OK'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingName(false)}
                    disabled={renaming}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 disabled:opacity-50"
                    aria-label="Annuler"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium truncate block flex-1 min-w-0">
                    {otherPseudo || 'Dialogue'}
                  </span>
                  {canRename && !iconEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingName(true)
                          setIconEditing(false)
                        }}
                        className="px-2 py-1 rounded-lg border border-slate-700 text-slate-300 text-[11px] hover:bg-slate-800"
                        aria-label="Renommer le groupe"
                        title="Renommer"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIconEditing(true)
                          setEditingName(false)
                        }}
                        className="px-2 py-1 rounded-lg border border-slate-700 text-slate-300 text-[11px] hover:bg-slate-800"
                        aria-label="Modifier l'icône du groupe"
                        title="Icône"
                      >
                        🖼️
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <span className="text-[11px] text-slate-500">
              {isGroup
                ? `${memberCount ?? (memberIds.length || Object.keys(participantsById).length)} participants`
                : otherIsOnline
                  ? 'En ligne'
                  : 'Hors ligne'}
            </span>
            {renameError && <span className="text-[11px] text-red-400 block mt-0.5">{renameError}</span>}
          </div>
        </div>
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
        {isGroup && memberIds.length > 0 && (
          <>
            <GroupParticipantsPreview
              memberIds={memberIds}
              participantsById={participantsById}
              meId={meId}
            />
            <AddGroupMembersPanel
              channelId={channelId}
              existingMemberIds={memberIds}
              communityMembers={communityMembers}
              onMembersAdded={onGroupMembersChanged}
            />
          </>
        )}
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-4 min-h-0">
        {visibleMessages.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">Envoyez le premier message.</p>
        )}
        {visibleMessages.map((msg, index) => {
          const isMe = msg.senderId === meId
          const itemKey = String(msg.id ?? msg.messageId ?? index)
          const sender = resolveSender(msg, isMe)
          return (
            <MessageBubble
              key={itemKey}
              msg={msg}
              isMe={isMe}
              displayName={sender.displayName}
              avatar={sender.avatar}
              avatarEmoji={sender.avatarEmoji}
              meId={meId}
              onReact={handleReact}
            />
          )
        })}
      </div>

      <div className="shrink-0 p-3 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void handleSendText()}
          placeholder="Écrire un message…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder-slate-500 text-sm"
        />
        <button
          type="button"
          onClick={() => void handleSendText()}
          disabled={!input.trim() || sending}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
        >
          {sending ? '…' : 'Envoyer'}
        </button>
      </div>
    </div>
  )
}
