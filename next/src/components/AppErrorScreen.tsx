'use client'

import { useEffect, useState } from 'react'
import { chunkErrorSignature, isChunkLoadError, reloadOnceForStaleChunk } from '@/lib/chunk-load-error'

export function AppErrorScreen({
  error,
  reset,
  title = 'Une erreur est survenue',
  fullPage = false,
}: {
  error: Error & { digest?: string }
  reset: () => void
  title?: string
  fullPage?: boolean
}) {
  const chunk = isChunkLoadError(error)
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    if (!chunk) return
    if (!reloadOnceForStaleChunk(chunkErrorSignature(error))) setGaveUp(true)
  }, [chunk, error])

  const retry = () => {
    if (chunk) {
      window.location.reload()
      return
    }
    reset()
  }

  return (
    <div
      className={
        fullPage
          ? 'min-h-svh flex flex-col items-center justify-center gap-4 px-8 pt-8 pb-[max(2rem,env(safe-area-inset-bottom,0px))] bg-slate-950 text-slate-100 font-sans'
          : 'flex-1 h-full min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-4 px-8 pt-8 pb-[max(2rem,env(safe-area-inset-bottom,0px))] bg-slate-950 text-slate-100'
      }
    >
      <h1 className="text-xl font-bold text-center">
        {chunk ? 'La page n’a pas pu se charger' : title}
      </h1>
      <p className="text-sm text-slate-400 text-center max-w-md">
        {chunk
          ? gaveUp
            ? 'Le rechargement n’a pas suffi. Vérifiez la connexion, puis rechargez la page.'
            : 'Connexion interrompue, ou application mise à jour. Rechargement…'
          : error.message}
      </p>
      {chunk && gaveUp && (
        <p className="text-xs text-slate-500 text-center max-w-md break-all">{error.message}</p>
      )}
      <button
        type="button"
        onClick={retry}
        className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-500"
      >
        {chunk ? 'Recharger' : 'Réessayer'}
      </button>
    </div>
  )
}
