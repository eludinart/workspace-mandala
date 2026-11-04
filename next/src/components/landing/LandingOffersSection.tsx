'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { billingApi, type BillingProduct } from '@/api/billing'
import { useAuth } from '@/contexts/AuthContext'

function formatPrice(cents: number, unit: string): string {
  if (!cents || cents <= 0) return ''
  const euros = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
  return `${euros} € / ${unit}`
}

function pricesForFamily(
  products: BillingProduct[],
  family: 'place' | 'pro'
): string[] {
  return products
    .filter((p) => p.plan_family === family)
    .map((p) => formatPrice(p.amount_cents, p.unit))
    .filter(Boolean)
}

export function LandingOffersSection() {
  const { user } = useAuth()
  const [products, setProducts] = useState<BillingProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await billingApi.listProducts()
        if (!cancelled) setProducts(res.products ?? [])
      } catch {
        if (!cancelled) setProducts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const placePrices = pricesForFamily(products, 'place')
  const proPrices = pricesForFamily(products, 'pro')
  const ctaHref = user ? '/app' : '/app?mode=register'

  return (
    <section id="tarifs" className="scroll-mt-16 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <p className="m-landing-eyebrow">Offres</p>
          <h2 className="text-3xl sm:text-4xl">Soutenir les lieux et les pratiques</h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            La vie du lieu — mur, messages, événements — reste ouverte à tous les membres. Les
            offres ci-dessous aident les lieux et les pratiques à être visibles dans le Mandala
            public.
          </p>
        </div>

        <div className="m-landing-habitants space-y-1.5 pb-5">
          <p className="text-sm text-slate-200 font-medium tracking-wide">Habitants</p>
          <p className="text-sm text-slate-400 leading-relaxed">
            Mur, messages, événements et compétences de base restent gratuits — sans abonnement.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <article className="m-landing-card p-6 sm:p-8 space-y-5">
            <div className="space-y-2">
              <h3 className="text-2xl">Offre Lieu</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Pour qui fait vivre un lieu et souhaite le faire figurer dans le Mandala public.
              </p>
            </div>
            <ul className="text-sm text-slate-300 space-y-2.5 list-disc pl-4">
              <li>Badge lieu vérifié / listé</li>
              <li>Présence catalogue et carte publique</li>
              <li>Mise en avant possible</li>
              <li>Membres couverts sans abo individuel</li>
            </ul>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sans cette offre, le lieu vit pour ses membres ; il n’apparaît pas comme présence
              officielle dans le Mandala public.
            </p>
            <div className="pt-2 min-h-[3rem] space-y-1">
              {loading ? (
                <p className="text-sm text-slate-500">Chargement des montants…</p>
              ) : placePrices.length > 0 ? (
                placePrices.map((line) => (
                  <p key={line} className="m-landing-offer-price">
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-500">Montants disponibles dans l’app</p>
              )}
            </div>
          </article>

          <article className="m-landing-card p-6 sm:p-8 space-y-5">
            <div className="space-y-2">
              <h3 className="text-2xl">Mandala Pro</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Pour qui propose une pratique au service des lieux et souhaite être trouvé·e.
              </p>
            </div>
            <ul className="text-sm text-slate-300 space-y-2.5 list-disc pl-4">
              <li>Carte Pro complète</li>
              <li>Mise en avant dans l’annuaire</li>
              <li>CTA Contacter</li>
              <li>Accès au parcours de vérification</li>
            </ul>
            <p className="text-xs text-slate-500 leading-relaxed">
              Le badge Mandala Pro demande un abonnement actif et une validation humaine — ce n’est
              pas un sticker acheté seul.
            </p>
            <div className="pt-2 min-h-[3rem] space-y-1">
              {loading ? (
                <p className="text-sm text-slate-500">Chargement des montants…</p>
              ) : proPrices.length > 0 ? (
                proPrices.map((line) => (
                  <p key={line} className="m-landing-offer-price">
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-500">Montants disponibles dans l’app</p>
              )}
            </div>
          </article>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-1">
          <Link href={ctaHref} className="m-landing-btn m-landing-btn--ghost">
            Voir dans l’app
          </Link>
          <Link
            href="/cgv"
            className="text-xs text-slate-500 hover:text-[rgb(var(--accent-400))] underline underline-offset-4"
          >
            CGV
          </Link>
        </div>
      </div>
    </section>
  )
}
