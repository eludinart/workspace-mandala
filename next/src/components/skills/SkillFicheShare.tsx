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
  alwaysShow = false,
}: {
  userId: number
  displayName: string
  /** Titre natif de partage ; défaut = « Fiche Mandala de {displayName} ». */
  shareTitle?: string
  /** True seulement si scope === 'mandala' (page publique réelle). */
  canSharePublic: boolean
  compact?: boolean
  /**
   * Affiche le bloc même si le lien public n’est pas encore actif
   * (ex. propriétaire sur formulaire Profil / Compétences / sa fiche).
   */
  alwaysShow?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!userId) return null
  if (!canSharePublic && !alwaysShow) return null

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

  const btn =
    'rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-900 ' +
    (compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm')
  const btnDisabled = `${btn} opacity-50 cursor-not-allowed`

  return (
    <div className={compact ? 'mt-2 space-y-1.5' : 'space-y-2'}>
      {!compact && (
        <p className="text-xs font-medium text-slate-300">Lien de partage</p>
      )}
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
        <p className="text-xs text-slate-400 break-all">{shareUrl}</p>
      ) : (
        <p className="text-xs text-slate-500">
          Lien public indisponible tant que la fiche n’est pas en « Tout Mandala ».
        </p>
      )}
      {err && <p className="text-xs text-rose-400">{err}</p>}
    </div>
  )
}
