'use client'

import { useState } from 'react'
import { billingApi } from '@/api/billing'
import { skillsApi } from '@/api/skills'
import { MAX_PRACTICE_LOCATIONS } from '@/lib/practice-locations'

type Props = {
  /** Affichage compact dans la bannière post-checkout */
  compact?: boolean
  onSubmitted?: () => void
}

/**
 * Demande Mandala Pro — formulaire avant (ou après) paiement.
 * Persiste aussi résidence + lieux d’exercice sur la fiche compétences.
 */
export function ProVerificationForm({ compact, onSubmitted }: Props) {
  const [tagline, setTagline] = useState('')
  const [modalities, setModalities] = useState('')
  const [residenceCity, setResidenceCity] = useState('')
  const [practiceLocations, setPracticeLocations] = useState<string[]>([])
  const [draftCity, setDraftCity] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function addPracticeCity() {
    const label = draftCity.trim()
    if (!label) return
    const key = label.toLocaleLowerCase('fr')
    setPracticeLocations((prev) => {
      if (prev.some((c) => c.toLocaleLowerCase('fr') === key)) return prev
      if (prev.length >= MAX_PRACTICE_LOCATIONS) return prev
      return [...prev, label]
    })
    setDraftCity('')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (practiceLocations.length === 0) {
      setError('Indiquez au moins une ville d’exercice.')
      return
    }
    setBusy(true)
    try {
      let cities = practiceLocations
      const pending = draftCity.trim()
      if (pending) {
        const key = pending.toLocaleLowerCase('fr')
        if (!cities.some((c) => c.toLocaleLowerCase('fr') === key)) {
          cities = [...cities, pending].slice(0, MAX_PRACTICE_LOCATIONS)
        }
      }
      try {
        const mine = await skillsApi.getMine()
        await skillsApi.saveMine({
          scope: mine.profile.scope,
          offer_text: mine.profile.offer_text,
          seek_text: mine.profile.seek_text,
          frame_text: mine.profile.frame_text,
          place_ids: mine.profile.place_ids,
          tags: mine.profile.tags,
          residence_city: residenceCity.trim(),
          practice_locations: cities,
        })
      } catch {
        /* la demande Pro reste prioritaire si la fiche skills échoue */
      }
      await billingApi.submitPro({
        tagline: tagline.trim(),
        modalities: modalities.trim(),
        service_area: cities.join(', '),
        external_url: externalUrl.trim(),
      })
      setDone(true)
      onSubmitted?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Envoi impossible')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <p
        className={
          compact
            ? 'text-xs text-emerald-100/95 leading-relaxed'
            : 'text-sm text-emerald-200'
        }
      >
        Demande envoyée. Votre profil Pro est en attente de validation (lieu ou
        équipe Mandala).
      </p>
    )
  }

  const fieldClass =
    'w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none'

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {!compact && (
        <p className="text-sm text-slate-300">
          Décrivez votre pratique. La validation précède le paiement pour le badge.
        </p>
      )}
      <label className="block space-y-1">
        <span className="text-xs text-slate-400">Accroche</span>
        <input
          className={fieldClass}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={160}
          placeholder="Ex. Accompagnement somatique · Loire"
          disabled={busy}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-slate-400">Modalités</span>
        <textarea
          className={`${fieldClass} min-h-[72px]`}
          value={modalities}
          onChange={(e) => setModalities(e.target.value)}
          maxLength={800}
          placeholder="En présentiel, visio, ateliers…"
          disabled={busy}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-slate-400">Ville de résidence</span>
        <input
          className={fieldClass}
          value={residenceCity}
          onChange={(e) => setResidenceCity(e.target.value)}
          maxLength={120}
          placeholder="Où vous vivez"
          disabled={busy}
        />
      </label>
      <div className="space-y-1.5">
        <span className="text-xs text-slate-400">Lieux d’exercice (obligatoire)</span>
        <div className="flex flex-wrap gap-1.5">
          {practiceLocations.map((city) => (
            <span
              key={city}
              className="inline-flex items-center gap-1 rounded-full border border-sky-800/50 bg-sky-950/40 px-2 py-0.5 text-xs text-sky-100"
            >
              {city}
              <button
                type="button"
                disabled={busy}
                className="text-sky-400 hover:text-white"
                onClick={() =>
                  setPracticeLocations((prev) => prev.filter((c) => c !== city))
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={fieldClass}
            value={draftCity}
            onChange={(e) => setDraftCity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addPracticeCity()
              }
            }}
            maxLength={120}
            placeholder="Ajouter une ville…"
            disabled={busy}
          />
          <button
            type="button"
            onClick={addPracticeCity}
            disabled={busy || !draftCity.trim()}
            className="shrink-0 rounded-lg border border-sky-700 px-3 text-xs text-sky-100 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-slate-400">Lien (optionnel)</span>
        <input
          className={fieldClass}
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          maxLength={400}
          placeholder="https://"
          disabled={busy}
        />
      </label>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      <button
        type="submit"
        disabled={busy || !tagline.trim()}
        className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {busy ? 'Envoi…' : 'Envoyer la demande Pro'}
      </button>
    </form>
  )
}
