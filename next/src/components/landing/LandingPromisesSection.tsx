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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <p className="m-landing-eyebrow">Le projet</p>
        <h2 className="text-3xl sm:text-4xl mt-3">Une plateforme, trois promesses</h2>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed mt-4 max-w-2xl mx-auto">
          Cliquez une promesse pour voir ce que Mandala propose concrètement — lieux, vie
          communautaire, et partage de savoir-faire.
        </p>

        <div className="m-landing-promises">
          {PROMISES.map((p) => {
            const isOpen = openId === p.id
            return (
              <button
                key={p.id}
                type="button"
                aria-expanded={isOpen}
                aria-controls={`promise-detail-${p.id}`}
                onClick={() => setOpenId(isOpen ? null : p.id)}
                className={`m-landing-promise m-landing-card text-left w-full p-5 transition-all ${
                  isOpen ? 'ring-1 ring-violet-500/40 border-violet-500/40' : 'hover:border-slate-600'
                }`}
              >
                <span className="m-landing-promise-num" aria-hidden>
                  {p.num}
                </span>
                <h3 className="flex items-center justify-between gap-2">
                  <span>{p.title}</span>
                  <span className="text-slate-500 text-lg leading-none" aria-hidden>
                    {isOpen ? '−' : '+'}
                  </span>
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">{p.teaser}</p>
                <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-violet-300/80">
                  {isOpen ? 'Fermer le détail' : 'Voir les fonctionnalités'}
                </p>
              </button>
            )
          })}
        </div>

        {open && (
          <div
            id={`promise-detail-${open.id}`}
            role="region"
            aria-label={`Détail — ${open.title}`}
            className="mt-6 text-left m-landing-card p-6 sm:p-8 space-y-4"
          >
            <div className="space-y-2">
              <p className="m-landing-eyebrow">{open.title}</p>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{open.detailLead}</p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 text-sm text-slate-300">
              {open.features.map((f) => (
                <li
                  key={f}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5"
                >
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              {open.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="inline-flex items-center text-xs px-4 py-2 rounded-full border border-slate-700 text-slate-200 hover:bg-slate-800/80"
                >
                  {l.label} →
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
