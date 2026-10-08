import type { Metadata } from 'next'
import { PublicSkillsPage } from '@/views/PublicSkillsPage'

export const metadata: Metadata = {
  title: 'Compétences',
  description: 'Annuaire des compétences du réseau Mandala — fiches que les membres ont choisi de rendre visibles.',
}

export default function CompetencesPage() {
  return <PublicSkillsPage />
}
