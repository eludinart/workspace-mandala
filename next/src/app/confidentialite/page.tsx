import type { Metadata } from 'next'
import { PrivacyContent } from '@/components/legal/PrivacyContent'

export const metadata: Metadata = {
  title: 'Confidentialité — Mandala',
  description: 'Politique de confidentialité de Mandala (RGPD).',
}

export default function ConfidentialitePage() {
  return <PrivacyContent />
}
