import type { Metadata } from 'next'
import { PublicSkillsPage } from '@/views/PublicSkillsPage'

export const metadata: Metadata = {
  title: 'Annuaire',
  description:
    'Annuaire Mandala — professionnels validés et membres du réseau, filtrables, ancrés dans des lieux.',
}

export default function CompetencesPage() {
  return <PublicSkillsPage />
}
