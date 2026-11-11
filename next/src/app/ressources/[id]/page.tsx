import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isDbConfigured } from '@/lib/db'
import { getResourceForViewer } from '@/lib/db-resources'
import { resourcePublicAbsoluteUrl } from '@/lib/resource-share'
import { PublicResourcePage } from '@/views/PublicResourcePage'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: raw } = await params
  const id = parseInt(raw, 10)
  if (!id || !isDbConfigured()) return { title: 'Ressource Mandala' }
  const resource = await getResourceForViewer(id, 0)
  if (!resource || resource.scope !== 'mandala') return { title: 'Ressource introuvable' }
  const title = `${resource.title} · Mandala`
  const description =
    resource.summary?.trim().slice(0, 160) ||
    `Ressource partagée sur Mandala par ${resource.author_pseudo}.`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: resourcePublicAbsoluteUrl(id, 'https://mandala.eludein.art'),
    },
  }
}

export default async function PublicResourceRoute({ params }: Props) {
  const { id: raw } = await params
  const id = parseInt(raw, 10)
  if (!id || !isDbConfigured()) notFound()
  const resource = await getResourceForViewer(id, 0)
  if (!resource || resource.scope !== 'mandala') notFound()
  return <PublicResourcePage resource={resource} />
}
