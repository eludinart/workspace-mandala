'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  evaluateInstallOffer,
  promptPwaInstall,
  snoozeInstallPrompt,
  subscribeInstallPrompt,
  type InstallOffer,
} from '@/lib/pwa-install'

function offerText(offer: InstallOffer): string {
  if (offer.platform === 'ios') {
    if (offer.iosNeedsSafari) {
      return 'Ouvrez cette page dans Safari, touchez Partager, puis Sur l’écran d’accueil.'
    }
    return 'Dans Safari, touchez Partager, puis Sur l’écran d’accueil. Rouvrez Mandala depuis l’icône.'
  }
  if (offer.canPrompt) {
    return 'Installez Mandala sur l’écran d’accueil pour l’ouvrir comme une application.'
  }
  return 'Ouvrez le menu du navigateur, puis Installer l’application ou Ajouter à l’écran d’accueil.'
}

/**
 * À l’ouverture sur téléphone : propose l’icône d’accueil.
 * Masqué si Mandala est déjà lancé depuis cette icône, ou si Android confirme l’installation.
 */
export function InstallAppPrompt() {
  const [offer, setOffer] = useState<InstallOffer | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setOffer(await evaluateInstallOffer())
  }, [])

  useEffect(() => {
    let cancelled = false
    void evaluateInstallOffer().then((next) => {
      if (!cancelled) setOffer(next)
    })
    const unsubscribe = subscribeInstallPrompt(() => {
      if (!cancelled) void refresh()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [refresh])

  if (!offer) return null

  const onInstall = async () => {
    setBusy(true)
    try {
      const outcome = await promptPwaInstall()
      if (outcome === 'dismissed') snoozeInstallPrompt('later')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const onLater = () => {
    snoozeInstallPrompt('later')
    setOffer(null)
  }

  const onAlready = () => {
    snoozeInstallPrompt('already')
    setOffer(null)
  }

  return (
    <div
      className="shrink-0 border-b border-emerald-800/50 bg-emerald-950/40 px-3 py-2.5 sm:px-4"
      role="region"
      aria-label="Ajouter Mandala à l’écran d’accueil"
      data-pwa-install={offer.platform}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <p className="flex-1 min-w-0 text-sm text-emerald-50">
          <span className="font-medium">Ajouter Mandala à l’écran d’accueil</span>
          <span className="text-emerald-100/90"> — {offerText(offer)}</span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {offer.canPrompt && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onInstall()}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? '…' : 'Installer'}
            </button>
          )}
          <button
            type="button"
            onClick={onLater}
            className="px-2 py-1.5 rounded-lg text-emerald-200 hover:text-white text-xs hover:bg-emerald-900/50"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={onAlready}
            className="px-2 py-1.5 rounded-lg text-emerald-300/80 hover:text-white text-xs hover:bg-emerald-900/50"
          >
            Déjà ajouté
          </button>
        </div>
      </div>
    </div>
  )
}
