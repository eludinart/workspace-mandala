'use client'

import { useCallback, useEffect, useState } from 'react'
import { postsApi, type CommunityPost } from '@/api/posts'
import type { PostType } from '@/lib/db-posts'
import { useCommunity } from '@/contexts/CommunityContext'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api-client'
import { formatMandalaDate } from '@/lib/format-datetime'
import { UserAvatar } from '@/components/UserAvatar'
import { FeedSection } from '@/components/community/FeedSection'

export function AgoraFeed() {
  const { active } = useCommunity()
  const { user } = useAuth()
  const u = user as {
    id?: number
    pseudo?: string
    name?: string
    avatar?: string
    avatar_emoji?: string
  } | null
  const myId = u?.id ?? null
  const myPseudo = u?.pseudo || u?.name
  const myAvatar = u?.avatar
  const myAvatarEmoji = u?.avatar_emoji
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [postType, setPostType] = useState<PostType>('inspiration')
  const [submitting, setSubmitting] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!active?.id) {
      setPosts([])
      setCanManage(false)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await postsApi.list(active.id, 20)
      setPosts(res.posts ?? [])
      setCanManage(!!res.can_manage)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [active?.id])

  useEffect(() => {
    void load()
  }, [load])

  const publish = async () => {
    if (!active?.id || !draft.trim()) return
    setSubmitting(true)
    setMsg(null)
    setError(null)
    try {
      await postsApi.create({
        community_id: active.id,
        type: postType,
        content: draft.trim(),
      })
      setDraft('')
      setComposerOpen(false)
      setMsg('Brève publiée')
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const removePost = async (postId: number) => {
    if (!canManage) return
    if (!window.confirm('Retirer cette brève du point infos ?')) return
    setRemovingId(postId)
    setMsg(null)
    setError(null)
    try {
      await postsApi.remove(postId)
      setMsg('Brève retirée')
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
    } finally {
      setRemovingId(null)
    }
  }

  if (!active) {
    return (
      <p className="text-sm text-slate-500 italic">Choisissez une communauté pour voir l&apos;Agora.</p>
    )
  }

  return (
    <FeedSection
      icon="💬"
      title="L'Agora"
      subtitle={`Le mur de ${active.name}${canManage ? ' · modération activée' : ''}`}
      tone="slate"
    >
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <UserAvatar
            avatar={myAvatar}
            avatarEmoji={myAvatarEmoji}
            size="md"
            alt={myPseudo ?? 'Vous'}
          />
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="flex-1 text-left rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-base text-slate-400 hover:bg-slate-900 transition-colors"
          >
            Quoi de neuf, {myPseudo ?? 'ami(e)'} ?
          </button>
        </div>

        {(composerOpen || draft) && (
          <div className="space-y-3 pt-1 border-t border-slate-800">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPostType('inspiration')}
                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  postType === 'inspiration'
                    ? 'border-amber-600/60 bg-amber-950/40 text-amber-200'
                    : 'border-slate-700 text-slate-500'
                }`}
              >
                ✨ Inspiration
              </button>
              <button
                type="button"
                onClick={() => setPostType('logistics')}
                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  postType === 'logistics'
                    ? 'border-violet-600/60 bg-violet-950/40 text-violet-200'
                    : 'border-slate-700 text-slate-500'
                }`}
              >
                📋 Logistique
              </button>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={2000}
              autoFocus
              placeholder={
                postType === 'logistics'
                  ? 'Horaires, lieu, consignes pratiques…'
                  : 'Une pensée, une nouvelle, une inspiration…'
              }
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-base resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting || !draft.trim()}
                onClick={() => void publish()}
                className="text-sm font-medium px-5 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {submitting ? 'Publication…' : 'Publier'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setComposerOpen(false)
                  setDraft('')
                }}
                className="text-sm text-slate-500 hover:text-slate-300 px-3 py-2"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {msg && <p className="text-sm text-emerald-400">{msg}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {loading && <p className="text-sm text-slate-500">Chargement du mur…</p>}
      {!loading && posts.length === 0 && (
        <p className="text-base text-slate-500 italic text-center py-4">
          Aucune publication pour le moment. Soyez le premier à partager.
        </p>
      )}

      <ul className="space-y-4">
        {posts.map((p) => (
          <li
            key={p.id}
            className={`rounded-xl border bg-slate-900/50 p-5 shadow-sm shadow-black/10 ${
              p.type === 'logistics' ? 'border-violet-800/50' : 'border-amber-800/40'
            }`}
          >
            <div className="flex items-start gap-3">
              <UserAvatar
                avatar={p.author_avatar}
                avatarEmoji={p.author_avatar_emoji}
                size="md"
                alt={p.author_pseudo}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-base text-slate-100">{p.author_pseudo}</span>
                  {myId === p.author_id && (
                    <span className="text-sm text-violet-400">(vous)</span>
                  )}
                  <span className="text-slate-600">·</span>
                  <span className="text-sm text-slate-400">{formatMandalaDate(p.created_at)}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${
                      p.type === 'logistics'
                        ? 'bg-violet-950/60 text-violet-300'
                        : 'bg-amber-950/50 text-amber-300'
                    }`}
                  >
                    {p.type === 'logistics' ? 'Logistique' : 'Inspiration'}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      disabled={removingId === p.id}
                      onClick={() => void removePost(p.id)}
                      className="ml-auto text-sm text-red-400/90 hover:text-red-300 disabled:opacity-50"
                      title="Retirer du mur"
                    >
                      {removingId === p.id ? '…' : 'Retirer'}
                    </button>
                  )}
                </div>
                <p className="text-base text-slate-200 mt-3 whitespace-pre-wrap leading-relaxed">
                  {p.content}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </FeedSection>
  )
}
