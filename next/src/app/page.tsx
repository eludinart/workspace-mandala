import type { Metadata } from 'next'
import { PublicLandingPage } from '@/views/PublicLandingPage'

export const metadata: Metadata = {
  title: 'Mandala — Lieux & communautés',
  description:
    'Découvrez les lieux et communautés inscrits sur Mandala. Carte, présentations et contacts — France et espace francophone.',
}

export default function HomePage() {
  return <PublicLandingPage />
}
