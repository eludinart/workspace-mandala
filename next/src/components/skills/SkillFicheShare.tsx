'use client'

import { useState } from 'react'
import {
  skillFichePublicAbsoluteUrl,
  skillFichePublicPath,
  skillFicheShareText,
} from '@/lib/skill-share'

export function SkillFicheShare({
  userId,
  displayName,
  shareTitle,
  canSharePublic,
  compact = false,
}: {
  userId: number
  displayName: string
  /** Titre natif de partage ; défaut = « Fiche Mandala de {displayName} ». */
  shareTitle?: string
  /** True seulement si scope === 'mandala' (page publique réelle). */
  canSharePublic: boolean
  compact?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!userId) return null

  const shareUrl = skillFichePublicAbsoluteUrl(userId)
  const path = skillFichePublicPath(userId)

  const copyLink = async () => {
    if (!canSharePublic) {
      setErr('Rendez la fiche visible « Tout Mandala » pour partager un lien public.')
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setErr(null)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setErr('Copie impossible')
    }
  }

  const nativeShare = async () => {
    if (!canSharePublic) {
      setErr('Rendez la fiche visible « Tout Mandala » pour partager un lien public.')
      return
    }
    const title = shareTitle?.trim() || skillFicheShareText(displayName)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: title, url: shareUrl })
        setErr(null)
        return
      } catch {
        /* annulé */
      }
    }
    await copyLink()
  }

  if (!canSharePublic) {
    return (
      <p className={compact ? 'mt-2 text-xs text-slate-500' : 'text-xs text-slate-500'}>
        Lien public indisponible tant que la fiche n’est pas en « Tout Mandala ».
      </p>
    )
  }

  const btn =
    'rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-900 ' +
    (compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm')

  return (
    <div className={compact ? 'mt-2 space-y-1' : 'space-y-2'}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void nativeShare()} className={btn}>
          Partager…
        </button>
        <button type="button" onClick={() => void copyLink()} className={btn}>
          {copied ? 'Copié' : 'Copier le lien'}
        </button>
        <a
          href={path}
          className={`${btn} inline-flex items-center text-violet-300 hover:border-violet-600`}
          target="_blank"
          rel="noreferrer"
        >
          Ouvrir la page
        </a>
      </div>
      {err && <p className="text-xs text-rose-400">{err}</p>}
    </div>
  )
}
