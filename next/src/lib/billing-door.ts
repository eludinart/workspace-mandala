/**
 * Porte feature billing — défaut fermée hors admins.
 */
export function isBillingPublic(): boolean {
  return (process.env.MANDALA_BILLING_PUBLIC || '0').trim() === '1'
}

/** true si les CTAs abo peuvent s’afficher. */
export function canShowBillingCta(isAppAdmin: boolean): boolean {
  return isBillingPublic() || isAppAdmin
}

export function assertBillingCtaAllowed(isAppAdmin: boolean): void {
  if (!canShowBillingCta(isAppAdmin)) {
    throw Object.assign(new Error('Offres non disponibles'), { status: 404 })
  }
}
