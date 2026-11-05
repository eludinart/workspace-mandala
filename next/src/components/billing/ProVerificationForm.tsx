'use client'

import { useState } from 'react'
import { billingApi } from '@/api/billing'

type Props = {
  /** Affichage compact dans la bannière post-checkout */
  compact?: boolean
  onSubmitted?: () => void
}

/**
 * Demande d’endossement Mandala Pro (API POST /api/billing/pro/submit).
 * À appeler après paiement — le badge n’apparaît qu’après revue.
 */
export function ProVerificationForm({ compact, onSubmitted }: Props) {
  const [tagline, setTagline] = useState('')
  const [modalities, setModalities] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await billingApi.submitPro({
        tagline: tagline.trim(),
        modalities: modalities.trim(),
        service_area: serviceArea.trim(),
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
        Demande envoyée. Votre profil Pro est en attente d’endossement (lieu ou
        équipe Mandala). Le badge apparaîtra après validation.
      </p>
    )
  }

  const fieldClass =
    'w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none'

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {!compact && (
        <p className="text-sm text-slate-300">
          Décrivez votre pratique pour la file d’endossement Mandala Pro.
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
        <span className="text-xs text-slate-400">Zone</span>
        <input
          className={fieldClass}
          value={serviceArea}
          onChange={(e) => setServiceArea(e.target.value)}
          maxLength={160}
          placeholder="Ville, région, ou « France entière »"
          disabled={busy}
        />
      </label>
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
        {busy ? 'Envoi…' : 'Demander l’endossement'}
      </button>
    </form>
  )
}
