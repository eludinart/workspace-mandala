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

const FREE_FEATURES = [
  'Compte & profil — identité, bio, préférences de visibilité',
  'Rejoindre un lieu — charte, cercle, vie communautaire',
  'Mur vivant — annonces, événements, fil du lieu',
  'Messages & chat — échanges, réactions, sondages de groupe',
  'Annuaire & compétences — proposer / chercher, carte des membres',
  'Bibliothèque — lire et partager textes, recettes, médias',
  'Calendrier du lieu — dates et rendez-vous communautaires',
  'Découvrir le réseau — carte publique des lieux listés',
] as const

const PLACE_FEATURES = [
  'Badge lieu vérifié / listé',
  'Présence catalogue et carte publique',
  'Plafond de 40 membres levé (illimité)',
  'Membres couverts sans abo individuel',
] as const

const PRO_FEATURES = [
  'Carte Pro complète',
  'Mise en avant dans l’annuaire',
  'CTA Contacter',
  'Accès au parcours de vérification',
] as const

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
    <section id="tarifs" className="m-landing-offers scroll-mt-20">
      <div className="m-landing-offers-inner">
        <header className="m-landing-offers-intro">
          <p className="m-landing-eyebrow">Offres</p>
          <h2 className="m-landing-offers-title">Soutenir les lieux et les pratiques</h2>
          <p className="m-landing-offers-lede">
            La vie du lieu — mur, messages, événements — reste ouverte à tous les membres. Sans
            offre Lieu, un lieu peut accueillir jusqu’à 40 membres ; au-delà, l’abonnement lève le
            plafond et active la carte publique.
          </p>
        </header>

        <article className="m-landing-offer m-landing-offer--free">
          <div className="m-landing-offer-head">
            <p className="m-landing-eyebrow">Gratuit · pour toujours</p>
            <h3 className="m-landing-offer-name">S’inscrire, c’est déjà beaucoup</h3>
            <p className="m-landing-offer-desc">
              L’abonnement n’est pas requis pour vivre un lieu (jusqu’à 40 membres). Dès
              l’inscription, chaque membre dispose du cœur de Mandala — sans carte bancaire.
            </p>
          </div>
          <ul className="m-landing-offer-grid">
            {FREE_FEATURES.map((line) => (
              <li key={line} className="m-landing-offer-feature">
                <span className="m-landing-offer-dot" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="m-landing-offer-note">
            Mur, messages et événements restent libres pour les membres déjà présents. L’offre
            Lieu lève le plafond de 40 et ajoute la présence publique ; Mandala Pro met en avant
            une pratique.
          </p>
          <div className="m-landing-offer-cta">
            <Link href={ctaHref} className="m-landing-btn">
              {user ? 'Ouvrir mon espace' : 'Créer un compte gratuit'}
            </Link>
          </div>
        </article>

        <div className="m-landing-offers-paid">
          <article className="m-landing-offer m-landing-offer--paid">
            <div className="m-landing-offer-head">
              <p className="m-landing-eyebrow">Visibilité lieu</p>
              <h3 className="m-landing-offer-name">Offre Lieu</h3>
              <p className="m-landing-offer-desc">
                Pour qui fait grandir un lieu au-delà de 40 membres et souhaite le faire figurer
                dans le Mandala public.
              </p>
            </div>
            <ul className="m-landing-offer-list">
              {PLACE_FEATURES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="m-landing-offer-note">
              Sans cette offre : jusqu’à 40 membres, vie interne ouverte ; au plafond, les nouvelles
              adhésions sont bloquées. Pas de présence officielle sur la carte publique.
            </p>
            <div className="m-landing-offer-prices" aria-live="polite">
              {loading ? (
                <p className="m-landing-offer-price-fallback">Chargement des montants…</p>
              ) : placePrices.length > 0 ? (
                placePrices.map((line) => (
                  <p key={line} className="m-landing-offer-price">
                    {line}
                  </p>
                ))
              ) : (
                <p className="m-landing-offer-price-fallback">Montants disponibles dans l’app</p>
              )}
            </div>
          </article>

          <article className="m-landing-offer m-landing-offer--paid">
            <div className="m-landing-offer-head">
              <p className="m-landing-eyebrow">Pratique</p>
              <h3 className="m-landing-offer-name">Mandala Pro</h3>
              <p className="m-landing-offer-desc">
                Pour qui propose une pratique au service des lieux et souhaite être trouvé·e.
              </p>
            </div>
            <ul className="m-landing-offer-list">
              {PRO_FEATURES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="m-landing-offer-note">
              Le badge Mandala Pro demande un abonnement actif et une validation humaine — ce n’est
              pas un sticker acheté seul.
            </p>
            <div className="m-landing-offer-prices" aria-live="polite">
              {loading ? (
                <p className="m-landing-offer-price-fallback">Chargement des montants…</p>
              ) : proPrices.length > 0 ? (
                proPrices.map((line) => (
                  <p key={line} className="m-landing-offer-price">
                    {line}
                  </p>
                ))
              ) : (
                <p className="m-landing-offer-price-fallback">Montants disponibles dans l’app</p>
              )}
            </div>
          </article>
        </div>

        <footer className="m-landing-offers-foot">
          <Link href={ctaHref} className="m-landing-btn m-landing-btn--ghost">
            Voir dans l’app
          </Link>
          <Link href="/cgv" className="m-landing-offers-cgv">
            CGV
          </Link>
        </footer>
      </div>
    </section>
  )
}
