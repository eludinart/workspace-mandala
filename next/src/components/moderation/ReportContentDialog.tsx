'use client'

import { useState } from 'react'
import { moderationApi, type ContentReasonCode, type ContentTargetType } from '@/api/moderation'
import { ApiError } from '@/lib/api-client'

const REASONS: { code: ContentReasonCode; label: string }[] = [
  { code: 'harassment', label: 'Harcèlement ou intimidation' },
  { code: 'hate', label: 'Discours haineux / discrimination' },
  { code: 'spam', label: 'Spam ou publicité abusive' },
  { code: 'sexual', label: 'Contenu sexuel inapproprié' },
  { code: 'illegal', label: 'Contenu illégal ou dangereux' },
  { code: 'impersonation', label: 'Usurpation d’identité' },
  { code: 'other', label: 'Autre' },
]

export function ReportContentDialog({
  open,
  onClose,
  targetType,
  targetId,
  targetUserId,
  communityId,
  title = 'Signaler',
}: {
  open: boolean
  onClose: () => void
  targetType: ContentTargetType
  targetId: string | number
  targetUserId?: number
  communityId?: number
  title?: string
}) {
  const [reason, setReason] = useState<ContentReasonCode>('harassment')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await moderationApi.report({
        target_type: targetType,
        target_id: targetId,
        target_user_id: targetUserId,
        community_id: communityId,
        reason_code: reason,
        details: details.trim() || undefined,
      })
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Signalement impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4">
        <h2 id="report-dialog-title" className="text-lg font-semibold text-slate-100">
          {title}
        </h2>
        {done ? (
          <>
            <p className="text-sm text-emerald-300/90">
              Merci. Votre signalement a été transmis à la modération.
            </p>
            <button
              type="button"
              className="w-full rounded-xl bg-slate-800 py-2.5 text-sm"
              onClick={onClose}
            >
              Fermer
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400">
              Indiquez pourquoi ce contenu ou cette personne pose problème. Les faux signalements
              répétés peuvent entraîner des sanctions.
            </p>
            <label className="block text-xs text-slate-400 space-y-1">
              Motif
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ContentReasonCode)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
              >
                {REASONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400 space-y-1">
              Précisions (optionnel)
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                placeholder="Contexte utile pour la modération"
              />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm"
                onClick={onClose}
                disabled={busy}
              >
                Annuler
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-rose-700 hover:bg-rose-600 py-2.5 text-sm font-medium disabled:opacity-50"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? '…' : 'Envoyer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
