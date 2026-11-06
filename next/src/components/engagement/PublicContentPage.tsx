'use client'

import Link from 'next/link'
import { contentShareAbsoluteUrl, type ContentEngagementKind } from '@/lib/content-share'
import { formatEventDateRange } from '@/lib/event-preview'
import { ContentEngagementBar } from '@/components/engagement/ContentEngagementBar'

export type PublicContentSnapshot = {
  kind: ContentEngagementKind
  id: number
  title: string
  body: string
  place: {
    slug: string
    name: string
    logo_emoji: string | null
    accent_color: string | null
  }
  starts_at?: string | null
  ends_at?: string | null
  image_data?: string | null
}

export function PublicContentPage({ snapshot }: { snapshot: PublicContentSnapshot }) {
  const shareUrl = contentShareAbsoluteUrl(snapshot.kind, snapshot.place.slug, snapshot.id)
  const kindLabel =
    snapshot.kind === 'event'
      ? 'Événement'
      : snapshot.kind === 'announcement'
        ? 'Annonce'
        : 'Agora'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      /* ignore */
    }
  }

  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: snapshot.title,
          text: `${snapshot.title} · ${snapshot.place.name}`,
          url: shareUrl,
        })
        return
      } catch {
        /* annulé */
      }
    }
    await copy()
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <p className="text-[11px] uppercase tracking-widest text-slate-500">
          {kindLabel} · {snapshot.place.logo_emoji || '🏛️'} {snapshot.place.name}
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-50 leading-tight">
          {snapshot.title}
        </h1>
        {snapshot.kind === 'event' && (snapshot.starts_at || snapshot.ends_at) && (
          <p className="text-sm text-slate-300">
            {formatEventDateRange(snapshot.starts_at ?? null, snapshot.ends_at ?? null)}
          </p>
        )}
        {snapshot.image_data && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={snapshot.image_data}
            alt=""
            className="w-full max-h-72 object-cover rounded-2xl border border-slate-800"
          />
        )}
        {snapshot.body && (
          <p className="text-base text-slate-300 whitespace-pre-wrap leading-relaxed">
            {snapshot.body}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void nativeShare()}
            className="px-3 py-2 rounded-xl border border-slate-700 text-sm text-slate-200 hover:bg-slate-900"
          >
            Partager…
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="px-3 py-2 rounded-xl border border-slate-700 text-sm text-slate-200 hover:bg-slate-900"
          >
            Copier le lien
          </button>
          <Link
            href={`/lieux/${encodeURIComponent(snapshot.place.slug)}`}
            className="px-3 py-2 rounded-xl border border-violet-700/50 bg-violet-950/40 text-sm text-violet-100 hover:bg-violet-900/40"
          >
            Voir le lieu
          </Link>
          <Link
            href="/app"
            className="px-3 py-2 rounded-xl bg-violet-700/80 text-sm text-white hover:bg-violet-600"
          >
            Ouvrir Mandala
          </Link>
        </div>

        <ContentEngagementBar
          kind={snapshot.kind}
          targetId={snapshot.id}
          placeSlug={snapshot.place.slug}
          wallPublic
          title={snapshot.title}
        />
      </div>
    </main>
  )
}

export function PublicContentLocked({
  placeSlug,
  placeName,
}: {
  placeSlug?: string | null
  placeName?: string | null
}) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">Contenu réservé aux membres</h1>
        <p className="text-sm text-slate-400">
          Ce lien n’est pas public. Connectez-vous ou rejoignez
          {placeName ? ` ${placeName}` : ' le lieu'} pour le voir.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/app"
            className="px-3 py-2 rounded-xl bg-violet-700/80 text-sm text-white hover:bg-violet-600"
          >
            Se connecter
          </Link>
          {placeSlug && (
            <Link
              href={`/lieux/${encodeURIComponent(placeSlug)}`}
              className="px-3 py-2 rounded-xl border border-slate-700 text-sm text-slate-200"
            >
              Voir le lieu
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
