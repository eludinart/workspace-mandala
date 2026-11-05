'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { billingApi, type BillingProduct } from '@/api/billing'
import {
  isPlayBillingAvailable,
  purchasePlaySubscription,
} from '@/lib/play-billing-client'
import {
  paymentSurfaceAllowsStripe,
  resolvePaymentSurface,
  type PaymentSurface,
} from '@/lib/play-distribution-context'
import { buildCheckoutReturnPath } from '@/lib/checkout-return'

type PlaceAccess = {
  communityId: number
  status: string
  planId: string | null
  currentPeriodEnd: string | null
  coveredMemberCount: number
  featured: boolean
  partner: boolean
  inGrace: boolean
  graceEndsAt: string | null
}

function formatPrice(cents: number, unit: string): string {
  const euros = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
  return `${euros} € / ${unit}`
}

function formatFrDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function parsePlace(raw: Record<string, unknown>): PlaceAccess | null {
  const communityId = Number(raw.communityId ?? raw.community_id)
  if (!Number.isFinite(communityId) || communityId <= 0) return null
  const periodEndRaw = raw.currentPeriodEnd ?? raw.current_period_end
  const periodEnd =
    periodEndRaw != null && String(periodEndRaw).trim()
      ? String(periodEndRaw)
      : null
  const status = String(raw.status ?? 'none').toLowerCase()
  const partner = Boolean(raw.partner)
  const now = Date.now()
  const periodMs = periodEnd ? new Date(periodEnd).getTime() : NaN
  const periodPast = Number.isFinite(periodMs) && periodMs < now
  const alertGrace = Boolean(raw.inGrace ?? raw.in_grace)
  const inGrace =
    !partner &&
    (alertGrace ||
      (periodPast && (status === 'active' || status === 'trialing')))
  const graceEndsRaw = raw.graceEndsAt ?? raw.grace_ends_at
  return {
    communityId,
    status,
    planId:
      raw.planId != null
        ? String(raw.planId)
        : raw.plan_id != null
          ? String(raw.plan_id)
          : null,
    currentPeriodEnd: periodEnd,
    coveredMemberCount: Number(
      raw.coveredMemberCount ?? raw.covered_member_count ?? 0
    ),
    featured: Boolean(raw.featured),
    partner,
    inGrace,
    graceEndsAt:
      graceEndsRaw != null && String(graceEndsRaw).trim()
        ? String(graceEndsRaw)
        : null,
  }
}

function statusCopy(place: PlaceAccess | null): {
  label: string
  tone: 'ok' | 'warn' | 'bad' | 'neutral'
  detail: string
} {
  if (!place) {
    return {
      label: 'Non chargé',
      tone: 'neutral',
      detail: 'Impossible de déterminer l’état de l’abonnement pour ce lieu.',
    }
  }
  if (place.partner) {
    return {
      label: 'Partenaire',
      tone: 'ok',
      detail: 'Ce lieu est couvert par un partenariat Mandala (catalogue public).',
    }
  }
  if (place.inGrace) {
    const until =
      formatFrDate(place.graceEndsAt) ||
      formatFrDate(place.currentPeriodEnd) ||
      'bientôt'
    return {
      label: 'En période de grâce',
      tone: 'warn',
      detail: `L’accès catalogue reste actif jusqu’au ${until}. Souscrivez pour éviter la coupure.`,
    }
  }
  if (place.status === 'active' || place.status === 'trialing') {
    const until = formatFrDate(place.currentPeriodEnd)
    return {
      label: place.status === 'trialing' ? 'Actif (essai / cadeau)' : 'Actif',
      tone: 'ok',
      detail: until
        ? `Offre Lieu active jusqu’au ${until}.`
        : 'Offre Lieu active.',
    }
  }
  if (place.status === 'past_due' || place.status === 'unpaid') {
    return {
      label: 'Paiement en retard',
      tone: 'bad',
      detail: 'Régularisez l’abonnement pour conserver la présence publique.',
    }
  }
  return {
    label: 'Inactif',
    tone: 'neutral',
    detail:
      'Sans offre Lieu, le lieu peut vivre pour ses membres mais n’apparaît pas comme présence officielle dans le Mandala public.',
  }
}

export function PlaceBillingSettingsPanel({
  communityId,
}: {
  communityId: number
}) {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<BillingProduct[]>([])
  const [canSee, setCanSee] = useState(false)
  const [place, setPlace] = useState<PlaceAccess | null>(null)
  const [paymentSurface, setPaymentSurface] = useState<PaymentSurface>('web')
  const [playBillingOk, setPlayBillingOk] = useState(false)
  const [checkoutId, setCheckoutId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onPlaySurface = paymentSurface === 'play'
  const allowStripe = paymentSurfaceAllowsStripe(paymentSurface)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prod, access, surface, playOk] = await Promise.all([
        billingApi.listProducts(),
        billingApi.getAccess(),
        resolvePaymentSurface(),
        isPlayBillingAvailable(),
      ])
      setProducts(prod.products.filter((p) => p.plan_family === 'place'))
      setCanSee(Boolean(access.can_see_cta))
      setPaymentSurface(surface)
      setPlayBillingOk(playOk)

      const rawPlaces = access.places || []
      let matched =
        rawPlaces
          .map((p) => parsePlace(p as Record<string, unknown>))
          .find((p) => p && p.communityId === communityId) ?? null

      const alert = (access.comp_alerts || []).find(
        (a) => Number(a.community_id) === communityId
      )
      if (matched && alert?.kind === 'grace') {
        matched = {
          ...matched,
          inGrace: true,
          graceEndsAt: alert.grace_ends_at || matched.graceEndsAt,
          currentPeriodEnd: alert.period_end || matched.currentPeriodEnd,
        }
      } else if (matched && alert?.kind === 'warn' && !matched.inGrace) {
        matched = {
          ...matched,
          currentPeriodEnd: alert.period_end || matched.currentPeriodEnd,
        }
      }
      setPlace(matched)
    } catch {
      setError('Impossible de charger l’abonnement du lieu.')
      setPlace(null)
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    void load()
  }, [load])

  const copy = useMemo(() => statusCopy(place), [place])
  const alreadyCovered =
    place?.partner ||
    ((!place?.inGrace) &&
      (place?.status === 'active' || place?.status === 'trialing'))

  async function startCheckout(product: BillingProduct) {
    setError(null)
    setCheckoutId(product.product_id)
    try {
      if (onPlaySurface) {
        if (!product.play_configured || !product.play_sku) {
          setError(
            'Abonnement Google Play non configuré. Utilisez le site web, ou réessayez après mise à jour Play.'
          )
          return
        }
        if (!playBillingOk) {
          setError(
            'Paiement Google Play indisponible ici. Ouvrez Mandala depuis l’app Play, ou souscrivez sur mandala.eludein.art.'
          )
          return
        }
        const purchase = await purchasePlaySubscription(product.play_sku)
        await billingApi.acknowledgePlayPurchase({
          product_id: product.product_id,
          purchase_token: purchase.purchaseToken,
          community_id: communityId,
        })
        window.location.href = buildCheckoutReturnPath({
          status: 'success',
          planId: product.product_id,
          planFamily: 'place',
          provider: 'play',
          communityId,
        })
        return
      }

      if (!allowStripe) {
        setError('Paiement Stripe indisponible dans ce contexte.')
        return
      }
      if (!product.configured) {
        setError('Paiement Stripe non configuré pour cette offre.')
        return
      }
      const { url } = await billingApi.createCheckoutSession({
        product_id: product.product_id,
        community_id: communityId,
        success_url: buildCheckoutReturnPath({
          status: 'success',
          planId: product.product_id,
          planFamily: 'place',
          provider: 'stripe',
          communityId,
        }),
        cancel_url: buildCheckoutReturnPath({
          status: 'canceled',
          planId: product.product_id,
          planFamily: 'place',
          provider: 'stripe',
          communityId,
        }),
      })
      if (!url) throw new Error('URL checkout manquante')
      window.location.href = url
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Paiement impossible')
    } finally {
      setCheckoutId(null)
    }
  }

  const toneClass =
    copy.tone === 'ok'
      ? 'border-emerald-800/50 bg-emerald-950/25 text-emerald-100'
      : copy.tone === 'warn'
        ? 'border-amber-800/50 bg-amber-950/25 text-amber-100'
        : copy.tone === 'bad'
          ? 'border-rose-800/50 bg-rose-950/25 text-rose-100'
          : 'border-slate-800 bg-slate-950/40 text-slate-200'

  return (
    <fieldset className="space-y-3 rounded-xl border border-slate-800 p-3">
      <legend className="px-1 text-xs uppercase tracking-widest text-slate-400">
        Abonnement Lieu
      </legend>

      {loading ? (
        <p className="text-xs text-slate-500">Chargement de l’abonnement…</p>
      ) : (
        <>
          <div className={`rounded-lg border px-3 py-2.5 space-y-1 ${toneClass}`}>
            <p className="text-sm font-medium">{copy.label}</p>
            <p className="text-xs opacity-90 leading-relaxed">{copy.detail}</p>
            {place && place.coveredMemberCount > 0 && (
              <p className="text-xs opacity-80 pt-1">
                {place.coveredMemberCount} membre
                {place.coveredMemberCount > 1 ? 's' : ''} couvert
                {place.coveredMemberCount > 1 ? 's' : ''}
                {place.featured ? ' · mis en avant' : ''}
              </p>
            )}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            L’offre Lieu rend le lieu visible dans le catalogue et la carte publics.
            Les habitants restent gratuits. Paiement :{' '}
            {onPlaySurface
              ? playBillingOk
                ? 'Google Play'
                : 'Google Play requis (Stripe masqué)'
              : 'Stripe (web)'}
            {' · '}
            <Link href="/cgv" className="text-sky-400/90 underline">
              CGV
            </Link>
            {' · '}
            <Link href="/app#offres" className="text-sky-400/90 underline">
              Voir toutes les offres
            </Link>
          </p>

          {!canSee ? (
            <p className="text-xs text-slate-400">
              Les souscriptions publiques arriveront bientôt. La vie du lieu reste
              accessible aux membres.
            </p>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              {products.map((p) => {
                const ready = onPlaySurface
                  ? Boolean(p.play_configured && p.play_sku && playBillingOk)
                  : p.configured
                const disabled =
                  !ready ||
                  checkoutId === p.product_id ||
                  Boolean(alreadyCovered && !place?.inGrace)
                return (
                  <button
                    key={p.product_id}
                    type="button"
                    disabled={disabled}
                    onClick={() => void startCheckout(p)}
                    className="rounded-lg bg-amber-600/90 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-amber-500 disabled:opacity-40"
                  >
                    {checkoutId === p.product_id
                      ? 'Redirection…'
                      : `${p.label} — ${formatPrice(p.amount_cents, p.unit)}`}
                    {!ready
                      ? ' (bientôt)'
                      : alreadyCovered && !place?.inGrace
                        ? ' (déjà actif)'
                        : ''}
                  </button>
                )
              })}
              {products.length === 0 && (
                <p className="text-xs text-slate-500">
                  Aucune offre Lieu configurée pour le moment.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs rounded-lg px-3 py-2 bg-red-950/50 text-red-200">
              {error}
            </p>
          )}
        </>
      )}
    </fieldset>
  )
}
