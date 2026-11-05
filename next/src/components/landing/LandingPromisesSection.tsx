'use client'

import { useState } from 'react'
import Link from 'next/link'

type PromiseId = 'lieux' | 'vie' | 'savoir'

type PromiseDef = {
  id: PromiseId
  num: string
  title: string
  teaser: string
  detailLead: string
  features: string[]
  links: Array<{ href: string; label: string }>
}

const PROMISES: PromiseDef[] = [
  {
    id: 'lieux',
    num: 'I',
    title: 'Lieux & réseau',
    teaser: 'Trouver un lieu, lire sa fiche, voir le réseau sur la carte — et y entrer avec sa charte.',
    detailLead:
      'Mandala ancre chaque communauté dans le réseau public, sans forcer la visibilité : un lieu peut rester dans sa bulle.',
    features: [
      'Carte interactive des lieux listés publiquement',
      'Fiche lieu : présentation, adresse, lien profil',
      'Charte à accepter avant d’intégrer l’espace',
      'Lieux amis (Relier) pour croiser les agendas quand la porte est ouverte',
      'Offre Lieu : plafond 40 levé + catalogue / carte publics',
    ],
    links: [
      { href: '/#lieux', label: 'Voir les lieux' },
      { href: '/#mur', label: 'Carte du réseau' },
    ],
  },
  {
    id: 'vie',
    num: 'II',
    title: 'Vie du lieu',
    teaser: 'Mur, agenda, événements et messages — le quotidien numérique au service du lien humain.',
    detailLead:
      'Une fois membre, tout le cœur social reste gratuit : on vit le lieu ensemble, sans abonnement individuel.',
    features: [
      'Mur / fil d’actualité (annonces, événements, brèves)',
      'Calendrier & présences sur place',
      'Événements avec détail et médias',
      'Messages 1:1 et groupes, réactions, sondages',
      'Annuaire des membres du lieu',
    ],
    links: [
      { href: '/#mur', label: 'Fil d’actualité' },
      { href: '/app', label: 'Ouvrir mon espace' },
    ],
  },
  {
    id: 'savoir',
    num: 'III',
    title: 'Savoir-faire & partage',
    teaser: 'Annuaire de compétences, bibliothèque de ressources — et mise en avant Pro si on le souhaite.',
    detailLead:
      'Chacun peut proposer ce qu’il sait faire ou chercher, et partager textes, recettes ou médias avec le réseau.',
    features: [
      'Annuaire public Pros / Membres + carte des villes d’exercice',
      'Fiche compétences (offre, demande, lieux d’exercice)',
      'Bibliothèque : textes, recettes, audio, vidéo, documents',
      'Mandala Pro : badge, boost annuaire, CTA Contacter',
    ],
    links: [
      { href: '/competences', label: 'Annuaire' },
      { href: '/ressources', label: 'Ressources' },
      { href: '/#tarifs', label: 'Offres' },
    ],
  },
]

export function LandingPromisesSection() {
  const [openId, setOpenId] = useState<PromiseId | null>(null)
  const open = PROMISES.find((p) => p.id === openId) ?? null

  return (
    <section id="projet" className="m-landing-band m-landing-band--projet scroll-mt-16">
      <div className="m-landing-promises-wrap">
        <header className="m-landing-promises-intro">
          <p className="m-landing-eyebrow">Le projet</p>
          <h2 className="m-landing-promises-title">Une plateforme, trois promesses</h2>
          <p className="m-landing-promises-lede">
            Ouvrez une entrée pour voir ce que Mandala propose concrètement — lieux, vie
            communautaire, et partage de savoir-faire.
          </p>
        </header>

        <div className="m-landing-promises">
          {PROMISES.map((p) => {
            const isOpen = openId === p.id
            return (
              <button
                key={p.id}
                type="button"
                aria-expanded={isOpen}
                aria-controls={isOpen ? `promise-detail-${p.id}` : undefined}
                onClick={() => setOpenId(isOpen ? null : p.id)}
                className={`m-landing-promise${isOpen ? ' is-open' : ''}`}
              >
                <span className="m-landing-promise-num" aria-hidden>
                  {p.num}
                </span>
                <span className="m-landing-promise-body">
                  <span className="m-landing-promise-title-row">
                    <span className="m-landing-promise-name">{p.title}</span>
                    <span className="m-landing-promise-toggle" aria-hidden>
                      {isOpen ? '−' : '+'}
                    </span>
                  </span>
                  <span className="m-landing-promise-teaser">{p.teaser}</span>
                  <span className="m-landing-promise-hint">
                    {isOpen ? 'Fermer' : 'Détail'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {open && (
          <div
            id={`promise-detail-${open.id}`}
            role="region"
            aria-label={`Détail — ${open.title}`}
            className="m-landing-promise-detail"
          >
            <p className="m-landing-promise-detail-lead">{open.detailLead}</p>
            <ul className="m-landing-promise-features">
              {open.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="m-landing-promise-links">
              {open.links.map((l) => (
                <Link key={l.href} href={l.href} className="m-landing-promise-link">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
