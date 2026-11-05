import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isDbConfigured } from '@/lib/db'
import { getPublicSkillCard } from '@/lib/db-skills'
import { PublicSiteChrome } from '@/components/landing/PublicSiteChrome'

type Props = { params: Promise<{ userId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId: raw } = await params
  const userId = parseInt(raw, 10)
  if (!userId || !isDbConfigured()) {
    return { title: 'Compétence Mandala' }
  }
  const card = await getPublicSkillCard(userId)
  if (!card) return { title: 'Fiche introuvable' }
  const name = card.display_name || card.pseudo
  const tags = card.tags
    .slice(0, 4)
    .map((t) => t.label)
    .join(', ')
  const placeHint =
    card.places[0]?.name != null ? ` · ${card.places[0].name}` : ''
  const title = `${name}${placeHint} — compétences Mandala`
  const description =
    card.pro_tagline?.trim() ||
    card.offer_text?.trim().slice(0, 155) ||
    `Fiche compétences de ${name} sur le réseau Mandala${tags ? ` : ${tags}` : ''}.`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://mandala.eludein.art/competences/${userId}`,
    },
  }
}

export default async function PublicSkillProfilePage({ params }: Props) {
  const { userId: raw } = await params
  const userId = parseInt(raw, 10)
  if (!userId || !isDbConfigured()) notFound()
  const card = await getPublicSkillCard(userId)
  if (!card) notFound()

  const name = card.display_name || card.pseudo

  return (
    <PublicSiteChrome user={null} authLoading={false}>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
        <p className="text-xs uppercase tracking-wider text-violet-300/90">
          Réseau de lieux · Mandala
        </p>
        <header className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold text-slate-50">{name}</h1>
          {card.pro_verified && (
            <div className="m-pro-banner space-y-1">
              <p className="text-sm font-semibold text-violet-100">Mandala Pro</p>
              {card.pro_endorsement_place ? (
                <p className="text-xs text-violet-200/90">
                  Endossé par {card.pro_endorsement_place}
                </p>
              ) : null}
              {card.pro_tagline ? (
                <p className="text-base text-slate-100 pt-1">{card.pro_tagline}</p>
              ) : null}
            </div>
          )}
          {!card.pro_verified && card.pro_tagline && (
            <p className="text-lg text-slate-300">{card.pro_tagline}</p>
          )}
          {card.places.length > 0 && (
            <p className="text-sm text-slate-500">
              {card.places.map((p) => p.name).join(' · ')}
            </p>
          )}
        </header>

        {card.offer_text && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Ce que je peux apporter
            </h2>
            <p className="text-[15px] leading-7 text-slate-300 whitespace-pre-wrap">
              {card.offer_text}
            </p>
          </section>
        )}

        {card.tags.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Savoir-faire
            </h2>
            <ul className="flex flex-wrap gap-2">
              {card.tags.map((t) => (
                <li
                  key={`${t.label}-${t.register}`}
                  className="rounded-2xl border border-slate-700 px-3 py-1.5 text-sm text-slate-200"
                >
                  {t.label}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(card.pro_modalities || card.pro_service_area) && (
          <section className="space-y-1 text-sm text-slate-400">
            {card.pro_service_area && <p>Zone : {card.pro_service_area}</p>}
            {card.pro_modalities && <p>{card.pro_modalities}</p>}
          </section>
        )}

        <div className="flex flex-wrap gap-3 pt-4">
          <Link
            href="/app"
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            Contacter via Mandala
          </Link>
          <Link
            href="/competences"
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-violet-600"
          >
            Tout l’annuaire
          </Link>
          {card.pro_external_url && (
            <a
              href={card.pro_external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-violet-600"
            >
              Site du pro
            </a>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed max-w-prose">
          Différence Mandala : les professionnels sont trouvés via des lieux et
          communautés qui se font confiance — pas seulement par mot-clé publicitaire.
        </p>
      </main>
    </PublicSiteChrome>
  )
}
