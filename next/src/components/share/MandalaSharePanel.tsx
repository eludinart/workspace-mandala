'use client'

import { useState } from 'react'

/** Bloc Partager / Copier / Ouvrir — pattern commun fiches, lieux, ressources. */
export function MandalaSharePanel({
  path,
  absoluteUrl,
  heading,
  shareTitle,
  canSharePublic,
  alwaysShow = false,
  unavailableMessage,
  compact = false,
}: {
  path: string
  absoluteUrl: string
  heading: string
  shareTitle: string
  canSharePublic: boolean
  alwaysShow?: boolean
  unavailableMessage: string
  compact?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!path || (!canSharePublic && !alwaysShow)) return null

  const copyLink = async () => {
    if (!canSharePublic) {
      setErr(unavailableMessage)
      return
    }
    try {
      await navigator.clipboard.writeText(absoluteUrl)
      setCopied(true)
      setErr(null)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setErr('Copie impossible')
    }
  }

  const nativeShare = async () => {
    if (!canSharePublic) {
      setErr(unavailableMessage)
      return
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, text: shareTitle, url: absoluteUrl })
        setErr(null)
        return
      } catch {
        /* annulé */
      }
    }
    await copyLink()
  }

  const btn =
    'rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-900 ' +
    (compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm')
  const btnDisabled = `${btn} opacity-50 cursor-not-allowed`

  return (
    <div className={compact ? 'mt-2 space-y-1.5' : 'space-y-2'}>
      <p className="text-xs font-medium text-slate-300">{heading}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void nativeShare()}
          className={canSharePublic ? btn : btnDisabled}
          aria-disabled={!canSharePublic}
        >
          Partager…
        </button>
        <button
          type="button"
          onClick={() => void copyLink()}
          className={canSharePublic ? btn : btnDisabled}
          aria-disabled={!canSharePublic}
        >
          {copied ? 'Copié' : 'Copier le lien'}
        </button>
        {canSharePublic ? (
          <a
            href={path}
            className={`${btn} inline-flex items-center text-violet-300 hover:border-violet-600`}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir la page
          </a>
        ) : (
          <span className={`${btnDisabled} inline-flex items-center`}>Ouvrir la page</span>
        )}
      </div>
      {canSharePublic ? (
        <p className="text-xs text-slate-400 break-all">{absoluteUrl}</p>
      ) : (
        <p className="text-xs text-slate-500">{unavailableMessage}</p>
      )}
      {err && <p className="text-xs text-rose-400">{err}</p>}
    </div>
  )
}
