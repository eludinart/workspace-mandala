import type { Metadata } from 'next'
import { CguContent } from '@/components/legal/CguContent'

export const metadata: Metadata = {
  title: 'CGU — Mandala',
  description: 'Conditions générales d’utilisation de Mandala.',
}

export default function CguPage() {
  return <CguContent />
}
