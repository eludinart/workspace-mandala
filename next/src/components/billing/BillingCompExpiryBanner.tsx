'use client'

import { useCallback, useEffect, useState } from 'react'
import { billingApi } from '@/api/billing'
import type { MandalaNavigate } from '@/components/MandalaApp'

type CompAlert = {
  community_id: number
  place_name: string
  kind: 'warn' | 'grace'
  period_end: string
  grace_ends_at: string
}

const DISMISS_KEY = 'mdl_comp_billing_banner_dismiss'

function dismissedKey(alert: CompAlert): string {
  return `${alert.community_id}:${alert.kind}:${alert.period_end.slice(0, 10)}`
}

function loadDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveDismissed(keys: Set<string>) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...keys]))
}

function formatFr(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

/** Bannière proéminente (pas seulement la cloche) pour échéance cadeau Lieu. */
export function BillingCompExpiryBanner({
  onNavigate,
}: {
  onNavigate?: MandalaNavigate
}) {
  const [alerts, setAlerts] = useState<CompAlert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed())

  const refresh = useCallback(async () => {
    try {
      const access = await billingApi.getAccess()
      setAlerts(access.comp_alerts ?? [])
    } catch {
      setAlerts([])
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visible = alerts.filter((a) => !dismissed.has(dismissedKey(a)))
  if (!visible.length) return null

  const alert = visible[0]!
  const isGrace = alert.kind === 'grace'

  return (
    <div
      className={`shrink-0 mx-4 md:mx-6 mt-2 rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-lg ${
        isGrace
          ? 'border-rose-500/50 bg-rose-950/70 shadow-rose-950/40'
          : 'border-amber-500/45 bg-amber-950/65 shadow-amber-950/35'
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div className="min-w-0 space-y-1">
        <p
          className={`text-sm font-semibold ${
            isGrace ? 'text-rose-100' : 'text-amber-100'
          }`}
        >
          {isGrace
            ? `Période de grâce — ${alert.place_name || 'votre lieu'}`
            : `Cadeau Lieu bientôt terminé — ${alert.place_name || 'votre lieu'}`}
        </p>
        <p className={`text-xs leading-relaxed ${isGrace ? 'text-rose-200/90' : 'text-amber-200/90'}`}>
          {isGrace
            ? `Le cadeau s’est terminé le ${formatFr(alert.period_end)}. L’accès reste actif jusqu’au ${formatFr(alert.grace_ends_at)}. Souscrivez pour ne pas perdre le catalogue public.`
            : `Fin du cadeau le ${formatFr(alert.period_end)}, puis 7 jours de grâce jusqu’au ${formatFr(alert.grace_ends_at)}.`}
        </p>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('billing-offers')}
            className={`mt-1 text-xs font-medium underline underline-offset-2 ${
              isGrace ? 'text-white' : 'text-amber-50'
            }`}
          >
            Choisir un abonnement Lieu
          </button>
        )}
      </div>
      <button
        type="button"
        className={`text-xs shrink-0 px-2 py-1 rounded-lg ${
          isGrace
            ? 'text-rose-200 hover:text-white hover:bg-rose-900/50'
            : 'text-amber-200 hover:text-white hover:bg-amber-900/50'
        }`}
        aria-label="Masquer pour cette session"
        onClick={() => {
          const next = new Set(dismissed)
          next.add(dismissedKey(alert))
          setDismissed(next)
          saveDismissed(next)
        }}
      >
        Masquer
      </button>
    </div>
  )
}
