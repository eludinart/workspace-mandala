import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicContentSnapshot } from '@/lib/db-content-engagement'
import {
  PublicContentLocked,
  PublicContentPage,
} from '@/components/engagement/PublicContentPage'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string; id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, id } = await params
  const snap = await getPublicContentSnapshot('post', Number(id), slug).catch(() => null)
  if (!snap) return { title: 'Publication' }
  return {
    title: snap.title,
    description: snap.body.slice(0, 160) || `Agora · ${snap.place.name}`,
    openGraph: {
      title: `${snap.title} · Mandala`,
      description: snap.body.slice(0, 160) || snap.place.name,
      type: 'article',
    },
  }
}

export default async function PublicAgoraPostPage({ params }: Params) {
  const { slug, id } = await params
  const targetId = Number(id)
  if (!targetId) notFound()
  const snap = await getPublicContentSnapshot('post', targetId, slug).catch(() => null)
  if (snap) return <PublicContentPage snapshot={snap} />
  return <PublicContentLocked placeSlug={slug} />
}
