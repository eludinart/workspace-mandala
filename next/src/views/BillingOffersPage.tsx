'use client'

import { useEffect, useState } from 'react'
import { billingApi, type BillingProduct } from '@/api/billing'
import type { MandalaNavigate } from '@/components/MandalaApp'

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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [prod, access] = await Promise.all([
          billingApi.listProducts(),
          billingApi.getAccess(),
        ])
        if (cancelled) return
        setProducts(prod.products)
        setCanSee(Boolean(access.can_see_cta))
        setMemberCovered(Boolean(access.member_covered))
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

  async function startCheckout(productId: string, family: 'place' | 'pro') {
    setError('')
    setCheckoutId(productId)
    try {
      if (family === 'place' && !communityId) {
        setError('Choisissez un lieu dans les réglages pour souscrire à l’offre Lieu.')
        return
      }
      const { url } = await billingApi.createCheckoutSession({
        product_id: productId,
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
            {placeProducts.map((p) => (
              <button
                key={p.product_id}
                type="button"
                disabled={!p.configured || checkoutId === p.product_id || !communityId}
                onClick={() => startCheckout(p.product_id, 'place')}
                className="rounded-xl bg-amber-600/90 px-4 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-40"
              >
                {p.label} — {formatPrice(p.amount_cents, p.unit)}
                {!p.configured ? ' (bientôt)' : ''}
              </button>
            ))}
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
            {proProducts.map((p) => (
              <button
                key={p.product_id}
                type="button"
                disabled={!p.configured || checkoutId === p.product_id}
                onClick={() => startCheckout(p.product_id, 'pro')}
                className="rounded-xl bg-violet-600/90 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {p.label} — {formatPrice(p.amount_cents, p.unit)}
                {!p.configured ? ' (bientôt)' : ''}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
