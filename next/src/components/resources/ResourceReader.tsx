'use client'

import { resourceMediaUrl, type ResourceDetail } from '@/api/resources'
import { resourceKindMeta } from '@/lib/resource-constants'

export function ResourceReader({
  resource,
  onClose,
}: {
  resource: ResourceDetail
  onClose: () => void
}) {
  const meta = resourceKindMeta(resource.kind)
  const fileUrl = resource.has_file ? resourceMediaUrl(resource.id, 'file') : null
  const coverUrl = resource.has_cover ? resourceMediaUrl(resource.id, 'cover') : null
  const mime = resource.file_mime ?? ''

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950 text-slate-100 flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
        <button type="button" onClick={onClose} className="text-sm text-slate-300">
          Fermer
        </button>
        <p className="text-xs uppercase tracking-[0.16em] text-violet-300">{meta.label}</p>
        {resource.downloadable && fileUrl ? (
          <a
            href={resourceMediaUrl(resource.id, 'file', { download: true })}
            className="text-sm text-violet-300"
          >
            Télécharger
          </a>
        ) : (
          <span className="w-16" />
        )}
      </header>
      <div className="flex-1 overflow-y-auto">
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="w-full max-h-72 object-cover bg-slate-900" />
        )}
        <article className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <h1 className="text-2xl font-semibold">{resource.title}</h1>
          <p className="text-sm text-slate-400">
            {resource.author_avatar_emoji} {resource.author_pseudo}
          </p>
          {resource.summary && <p className="text-slate-300">{resource.summary}</p>}
          {meta.mode === 'text' && resource.body_text && (
            <div className="whitespace-pre-wrap leading-relaxed text-slate-100">{resource.body_text}</div>
          )}
          {resource.image_ids.map((imageId) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={imageId}
              src={resourceMediaUrl(resource.id, 'image', { imageId })}
              alt=""
              className="w-full rounded-xl bg-slate-900"
            />
          ))}
          {fileUrl && mime.startsWith('video/') && (
            <video src={fileUrl} controls className="w-full rounded-xl bg-black" playsInline />
          )}
          {fileUrl && mime.startsWith('audio/') && <audio src={fileUrl} controls className="w-full" />}
          {fileUrl && mime === 'application/pdf' && (
            <iframe title={resource.title} src={fileUrl} className="w-full h-[70vh] rounded-xl bg-white" />
          )}
          {fileUrl && mime.startsWith('image/') && !coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt="" className="w-full rounded-xl" />
          )}
        </article>
      </div>
    </div>
  )
}
