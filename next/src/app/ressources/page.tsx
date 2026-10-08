import type { Metadata } from 'next'
import { PublicResourcesPage } from '@/views/PublicResourcesPage'

export const metadata: Metadata = {
  title: 'Ressources',
  description: 'Bibliothèque de ressources du réseau Mandala — textes, recettes, vidéos et documents partagés.',
}

export default function RessourcesPage() {
  return <PublicResourcesPage />
}
