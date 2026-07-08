import type { Metadata } from 'next'
import { PublicLandingPage } from '@/views/PublicLandingPage'

export const metadata: Metadata = {
  title: 'Mandala — Mur vivant des lieux & communautés',
  description:
    'Carte interactive, événements et messages des organisateurs. Découvrez le réseau Mandala — France et espace francophone.',
}

export default function HomePage() {
  return <PublicLandingPage />
}
