import type { Metadata } from 'next'
import { CgvContent } from '@/components/legal/CgvContent'

export const metadata: Metadata = {
  title: 'CGV — Mandala',
  description: 'Conditions générales de vente des abonnements Mandala.',
}

export default function CgvPage() {
  return <CgvContent />
}
