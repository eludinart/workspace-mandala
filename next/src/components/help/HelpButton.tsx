'use client'

import { useEffect, useId, useState } from 'react'
import type { MandalaPage } from '@/components/MandalaApp'
import { supportApi, type SupportKind } from '@/api/support'
import { useCommunity } from '@/contexts/CommunityContext'
import { ApiError } from '@/lib/api-client'
import { helpForPage } from '@/lib/help-topics'
import { PAGE_LABELS } from '@/lib/nav'

export function HelpButton({ page }: { page: MandalaPage }) {
  const { active } = useCommunity()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'help' | 'report'>('help')
  const [kind, setKind] = useState<SupportKind>('bug')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const help = helpForPage(page)
  const aboveNav = page !== 'messages'

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const openReport = (nextKind: SupportKind) => {
    setKind(nextKind)
    setTab('report')
    setSent(false)
    setError(null)
    setOpen(true)
  }

  const submit = async () => {
    const text = message.trim()
    if (text.length < 8) {
      setError('Décrivez le sujet en quelques mots.')
      return
    }
    setSending(true)
    setError(null)
    try {
      await supportApi.create({
        kind,
        message: text,
        page,
        community_slug: active?.slug ?? null,
      })
      setSent(true)
      setMessage('')
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Envoi impossible pour le moment.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            setTab('help')
            setSent(false)
            setError(null)
            setOpen(true)
          }}
          className={`fixed z-[60] right-4 flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-violet-600 text-white text-lg font-semibold shadow-lg shadow-violet-950/40 hover:bg-violet-500 ${
            aboveNav
              ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6'
              : 'bottom-24 md:bottom-6'
          }`}
          aria-label="Aide"
          aria-haspopup="dialog"
        >
          ?
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70"
            aria-label="Fermer l’aide"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-md max-h-[min(34rem,85vh)] overflow-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 px-4 pt-4">
              <h2 id={titleId} className="text-base font-semibold text-slate-100">
                Aide
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-w-[44px] min-h-[44px] rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2 px-4 pt-2" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'help'}
                onClick={() => setTab('help')}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  tab === 'help' ? 'bg-violet-600 text-white' : 'border border-slate-700 text-slate-300'
                }`}
              >
                Cette page
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'report'}
                onClick={() => setTab('report')}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  tab === 'report' ? 'bg-violet-600 text-white' : 'border border-slate-700 text-slate-300'
                }`}
              >
                Signaler
              </button>
            </div>

            {tab === 'help' ? (
              <div className="px-4 py-4 space-y-3">
                <p className="text-sm font-medium text-slate-200">{help.title}</p>
                <ul className="space-y-2 text-sm text-slate-300">
                  {help.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openReport('question')}
                    className="px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    Poser une question
                  </button>
                  <button
                    type="button"
                    onClick={() => openReport('bug')}
                    className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-500"
                  >
                    Signaler un bug
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="px-4 py-4 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  void submit()
                }}
              >
                <p className="text-xs text-slate-500">
                  Page jointe : {PAGE_LABELS[page]}
                  {active?.name ? ` · ${active.name}` : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setKind('question')}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      kind === 'question'
                        ? 'bg-violet-600 text-white'
                        : 'border border-slate-700 text-slate-300'
                    }`}
                  >
                    Question
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind('bug')}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      kind === 'bug' ? 'bg-violet-600 text-white' : 'border border-slate-700 text-slate-300'
                    }`}
                  >
                    Bug
                  </button>
                </div>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder={
                    kind === 'bug'
                      ? 'Que s’est-il passé, et qu’attendiez-vous ?'
                      : 'Votre question sur l’utilisation…'
                  }
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
                {error && <p className="text-sm text-red-400">{error}</p>}
                {sent && (
                  <p className="text-sm text-emerald-400">
                    Message envoyé. Il apparaît dans Administration → Retours.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={sending}
                  className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-500 disabled:opacity-60"
                >
                  {sending ? 'Envoi…' : 'Envoyer'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
