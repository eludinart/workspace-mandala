'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { postsApi, type CommunityPost } from '@/api/posts'
import type { PostType } from '@/lib/db-posts'
import { useCommunity } from '@/contexts/CommunityContext'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api-client'
import { compressFeedImage, imageFileFromDataTransfer } from '@/lib/compress-feed-image'
import { formatMandalaDate } from '@/lib/format-datetime'
import { UserAvatar } from '@/components/UserAvatar'
import { ExplainCard } from '@/components/help/ExplainCard'
import { FeedSection } from '@/components/community/FeedSection'
import { WallPublicBadge, WallPublicToggle } from '@/components/wall/WallPublicToggle'
import { ReportContentDialog } from '@/components/moderation/ReportContentDialog'
import { ContentEngagementBar } from '@/components/engagement/ContentEngagementBar'

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
  const [wallPublic, setWallPublic] = useState(false)
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [wallPublicBusyId, setWallPublicBusyId] = useState<number | null>(null)
  const [reportPostId, setReportPostId] = useState<number | null>(null)
  const [reportAuthorId, setReportAuthorId] = useState<number | undefined>(undefined)

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

  const pickImage = useCallback(async (file: File | null) => {
    if (!file) return
    setComposerOpen(true)
    setImageBusy(true)
    setError(null)
    setMsg(null)
    try {
      const res = await compressFeedImage(file)
      if (res.error || !res.dataUrl) {
        setError(res.error || 'Impossible de préparer l’image')
        return
      }
      setImageData(res.dataUrl)
    } catch {
      setError('Impossible de préparer l’image')
    } finally {
      setImageBusy(false)
    }
  }, [])

  const resetComposer = () => {
    setComposerOpen(false)
    setDraft('')
    setWallPublic(false)
    setImageData(null)
    setDragOver(false)
  }

  const canPublish = Boolean(draft.trim() || imageData)

  const publish = async () => {
    if (!active?.id || !canPublish || imageBusy) return
    setSubmitting(true)
    setMsg(null)
    setError(null)
    try {
      await postsApi.create({
        community_id: active.id,
        type: postType,
        content: draft.trim(),
        wall_public: canManage ? wallPublic : false,
        image_data: imageData,
      })
      resetComposer()
      setMsg('Brève publiée')
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleWallPublic = async (postId: number, next: boolean) => {
    if (!canManage) return
    setWallPublicBusyId(postId)
    setMsg(null)
    setError(null)
    try {
      await postsApi.update(postId, { wall_public: next })
      setMsg(next ? 'Brève visible sur le mur public' : 'Brève retirée du mur public')
      await load()
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
    } finally {
      setWallPublicBusyId(null)
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
    <div className="space-y-3">
    <ExplainCard screen="agora" />
    <FeedSection
      icon="💬"
      title="L'Agora"
      subtitle={`Le mur de ${active.name}${canManage ? ' · modération activée' : ''}`}
      tone="slate"
    >
      <div className="m-user-form rounded-xl border border-slate-700/80 bg-slate-900/60 p-4 space-y-3">
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

        {(composerOpen || draft || imageData) && (
          <div
            className={`space-y-3 pt-1 border-t border-slate-800 rounded-xl transition-colors ${
              dragOver ? 'bg-violet-950/30 ring-2 ring-violet-500/50' : ''
            }`}
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOver(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOver(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (e.currentTarget.contains(e.relatedTarget as Node)) return
              setDragOver(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOver(false)
              const file = imageFileFromDataTransfer(e.dataTransfer)
              void pickImage(file)
            }}
          >
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
              onPaste={(e) => {
                const file = imageFileFromDataTransfer(e.clipboardData)
                if (!file) return
                e.preventDefault()
                void pickImage(file)
              }}
              rows={3}
              maxLength={2000}
              autoFocus
              placeholder={
                postType === 'logistics'
                  ? 'Horaires, lieu, consignes pratiques… (Ctrl+V pour coller une image)'
                  : 'Une pensée, une nouvelle… (Ctrl+V ou glisser une image)'
              }
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-base resize-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  e.target.value = ''
                  void pickImage(f)
                }}
              />
              <button
                type="button"
                disabled={submitting || imageBusy}
                onClick={() => fileRef.current?.click()}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {imageBusy ? 'Préparation…' : imageData ? 'Changer l’image' : 'Ajouter une image'}
              </button>
              {imageData && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setImageData(null)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Retirer l’image
                </button>
              )}
              <span className="text-[11px] text-slate-500">
                Coller, glisser-déposer, ou choisir un fichier
              </span>
            </div>
            {imageData && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageData}
                alt=""
                className="w-full max-h-48 rounded-xl border border-slate-800 object-cover"
              />
            )}
            {canManage && (
              <WallPublicToggle
                id="wall-public-agora-compose"
                checked={wallPublic}
                onChange={setWallPublic}
                disabled={submitting}
              />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting || imageBusy || !canPublish}
                onClick={() => void publish()}
                className="text-sm font-medium px-5 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {submitting ? 'Publication…' : 'Publier'}
              </button>
              <button
                type="button"
                onClick={resetComposer}
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
                  <WallPublicBadge public={p.wall_public} />
                  <div className="ml-auto flex items-center gap-2">
                    {myId !== p.author_id && (
                      <button
                        type="button"
                        onClick={() => {
                          setReportPostId(p.id)
                          setReportAuthorId(p.author_id)
                        }}
                        className="text-sm text-slate-500 hover:text-amber-300"
                        title="Signaler"
                      >
                        Signaler
                      </button>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        disabled={removingId === p.id}
                        onClick={() => void removePost(p.id)}
                        className="text-sm text-red-400/90 hover:text-red-300 disabled:opacity-50"
                        title="Retirer du mur"
                      >
                        {removingId === p.id ? '…' : 'Retirer'}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-base text-slate-200 mt-3 whitespace-pre-wrap leading-relaxed">
                  {p.content}
                </p>
                {p.image_data && (
                  <button
                    type="button"
                    onClick={() => setLightbox(p.image_data)}
                    className="mt-3 block w-full overflow-hidden rounded-xl border border-slate-800 hover:border-violet-500/40 transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_data}
                      alt=""
                      className="w-full max-h-72 object-cover aspect-[16/10] bg-slate-950"
                    />
                  </button>
                )}
                {canManage && (
                  <div className="mt-3">
                    <WallPublicToggle
                      id={`wall-public-post-${p.id}`}
                      checked={p.wall_public}
                      disabled={wallPublicBusyId === p.id}
                      onChange={(next) => void toggleWallPublic(p.id, next)}
                    />
                  </div>
                )}
                {active?.slug && (
                  <ContentEngagementBar
                    kind="post"
                    targetId={p.id}
                    placeSlug={active.slug}
                    wallPublic={p.wall_public}
                    title={p.content.slice(0, 80)}
                  />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <ReportContentDialog
        open={reportPostId != null}
        onClose={() => {
          setReportPostId(null)
          setReportAuthorId(undefined)
        }}
        targetType="post"
        targetId={reportPostId ?? 0}
        targetUserId={reportAuthorId}
        communityId={active?.id}
        title="Signaler une publication"
      />
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}
    </FeedSection>
    </div>
  )
}
