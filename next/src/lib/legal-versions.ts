/** Versions des documents légaux — bump = nouvelle acceptation CGU requise. */
export const LEGAL_CGU_VERSION = '2026-11-01'
export const LEGAL_CGV_VERSION = '2026-11-01'
export const LEGAL_PRIVACY_VERSION = '2026-11-01'

export type LegalDocKey = 'cgu' | 'cgv' | 'privacy'

export const LEGAL_DOC_META: Record<
  LegalDocKey,
  { title: string; path: string; version: string }
> = {
  cgu: {
    title: 'Conditions générales d’utilisation',
    path: '/cgu',
    version: LEGAL_CGU_VERSION,
  },
  cgv: {
    title: 'Conditions générales de vente',
    path: '/cgv',
    version: LEGAL_CGV_VERSION,
  },
  privacy: {
    title: 'Politique de confidentialité',
    path: '/confidentialite',
    version: LEGAL_PRIVACY_VERSION,
  },
}
