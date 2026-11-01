'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { billingApi, type BillingProduct } from '@/api/billing'
import type { MandalaNavigate } from '@/components/MandalaApp'
import {
  isPlayBillingAvailable,
  purchasePlaySubscription,
} from '@/lib/play-billing-client'
import {
  paymentSurfaceAllowsStripe,
  resolvePaymentSurface,
  type PaymentSurface,
} from '@/lib/play-distribution-context'

type Props = {
  onNavigate: MandalaNavigate
  communityId?: number | null
}

function formatPrice(cents: number, unit: string): string {
  const euros = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
  return `${euros} € / ${unit}`
}

export function BillingOffersPage({ onNavigate, communityId }: Props) {
  const [products, setProducts] = useState<BillingProduct[]>([])
  const [canSee, setCanSee] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkoutId, setCheckoutId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [memberCovered, setMemberCovered] = useState(false)
  const [coveredCount, setCoveredCount] = useState<number | null>(null)
  const [paymentSurface, setPaymentSurface] = useState<PaymentSurface>('web')
  const [playBillingOk, setPlayBillingOk] = useState(false)

  const onPlaySurface = paymentSurface === 'play'
  const allowStripe = paymentSurfaceAllowsStripe(paymentSurface)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [prod, access, surface, playOk] = await Promise.all([
          billingApi.listProducts(),
          billingApi.getAccess(),
          resolvePaymentSurface(),
          isPlayBillingAvailable(),
        ])
        if (cancelled) return
        setProducts(prod.products)
        setCanSee(Boolean(access.can_see_cta))
        setMemberCovered(Boolean(access.member_covered))
        setPaymentSurface(surface)
        setPlayBillingOk(playOk)
        if (communityId) {
          const place = (access.places || []).find(
            (p) => Number(p.communityId ?? p.community_id) === communityId
          )
          const n = place?.coveredMemberCount ?? place?.covered_member_count
          setCoveredCount(n != null ? Number(n) : null)
        }
      } catch {
        if (!cancelled) setError('Impossible de charger les offres')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [communityId])

  async function startCheckout(product: BillingProduct, family: 'place' | 'pro') {
    setError('')
    setCheckoutId(product.product_id)
    try {
      if (family === 'place' && !communityId) {
        setError('Choisissez un lieu dans les réglages pour souscrire à l’offre Lieu.')
        return
      }

      // Contexte Google Play (TWA / standalone Android) → Play Billing uniquement, jamais Stripe.
      if (onPlaySurface) {
        if (!product.play_configured || !product.play_sku) {
          setError(
            'Abonnement Google Play non configuré pour cette offre. Utilisez le site web Mandala sur un navigateur, ou réessayez après mise à jour Play.'
          )
          return
        }
        if (!playBillingOk) {
          setError(
            'Paiement Google Play indisponible sur cet appareil. Ouvrez Mandala depuis l’app Play, ou souscrivez sur mandala.eludein.art dans un navigateur.'
          )
          return
        }
        const purchase = await purchasePlaySubscription(product.play_sku)
        await billingApi.acknowledgePlayPurchase({
          product_id: product.product_id,
          purchase_token: purchase.purchaseToken,
          community_id: family === 'place' ? communityId ?? undefined : undefined,
        })
        setError('')
        window.location.href = '/app?checkout=success&provider=play'
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
        community_id: family === 'place' ? communityId ?? undefined : undefined,
      })
      if (!url) throw new Error('URL checkout manquante')
      window.location.href = url
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Paiement impossible'
      setError(msg)
    } finally {
      setCheckoutId(null)
    }
  }

  const placeProducts = products.filter((p) => p.plan_family === 'place')
  const proProducts = products.filter((p) => p.plan_family === 'pro')

  if (loading) {
    return <p className="text-slate-400 p-6">Chargement des offres…</p>
  }

  if (!canSee) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <button
          type="button"
          className="text-sm text-amber-400/90"
          onClick={() => onNavigate('account')}
        >
          ← Retour
        </button>
        <p className="text-slate-300">
          Les offres Mandala arriveront bientôt. La vie du lieu reste gratuite.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 pb-24">
      <div className="space-y-2">
        <button
          type="button"
          className="text-sm text-amber-400/90"
          onClick={() => onNavigate('account')}
        >
          ← Retour
        </button>
        <h1 className="text-2xl font-semibold text-slate-100">Faire rayonner Mandala</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Le réseau vivant des lieux. L’appartenance reste gratuite — on soutient ceux qui
          organisent et ceux qui monnayent leur savoir-faire.
        </p>
        <p className="text-xs text-slate-500">
          Paiement :{' '}
          {onPlaySurface
            ? playBillingOk
              ? 'Google Play sur cet appareil'
              : 'Google Play requis (Stripe masqué)'
            : 'Stripe (web)'}{' '}
          ·{' '}
          <Link href="/cgv" className="text-violet-300/90 underline">
            CGV
          </Link>
        </p>
        {onPlaySurface && (
          <p className="text-xs text-amber-200/80 leading-relaxed">
            Depuis l’app Android (Play), les abonnements passent uniquement par Google Play. Pour
            Stripe, ouvrez{' '}
            <a href="https://mandala.eludein.art" className="underline">
              mandala.eludein.art
            </a>{' '}
            dans un navigateur.
          </p>
        )}
        {memberCovered && (
          <p className="text-sm text-emerald-400/90">
            Vous êtes déjà couvert·e par au moins un lieu abonné ou partenaire.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-amber-200">Pour les lieux</h2>
          <p className="text-sm text-slate-400">
            Fais entrer ton lieu dans le Mandala public — tes membres restent gratuits.
          </p>
          <ul className="text-sm text-slate-300 space-y-1.5 list-disc pl-4">
            <li>Catalogue & carte en avant</li>
            <li>Tous les membres couverts</li>
            <li>Outils d’organisation du lieu</li>
          </ul>
          {coveredCount != null && (
            <p className="text-sm font-medium text-emerald-300">
              {coveredCount} membre{coveredCount > 1 ? 's' : ''} couvert
              {coveredCount > 1 ? 's' : ''} en gratuité
            </p>
          )}
          <div className="flex flex-col gap-2 pt-2">
            {placeProducts.map((p) => {
              const ready = onPlaySurface
                ? Boolean(p.play_configured && p.play_sku && playBillingOk)
                : p.configured
              return (
                <button
                  key={p.product_id}
                  type="button"
                  disabled={!ready || checkoutId === p.product_id || !communityId}
                  onClick={() => void startCheckout(p, 'place')}
                  className="rounded-xl bg-amber-600/90 px-4 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-40"
                >
                  {p.label} — {formatPrice(p.amount_cents, p.unit)}
                  {!ready ? ' (bientôt)' : ''}
                </button>
              )
            })}
            {!communityId && (
              <p className="text-xs text-slate-500">
                Ouvre les réglages d’un lieu pour souscrire à l’offre Lieu.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-violet-700/50 bg-slate-900/60 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-violet-200">Mandala Pro</h2>
          <p className="text-sm text-slate-400">
            Passe de « j’ai des compétences » à « on me trouve pour travailler ».
          </p>
          <ul className="text-sm text-slate-300 space-y-1.5 list-disc pl-4">
            <li>Carte Mandala Pro + boost annuaire</li>
            <li>Badge après endossement (lieu ou admin)</li>
            <li>Contact en un geste</li>
          </ul>
          <div className="flex flex-col gap-2 pt-2">
            {proProducts.map((p) => {
              const ready = onPlaySurface
                ? Boolean(p.play_configured && p.play_sku && playBillingOk)
                : p.configured
              return (
                <button
                  key={p.product_id}
                  type="button"
                  disabled={!ready || checkoutId === p.product_id}
                  onClick={() => void startCheckout(p, 'pro')}
                  className="rounded-xl bg-violet-600/90 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {p.label} — {formatPrice(p.amount_cents, p.unit)}
                  {!ready ? ' (bientôt)' : ''}
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
