'use client'

import { useState } from 'react'

export function CreatePollSheet({
  open,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (payload: { question: string; options: string[] }) => Promise<void>
  busy?: boolean
}) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [err, setErr] = useState<string | null>(null)

  if (!open) return null

  function setOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)))
  }

  async function submit() {
    setErr(null)
    const q = question.trim()
    const opts = options.map((o) => o.trim()).filter(Boolean)
    if (!q) {
      setErr('Indiquez une question.')
      return
    }
    if (opts.length < 2) {
      setErr('Au moins deux options.')
      return
    }
    try {
      await onSubmit({ question: q, options: opts })
      setQuestion('')
      setOptions(['', ''])
      onClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Impossible de créer le sondage')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nouveau sondage"
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-4 space-y-3 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Nouveau sondage</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-lg leading-none px-2"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <label className="block text-xs text-slate-400">
          Question
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={280}
            className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
            placeholder="Que préfèrez-vous ?"
          />
        </label>
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Options</p>
          {options.map((opt, i) => (
            <input
              key={i}
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              maxLength={120}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100"
              placeholder={`Option ${i + 1}`}
            />
          ))}
          {options.length < 6 && (
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ''])}
              className="text-xs text-violet-300 hover:text-violet-200"
            >
              + Ajouter une option
            </button>
          )}
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-300"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="text-xs px-3 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50"
          >
            {busy ? 'Publication…' : 'Publier le sondage'}
          </button>
        </div>
      </div>
    </div>
  )
}
