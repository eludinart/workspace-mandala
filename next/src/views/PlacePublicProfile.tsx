'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { PublicCommunityProfile } from '@/api/communities'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { CharterPreview } from '@/components/place/CharterEditor'
import { ThemePicker } from '@/components/theme/ThemePicker'

const PlacesMap = dynamic(
  () => import('@/components/public/PlacesMap').then((m) => m.PlacesMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center">
        <p className="text-xs text-slate-500">Chargement…</p>
      </div>
    ),
  }
)

function normalizeWebsite(url: string): string {
  const t = url.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

function displayWebsite(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

function composeAddress(place: PublicCommunityProfile): string {
  const line2 = [place.postal_code, place.city].filter((v) => v && String(v).trim()).join(' ')
  const full = [place.address, line2, place.country]
    .map((v) => (v ? String(v).trim() : ''))
    .filter(Boolean)
    .join(', ')
  return full || (place.location ?? '')
}

function directionsUrl(place: PublicCommunityProfile): string | null {
  if (place.latitude != null && place.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`
  }
  const addr = composeAddress(place)
  if (!addr) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`
}

export function PlacePublicProfile({ place }: { place: PublicCommunityProfile }) {
  const website = place.website?.trim()
  const email = place.contact_email?.trim()
  const address = composeAddress(place)
  const directions = directionsUrl(place)
  const hasGeo = place.latitude != null && place.longitude != null
  const region = [place.city, place.country].filter((v) => v && String(v).trim()).join(', ')
  const hasCharter = place.charter && place.charter.length > 0

  return (
    <div className="h-full min-h-screen overflow-y-auto scroll-smooth bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="font-bold text-lg tracking-tight shrink-0">
            Mandala
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <ThemePicker />
            <Link
              href="/#carte"
              className="text-sm px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800"
            >
              ← Tous les lieux
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        <nav className="text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-300">
            Accueil
          </Link>
          <span className="mx-1.5">/</span>
          <Link href="/#lieux" className="hover:text-slate-300">
            Lieux
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-400">{place.name}</span>
        </nav>

        {/* En-tête du lieu */}
        <section className="flex flex-col sm:flex-row gap-6 items-start">
          <CommunityAvatar
            avatar={place.avatar}
            logoEmoji={place.logo_emoji}
            accentColor={place.accent_color}
            size="xl"
            alt={place.name}
          />
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{place.name}</h1>
            {place.tagline && (
              <p className="text-lg text-violet-300/90 leading-snug">{place.tagline}</p>
            )}
            {address && <p className="text-sm text-slate-400">📍 {address}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {website && (
                <a
                  href={normalizeWebsite(website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 font-medium"
                >
                  🌐 Site web
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800"
                >
                  ✉️ Contacter
                </a>
              )}
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800"
                >
                  🧭 Itinéraire
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Corps : contenu principal + colonne latérale */}
        <div className="grid lg:grid-cols-[1fr_20rem] gap-8 items-start">
          <div className="space-y-8 min-w-0">
            {/* Description */}
            {place.description ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold">À propos du lieu</h2>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {place.description}
                </p>
              </section>
            ) : (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold">À propos du lieu</h2>
                <p className="text-sm text-slate-500 italic">
                  Ce lieu n&apos;a pas encore publié de description détaillée.
                </p>
              </section>
            )}

            {/* Charte / valeurs */}
            {hasCharter && (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold">Charte &amp; valeurs</h2>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
                  <CharterPreview blocks={place.charter} />
                </div>
              </section>
            )}

            {/* Appel à rejoindre */}
            <section className="rounded-3xl border border-slate-800 bg-gradient-to-b from-violet-950/25 to-slate-950 p-8 text-center space-y-4">
              <h2 className="text-2xl font-bold">Envie de rejoindre {place.name} ?</h2>
              <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
                Créez un compte membre pour accéder à l&apos;espace communautaire, au calendrier et
                aux événements de ce lieu.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/app"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold"
                >
                  Créer un compte membre
                </Link>
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 font-medium"
                  >
                    Poser une question
                  </a>
                )}
              </div>
            </section>
          </div>

          {/* Colonne latérale : infos pratiques + mini-carte */}
          <aside className="space-y-4 lg:sticky lg:top-20">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-200">Informations</h2>

              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Membres</dt>
                  <dd className="font-semibold text-slate-100">{place.member_count}</dd>
                </div>
                {region && (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500 shrink-0">Région</dt>
                    <dd className="text-slate-200 text-right">{region}</dd>
                  </div>
                )}
                {address && (
                  <div className="space-y-1 pt-1 border-t border-slate-800">
                    <dt className="text-slate-500">Adresse</dt>
                    <dd className="text-slate-200">{address}</dd>
                  </div>
                )}
                {website && (
                  <div className="space-y-1 pt-1 border-t border-slate-800">
                    <dt className="text-slate-500">Site web</dt>
                    <dd>
                      <a
                        href={normalizeWebsite(website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-300 hover:underline break-all"
                      >
                        {displayWebsite(website)}
                      </a>
                    </dd>
                  </div>
                )}
                {email && (
                  <div className="space-y-1 pt-1 border-t border-slate-800">
                    <dt className="text-slate-500">Contact</dt>
                    <dd>
                      <a
                        href={`mailto:${email}`}
                        className="text-violet-300 hover:underline break-all"
                      >
                        {email}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Mini-carte : rappel de la localisation */}
            {hasGeo && (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-2xl border border-slate-800">
                  <PlacesMap
                    places={[place]}
                    selectedSlug={place.slug}
                    heightClassName="h-44"
                    hideCaption
                  />
                </div>
                {directions && (
                  <a
                    href={directions}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-xs text-violet-300 hover:underline"
                  >
                    🧭 Obtenir un itinéraire
                  </a>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-600">
        <p>Mandala — lieux, communautés &amp; événements</p>
        <p className="mt-1">
          <Link href="/#carte" className="hover:text-slate-400">
            Voir tous les lieux sur la carte
          </Link>
        </p>
      </footer>
    </div>
  )
}
