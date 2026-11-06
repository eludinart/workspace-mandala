'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { contentEngagementApi } from '@/api/content-engagement'
import { socialApi } from '@/api/social'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatureDoors } from '@/hooks/useFeatureDoors'
import { ApiError } from '@/lib/api-client'
import {
  contentShareAbsoluteUrl,
  contentShareLabel,
  type ContentEngagementKind,
} from '@/lib/content-share'
import { formatMandalaDate } from '@/lib/format-datetime'
import { MESSAGE_REACTION_EMOJIS, type MessageReactionSummary } from '@/lib/message-reactions'
import type { ContentCommentRow } from '@/lib/db-content-engagement'
import { UserAvatar } from '@/components/UserAvatar'

type ChannelRow = {
  channelId?: number
  id?: number
  name?: string
  otherPseudo?: string
  channelType?: string
}

export function ContentEngagementBar({
  kind,
  targetId,
  placeSlug,
  wallPublic,
  title,
}: {
  kind: ContentEngagementKind
  targetId: number
  placeSlug: string
  wallPublic: boolean
  title?: string
}) {
  const { can, loading: doorsLoading } = useFeatureDoors()
  const { user } = useAuth()
  const meId = Number((user as { id?: number | string } | null)?.id ?? 0)

  const [reactions, setReactions] = useState<MessageReactionSummary[]>([])
  const [comments, setComments] = useState<ContentCommentRow[]>([])
  const [myEmoji, setMyEmoji] = useState<string | null>(null)
  const [canEngage, setCanEngage] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [sendBusyId, setSendBusyId] = useState<number | null>(null)

  const doorOk = !doorsLoading && can('mur_engagement')
  const shareUrl = useMemo(
    () => contentShareAbsoluteUrl(kind, placeSlug, targetId),
    [kind, placeSlug, targetId]
  )
  const shareAllowedExternal = wallPublic

  const load = useCallback(async () => {
    if (!doorOk || !targetId || !placeSlug) {
      setLoaded(true)
      return
    }
    try {
      const bundle = await contentEngagementApi.get(kind, targetId)
      setReactions(bundle.reactions ?? [])
      setComments(bundle.comments ?? [])
      setMyEmoji(bundle.myEmoji)
      setCanEngage(!!bundle.can_engage)
      setErr(null)
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Chargement impossible')
    } finally {
      setLoaded(true)
    }
  }, [doorOk, kind, targetId, placeSlug])

  useEffect(() => {
    setLoaded(false)
    void load()
  }, [load])

  if (doorsLoading || !doorOk) return null
  if (!loaded && !err) {
    return <p className="text-xs text-slate-500 pt-2">…</p>
  }

  const handleReact = async (emoji: string) => {
    if (!canEngage || busy) return
    setBusy(true)
    setErr(null)
    try {
      const res = await contentEngagementApi.toggleReaction(kind, targetId, emoji)
      setReactions(res.reactions ?? [])
      setMyEmoji(res.myEmoji)
      setPickerOpen(false)
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Réaction impossible')
    } finally {
      setBusy(false)
    }
  }

  const handleComment = async () => {
    if (!canEngage || busy || !draft.trim()) return
    setBusy(true)
    setErr(null)
    try {
      const res = await contentEngagementApi.addComment(kind, targetId, draft)
      setComments((prev) => [...prev, res.comment])
      setDraft('')
      setCommentsOpen(true)
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Commentaire impossible')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Supprimer ce commentaire ?')) return
    setBusy(true)
    try {
      await contentEngagementApi.deleteComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Suppression impossible')
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    if (!shareAllowedExternal && !canEngage) {
      setErr('Ce contenu n’est pas sur le mur public.')
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setErr('Copie impossible')
    }
  }

  const nativeShare = async () => {
    if (!shareAllowedExternal) {
      setErr('Partage externe réservé aux contenus sur le mur public.')
      return
    }
    const label = contentShareLabel(kind)
    const text = title?.trim() ? `${title} — ${label} Mandala` : `${label} Mandala`
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: text, text, url: shareUrl })
        return
      } catch {
        /* annulé */
      }
    }
    await copyLink()
  }

  const openSharePanel = async () => {
    setShareOpen((v) => !v)
    if (channels.length || channelsLoading || !canEngage) return
    setChannelsLoading(true)
    try {
      const res = (await socialApi.getMyChannels(placeSlug)) as { channels?: ChannelRow[] }
      setChannels(res.channels ?? [])
    } catch {
      setChannels([])
    } finally {
      setChannelsLoading(false)
    }
  }

  const sendToChannel = async (channelId: number) => {
    if (!canEngage || sendBusyId) return
    setSendBusyId(channelId)
    setErr(null)
    const label = contentShareLabel(kind)
    const body = title?.trim()
      ? `À voir : ${title}\n${shareUrl}`
      : `À voir — ${label} Mandala\n${shareUrl}`
    try {
      await socialApi.sendMessage(String(channelId), { body })
      setShareOpen(false)
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Envoi impossible')
    } finally {
      setSendBusyId(null)
    }
  }

  return (
    <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-2" onClick={(e) => e.stopPropagation()}>
      {err && <p className="text-xs text-red-400">{err}</p>}

      {reactions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {reactions.map((r) => (
            <ReactionChip
              key={r.emoji}
              reaction={r}
              active={meId > 0 && r.userIds.includes(meId)}
              meId={meId > 0 ? meId : null}
              onToggle={() => void handleReact(r.emoji)}
              disabled={!canEngage || busy}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {canEngage && (
          <>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="h-8 px-2.5 rounded-full text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800/80"
              aria-expanded={pickerOpen}
              title="Réagir"
            >
              😊 Réagir
            </button>
            <button
              type="button"
              onClick={() => setCommentsOpen((v) => !v)}
              className="h-8 px-2.5 rounded-full text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800/80"
              aria-expanded={commentsOpen}
            >
              💬 {comments.length > 0 ? comments.length : 'Commenter'}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => void openSharePanel()}
          className="h-8 px-2.5 rounded-full text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800/80"
          aria-expanded={shareOpen}
        >
          Partager
        </button>
      </div>

      {pickerOpen && canEngage && (
        <div className="flex flex-wrap gap-0.5 p-1 rounded-full border border-slate-700 bg-slate-900 w-fit">
          {MESSAGE_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              disabled={busy}
              onClick={() => void handleReact(emoji)}
              className={`w-8 h-8 rounded-full text-base hover:bg-slate-800 transition-colors ${
                myEmoji === emoji ? 'bg-violet-600/30 ring-1 ring-violet-400' : ''
              }`}
              title={`Réagir ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {shareOpen && (
        <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-3 space-y-2">
          <p className="text-xs text-slate-400 break-all">{shareUrl}</p>
          {!shareAllowedExternal && (
            <p className="text-[11px] text-amber-200/90">
              Contenu privé : le lien ouvre l’app pour les membres. Pas de partage public tant que
              « mur public » est désactivé.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              {copied ? 'Copié' : 'Copier le lien'}
            </button>
            {shareAllowedExternal && (
              <button
                type="button"
                onClick={() => void nativeShare()}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                Partager…
              </button>
            )}
          </div>
          {canEngage && (
            <div className="pt-1 space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Envoyer dans une conversation
              </p>
              {channelsLoading && <p className="text-xs text-slate-500">Chargement…</p>}
              {!channelsLoading && channels.length === 0 && (
                <p className="text-xs text-slate-500 italic">Aucune conversation pour l’instant.</p>
              )}
              <ul className="max-h-36 overflow-y-auto space-y-1">
                {channels.map((ch) => {
                  const id = Number(ch.channelId ?? ch.id ?? 0)
                  if (!id) return null
                  const label = ch.name || ch.otherPseudo || `Conversation #${id}`
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        disabled={sendBusyId === id}
                        onClick={() => void sendToChannel(id)}
                        className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-200 hover:border-violet-500/40 disabled:opacity-50"
                      >
                        {sendBusyId === id ? 'Envoi…' : label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {commentsOpen && (
        <div className="space-y-2">
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {comments.length === 0 && (
              <li className="text-xs text-slate-500 italic">Aucun commentaire pour l’instant.</li>
            )}
            {comments.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <UserAvatar
                  avatar={c.author_avatar}
                  avatarEmoji={c.author_avatar_emoji}
                  size="sm"
                  alt={c.author_pseudo}
                />
                <div className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-slate-100">{c.author_pseudo}</span>
                    <span className="text-[10px] text-slate-500">
                      {formatMandalaDate(c.created_at)}
                    </span>
                    {(meId === c.author_id || canEngage) && meId === c.author_id && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteComment(c.id)}
                        className="ml-auto text-[11px] text-red-400/90 hover:text-red-300"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap mt-1 leading-relaxed">
                    {c.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {canEngage && (
            <div className="flex gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleComment()
                  }
                }}
                maxLength={2000}
                placeholder="Écrire un commentaire…"
                className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
              />
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => void handleComment()}
                className="shrink-0 px-3 py-2 rounded-xl bg-violet-700/80 text-sm text-white hover:bg-violet-600 disabled:opacity-50"
              >
                Envoyer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function reactionNamesLabel(reaction: MessageReactionSummary, meId: number | null): string {
  const names =
    reaction.users?.map((u) =>
      meId != null && u.id === meId ? 'Vous' : u.display_name
    ) ?? reaction.userIds.map((id) => (meId != null && id === meId ? 'Vous' : `Membre #${id}`))
  return names.join(', ')
}

function ReactionChip({
  reaction,
  active,
  meId,
  onToggle,
  disabled,
}: {
  reaction: MessageReactionSummary
  active: boolean
  meId: number | null
  onToggle: () => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const count = reaction.userIds.length
  const namesLabel = reactionNamesLabel(reaction, meId)

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        title={namesLabel}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 h-7 px-2 rounded-full border text-sm transition-colors ${
          active
            ? 'border-violet-500/50 bg-violet-950/50 text-violet-100'
            : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500'
        } disabled:opacity-50`}
        aria-label={`${reaction.emoji} : ${namesLabel}`}
      >
        <span aria-hidden>{reaction.emoji}</span>
        <span className="text-xs tabular-nums">{count}</span>
      </button>
      {open && (
        <div className="absolute z-20 left-0 top-full mt-1 min-w-[10rem] max-w-[16rem] rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
          <p className="text-[11px] text-slate-400 mb-1.5">
            {reaction.emoji} · {count} réaction{count > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-slate-200 leading-snug">{namesLabel}</p>
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onToggle()
              }}
              className="mt-2 text-[11px] text-violet-300 hover:text-violet-200"
            >
              {active ? 'Retirer ma réaction' : 'Réagir aussi'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
