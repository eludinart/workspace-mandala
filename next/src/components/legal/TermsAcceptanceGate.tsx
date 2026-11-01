'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { legalApi } from '@/api/legal'
import { ApiError } from '@/lib/api-client'

/**
 * Pour les comptes créés avant l’exigence CGU : bloque l’app jusqu’à acceptation.
 */
export function TermsAcceptanceGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'need' | 'ready'>('loading')
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState('')

  const refresh = useCallback(async () => {
    try {
      const status = await legalApi.status()
      setVersion(status.cgu_version)
      setPhase(status.cgu_accepted ? 'ready' : 'need')
    } catch {
      // Ne pas bloquer l’app si l’API légale est indisponible (ex. table pas encore créée).
      setPhase('ready')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function submit() {
    if (!accept) {
      setError('Cochez la case pour continuer.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await legalApi.accept()
      setPhase('ready')
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.detail : 'Impossible d’enregistrer l’acceptation')
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
        Chargement…
      </div>
    )
  }

  if (phase === 'ready') return <>{children}</>

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10 bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
        <h1 className="text-lg font-semibold text-slate-100">Conditions d’utilisation</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Pour continuer sur Mandala, merci d’accepter les documents légaux en vigueur
          {version ? ` (version ${version})` : ''}. Cela permet notamment de protéger la communauté
          et de respecter les règles des magasins d’applications.
        </p>
        <label className="flex items-start gap-3 text-xs text-slate-300 leading-relaxed cursor-pointer">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            J’ai au moins 13 ans et j’accepte les{' '}
            <Link href="/cgu" target="_blank" className="text-violet-300 underline">
              CGU
            </Link>
            , les{' '}
            <Link href="/cgv" target="_blank" className="text-violet-300 underline">
              CGV
            </Link>{' '}
            et la{' '}
            <Link href="/confidentialite" target="_blank" className="text-violet-300 underline">
              politique de confidentialité
            </Link>
            .
          </span>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="button"
          disabled={busy || !accept}
          onClick={() => void submit()}
          className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3 font-semibold disabled:opacity-50"
        >
          {busy ? '…' : 'Continuer'}
        </button>
      </div>
    </div>
  )
}
