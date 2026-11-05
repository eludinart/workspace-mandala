'use client'

import { useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { ProVerificationForm } from '@/components/billing/ProVerificationForm'
import type { CheckoutReturnState } from '@/lib/checkout-return'

type Props = {
  state: CheckoutReturnState
  onNavigate: MandalaNavigate
  onDismiss: () => void
}

/**
 * Bannière après retour Stripe / Play (`?checkout=success|canceled`).
 */
export function CheckoutReturnBanner({ state, onNavigate, onDismiss }: Props) {
  const [showProForm, setShowProForm] = useState(
    state.status === 'success' && state.planFamily === 'pro'
  )

  if (state.status === 'canceled') {
    return (
      <div
        className="shrink-0 mx-4 md:mx-6 mt-2 rounded-xl border border-amber-500/45 bg-amber-950/65 px-4 py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
        role="status"
      >
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-amber-100">
            Paiement annulé
          </p>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            Aucun prélèvement n’a été effectué. Vous pouvez reprendre quand vous
            voulez.
          </p>
          <button
            type="button"
            onClick={() => {
              onDismiss()
              onNavigate('billing-offers')
            }}
            className="mt-1 text-xs font-medium text-amber-50 underline underline-offset-2"
          >
            Voir les offres
          </button>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs shrink-0 px-2 py-1 rounded-lg text-amber-200 hover:text-white hover:bg-amber-900/50"
        >
          Fermer
        </button>
      </div>
    )
  }

  const isPro = state.planFamily === 'pro'
  const isPlace = state.planFamily === 'place'

  const title = isPro
    ? 'Paiement Mandala Pro confirmé'
    : isPlace
      ? 'Paiement offre Lieu confirmé'
      : 'Paiement confirmé'
  const body = isPro
    ? 'Complétez votre profil pour entrer dans la file d’endossement. Le badge Pro apparaît après validation.'
    : isPlace
      ? 'Votre lieu est couvert. Vérifiez le statut dans les réglages du lieu (catalogue public, membres).'
      : 'Votre abonnement est actif. Continuez vers les réglages du lieu ou le profil Pro selon l’offre choisie.'

  return (
    <div
      className="shrink-0 mx-4 md:mx-6 mt-2 rounded-xl border border-emerald-500/45 bg-emerald-950/65 px-4 py-3 flex flex-col gap-3"
      role="status"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-emerald-100">{title}</p>
          <p className="text-xs text-emerald-200/90 leading-relaxed">
            {body}
            {state.provider ? ` (${state.provider})` : ''}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            {(isPlace || !state.planFamily) && (
              <button
                type="button"
                onClick={() => {
                  onDismiss()
                  onNavigate('place-settings')
                }}
                className="text-xs font-medium text-white underline underline-offset-2"
              >
                Ouvrir les réglages du lieu
              </button>
            )}
            {(isPro || !state.planFamily) && !showProForm && (
              <button
                type="button"
                onClick={() => setShowProForm(true)}
                className="text-xs font-medium text-white underline underline-offset-2"
              >
                Compléter le profil Pro
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onDismiss()
                onNavigate('account')
              }}
              className="text-xs font-medium text-emerald-100/90 underline underline-offset-2"
            >
              Mon compte
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs shrink-0 px-2 py-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-900/50 self-start"
        >
          Fermer
        </button>
      </div>
      {showProForm && (
        <div className="rounded-lg border border-emerald-800/50 bg-slate-950/40 p-3">
          <ProVerificationForm compact />
        </div>
      )}
    </div>
  )
}
