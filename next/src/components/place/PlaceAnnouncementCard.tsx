'use client'

import { useRef, useState } from 'react'
import type { PlaceAnnouncement } from '@/api/place-announcements'
import { formatMandalaDate } from '@/lib/format-datetime'
import { UserAvatar } from '@/components/UserAvatar'
import { WallPublicBadge, WallPublicToggle } from '@/components/wall/WallPublicToggle'

export function PlaceAnnouncementCard({
  announcement,
  canManage,
  onEdit,
  onDelete,
  onWallPublicChange,
  wallPublicBusy,
  deleting,
}: {
  announcement: PlaceAnnouncement
  canManage?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onWallPublicChange?: (next: boolean) => void | Promise<void>
  wallPublicBusy?: boolean
  deleting?: boolean
}) {
  const [lightbox, setLightbox] = useState(false)

  return (
    <article className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <UserAvatar
            avatar={announcement.author_avatar}
            avatarEmoji={announcement.author_avatar_emoji}
            size="sm"
            alt={announcement.author_pseudo}
          />
          <div className="min-w-0">
            <p className="text-xs text-slate-400">
              Publié par{' '}
              <span className="text-slate-200 font-medium">{announcement.author_pseudo}</span>
            </p>
            <p className="text-[10px] text-slate-500">
              {formatMandalaDate(announcement.created_at)}
              {announcement.updated_at && announcement.updated_at !== announcement.created_at && (
                <span className="ml-1">· modifié</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 shrink-0 justify-end">
          <WallPublicBadge public={announcement.wall_public} />
          {canManage && (onEdit || onDelete) && (
            <>
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Modifier
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="text-[11px] px-2 py-1 rounded-lg border border-red-900/50 text-red-400 hover:bg-red-950/40 disabled:opacity-50"
              >
                {deleting ? '…' : 'Supprimer'}
              </button>
            )}
          </>
        )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-100 leading-snug">{announcement.title}</h3>
        <p className="text-base text-slate-300 leading-relaxed whitespace-pre-wrap mt-2">
          {announcement.body}
        </p>
      </div>

      {announcement.image_data && (
        <>
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="block w-full rounded-xl overflow-hidden border border-slate-800 hover:border-amber-500/30 transition-colors"
          >
            <img
              src={announcement.image_data}
              alt=""
              className="w-full max-h-64 object-cover"
            />
          </button>
          {lightbox && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              role="dialog"
              aria-modal
              onClick={() => setLightbox(false)}
            >
              <img
                src={announcement.image_data}
                alt=""
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            </div>
          )}
        </>
      )}

      {canManage && onWallPublicChange && (
        <WallPublicToggle
          id={`wall-public-announcement-${announcement.id}`}
          checked={announcement.wall_public}
          disabled={wallPublicBusy}
          onChange={(next) => void onWallPublicChange(next)}
        />
      )}
    </article>
  )
}

export function AnnouncementEditorForm({
  initialTitle = '',
  initialBody = '',
  initialImage = null as string | null,
  initialWallPublic = false,
  showWallPublic = true,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  initialTitle?: string
  initialBody?: string
  initialImage?: string | null
  initialWallPublic?: boolean
  showWallPublic?: boolean
  submitLabel: string
  busy?: boolean
  onSubmit: (data: {
    title: string
    body: string
    image_data: string | null
    wall_public: boolean
  }) => void | Promise<void>
  onCancel?: () => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [image, setImage] = useState<string | null>(initialImage)
  const [wallPublic, setWallPublic] = useState(initialWallPublic)
  const fileRef = useRef<HTMLInputElement>(null)

  const pickImage = (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setImage(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void onSubmit({ title: title.trim(), body: body.trim(), image_data: image, wall_public: wallPublic })
      }}
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de l'annonce"
        maxLength={255}
        className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-sm"
        required
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Message pour les membres du lieu…"
        rows={4}
        maxLength={8000}
        className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-sm resize-y min-h-[100px]"
        required
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          {image ? 'Changer l\'image' : 'Ajouter une image'}
        </button>
        {image && (
          <button
            type="button"
            onClick={() => setImage(null)}
            className="text-xs text-red-400 hover:underline"
          >
            Retirer l'image
          </button>
        )}
      </div>
      {image && (
        <img src={image} alt="" className="max-h-40 rounded-lg border border-slate-800 object-cover" />
      )}
      {showWallPublic && (
        <WallPublicToggle
          id="wall-public-announcement-editor"
          checked={wallPublic}
          onChange={setWallPublic}
          disabled={busy}
        />
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !title.trim() || !body.trim()}
          className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-50"
        >
          {busy ? 'Enregistrement…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  )
}
