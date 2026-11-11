'use client'

import Link from 'next/link'
import type { ResourceDetail } from '@/api/resources'
import { resourceMediaUrl } from '@/api/resources'
import { PublicSiteChrome } from '@/components/landing/PublicSiteChrome'
import { ResourceShare } from '@/components/resources/ResourceShare'
import { resourceDefaultCoverUrl } from '@/lib/resource-covers'
import { resourceKindMeta } from '@/lib/resource-constants'
import { useAuth } from '@/contexts/AuthContext'

export function PublicResourcePage({ resource }: { resource: ResourceDetail }) {
  const { user, loading: authLoading } = useAuth()
  const meta = resourceKindMeta(resource.kind)
  const fileUrl = resource.has_file ? resourceMediaUrl(resource.id, 'file') : null
  const coverUrl = resource.has_cover
    ? resourceMediaUrl(resource.id, 'cover')
    : resourceDefaultCoverUrl(resource.kind)
  const mime = resource.file_mime ?? ''

  return (
    <PublicSiteChrome user={user} authLoading={authLoading}>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">
        <nav className="text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-300">
            Accueil
          </Link>
          <span className="mx-1.5">/</span>
          <Link href="/ressources" className="hover:text-slate-300">
            Ressources
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-400">{resource.title}</span>
        </nav>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="" className="w-full max-h-72 object-cover rounded-2xl bg-slate-900" />

        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-violet-300">{meta.label}</p>
          <h1 className="text-3xl font-semibold text-slate-50">{resource.title}</h1>
          <p className="text-sm text-slate-400">
            {resource.author_avatar_emoji} {resource.author_pseudo}
          </p>
        </header>

        <ResourceShare
          resourceId={resource.id}
          title={resource.title}
          canSharePublic
          heading="Partager cette ressource"
        />

        {resource.summary && <p className="text-slate-300 leading-relaxed">{resource.summary}</p>}

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
        {fileUrl && mime.startsWith('image/') && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl} alt="" className="w-full rounded-xl" />
        )}

        {resource.downloadable && fileUrl && (
          <a
            href={resourceMediaUrl(resource.id, 'file', { download: true })}
            className="inline-flex rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            Télécharger
          </a>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/app"
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            Ouvrir Mandala
          </Link>
          <Link
            href="/ressources"
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-violet-600"
          >
            Toute la bibliothèque
          </Link>
        </div>
      </main>
    </PublicSiteChrome>
  )
}
