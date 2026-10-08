'use client'

import { useCallback, useEffect, useState } from 'react'
import { skillsApi, type SkillCard } from '@/api/skills'
import { UserAvatar } from '@/components/UserAvatar'

const INTERVAL_MS = 6000

function showcaseCards(cards: SkillCard[]): SkillCard[] {
  return cards.filter(
    (card) => card.tags.length > 0 || card.offer_text.trim() || card.seek_text.trim()
  )
}

function profileName(card: SkillCard): string {
  return card.display_name.trim() || card.pseudo
}

export function SkillsCarousel({ onOpenProfile }: { onOpenProfile?: (userId: number) => void }) {
  const [cards, setCards] = useState<SkillCard[]>([])
  const [ready, setReady] = useState(false)
  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [pageHidden, setPageHidden] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    void skillsApi
      .publicDirectory()
      .then((res) => {
        if (!cancelled) setCards(showcaseCards(res.cards ?? []))
      })
      .catch(() => {
        if (!cancelled) setCards([])
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyMotion = () => setReduceMotion(motion.matches)
    applyMotion()
    motion.addEventListener('change', applyMotion)
    const onVisibility = () => setPageHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      motion.removeEventListener('change', applyMotion)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const count = cards.length
  const held = userPaused || hovered || focused || pageHidden || reduceMotion || count < 2

  const go = useCallback(
    (delta: number, announce = false) => {
      if (count < 2) return
      const next = (index + delta + count) % count
      setIndex(next)
      if (!announce) return
      const card = cards[next]
      if (card) setStatus(`${profileName(card)}, ${next + 1} sur ${count}`)
    },
    [cards, count, index]
  )

  useEffect(() => {
    if (held) return
    const timer = window.setTimeout(() => go(1), INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [held, go, index])

  useEffect(() => {
    if (index < count) return
    setIndex(0)
  }, [index, count])

  if (!ready || count === 0) return null

  return (
    <div
      className="mb-14"
      role="region"
      aria-roledescription="carrousel"
      aria-label="Profils et compétences"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        const next = event.relatedTarget
        if (next instanceof Node && event.currentTarget.contains(next)) return
        setFocused(false)
      }}
    >
      <div className="text-center max-w-2xl mx-auto mb-8 space-y-3">
        <p className="m-landing-eyebrow">Savoir-faire</p>
        <h2 className="text-3xl sm:text-4xl">Des personnes, des compétences</h2>
        <p className="text-slate-400 text-sm sm:text-base">
          Elles ont choisi de montrer ce qu’elles peuvent apporter au réseau.
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="m-landing-card overflow-hidden">
          {!reduceMotion && count > 1 && (
            <div className="h-0.5 bg-slate-800/80" aria-hidden>
              <div
                key={`${index}-${held ? 'hold' : 'run'}`}
                className="m-skills-carousel-bar"
                style={
                  held
                    ? { transform: 'scaleX(0)' }
                    : { animation: `m-carousel-progress ${INTERVAL_MS}ms linear forwards` }
                }
              />
            </div>
          )}

          <div className="overflow-hidden">
            <div
              className="m-skills-carousel-track"
              style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
            >
              {cards.map((card, slideIndex) => {
                const name = profileName(card)
                const offer = card.offer_text.replace(/\s+/g, ' ').trim()
                const seek = card.seek_text.replace(/\s+/g, ' ').trim()
                const blurb = offer || seek
                const places = card.places.map((place) => place.name).join(' · ')
                const visibleTags = card.tags.slice(0, 6)
                const extraTags = card.tags.length - visibleTags.length
                return (
                  <article
                    key={card.user_id}
                    className="w-full shrink-0 p-6 sm:p-8"
                    aria-hidden={slideIndex !== index}
                    inert={slideIndex !== index}
                    aria-roledescription="diapositive"
                    aria-label={`${slideIndex + 1} sur ${count} : ${name}`}
                  >
                    <div className="flex items-start gap-4 sm:gap-6">
                      <UserAvatar
                        avatar={card.avatar}
                        avatarEmoji={card.avatar_emoji}
                        size="xl"
                        alt=""
                      />
                      <div className="min-w-0 flex-1 space-y-3">
                        <div>
                          <h3 className="text-2xl sm:text-3xl text-slate-50">{name}</h3>
                          {places && <p className="mt-1 text-sm text-slate-500">{places}</p>}
                        </div>
                        {blurb && (
                          <p className="text-sm sm:text-[15px] leading-relaxed text-slate-300 line-clamp-3">
                            <span className="text-slate-500">{offer ? 'Apporte' : 'Cherche'} · </span>
                            {blurb}
                          </p>
                        )}
                        {visibleTags.length > 0 && (
                          <ul className="flex flex-wrap gap-1.5">
                            {visibleTags.map((tag) => (
                              <li
                                key={`${tag.label}-${tag.register}`}
                                className="text-[11px] px-2.5 py-1 rounded-full border border-slate-700 text-slate-200"
                              >
                                {tag.label}
                              </li>
                            ))}
                            {extraTags > 0 && (
                              <li className="text-[11px] px-2 py-1 text-slate-500">+{extraTags}</li>
                            )}
                          </ul>
                        )}
                        {onOpenProfile && (
                          <button
                            type="button"
                            onClick={() => onOpenProfile(card.user_id)}
                            className="text-[11px] uppercase tracking-[0.14em] font-semibold text-violet-300 hover:text-violet-200"
                          >
                            Lire la fiche
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>

        {count > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => go(-1, true)}
              className="m-skills-carousel-nav"
              aria-label="Profil précédent"
            >
              ‹
            </button>
            {count <= 8 ? (
              <div className="flex items-center gap-1.5" role="group" aria-label="Choisir un profil">
                {cards.map((card, dotIndex) => (
                  <button
                    key={card.user_id}
                    type="button"
                    aria-label={profileName(card)}
                    aria-current={dotIndex === index ? 'true' : undefined}
                    onClick={() => {
                      setIndex(dotIndex)
                      setStatus(`${profileName(card)}, ${dotIndex + 1} sur ${count}`)
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      dotIndex === index ? 'w-6 bg-violet-400' : 'w-1.5 bg-slate-600 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs tabular-nums text-slate-500">
                {index + 1} / {count}
              </p>
            )}
            <button
              type="button"
              onClick={() => go(1, true)}
              className="m-skills-carousel-nav"
              aria-label="Profil suivant"
            >
              ›
            </button>
            {!reduceMotion && (
              <button
                type="button"
                onClick={() => setUserPaused((value) => !value)}
                aria-pressed={userPaused}
                className="ml-1 text-[11px] uppercase tracking-[0.14em] text-slate-400 hover:text-slate-200"
              >
                {userPaused ? 'Lecture' : 'Pause'}
              </button>
            )}
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {status}
        </p>
      </div>
    </div>
  )
}
