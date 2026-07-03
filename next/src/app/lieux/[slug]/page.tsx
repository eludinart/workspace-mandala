import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicCommunityProfileBySlug } from '@/lib/db-communities'
import { PlacePublicProfile } from '@/views/PlacePublicProfile'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const place = await getPublicCommunityProfileBySlug(slug).catch(() => null)
  if (!place) {
    return { title: 'Lieu introuvable' }
  }
  const description =
    place.tagline?.trim() ||
    place.description?.trim().slice(0, 160) ||
    `Découvrez ${place.name} sur Mandala.`
  return {
    title: place.name,
    description,
    openGraph: {
      title: `${place.name} · Mandala`,
      description,
      type: 'profile',
    },
  }
}

export default async function PlaceProfilePage({ params }: Params) {
  const { slug } = await params
  const place = await getPublicCommunityProfileBySlug(slug).catch(() => null)
  if (!place) notFound()
  return <PlacePublicProfile place={place} />
}
